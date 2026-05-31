# BUG-6 敵HPランタイム分離設計

> 作成日: 2026-05-25
> 対象: `src/logic/BattleEngine.ts`, `src/types/game.ts`, `src/logic/BattleEngine.test.ts`

## 1. 背景

`BattleEngine` は UI / Zustand / マスターデータ由来の `MonsterData` を受け取り、戦闘ログを返す純粋寄りのクラスとして使われる。

しかし敵へのダメージ処理で `target.stats.hp` を直接減らしていたため、呼び出し元が保持する敵オブジェクトまで現在HPに書き換わっていた。

```ts
target.stats.hp = Math.max(0, target.stats.hp - damage);
```

この挙動は以下の問題を生む。

- マスターデータやZustandスナップショットの最大HPが、戦闘後に現在HPへ変わる。
- 同じ敵オブジェクトを次の戦闘・UI表示・テストで再利用すると、HPが減った状態から始まる。
- ボスギミックのHP割合判定が、最大HPではなくすでに減ったHPを基準にしてしまう危険がある。

## 2. 設計方針

### 2.1 `MonsterData.stats.hp` の意味

`MonsterData.stats.hp` は敵の最大HPとして扱う。BattleEngine内で現在HPとして直接書き換えない。

| データ | 役割 |
|---|---|
| `enemy.stats.hp` | 最大HP / 防御側ステータススナップショット |
| `BattleEngine.enemyCurrentHp[id]` | バトル中の敵現在HP |
| `BattleEngine.enemyMaxHp[id]` | バトル開始時に確定した敵最大HP |

### 2.2 ランタイムHP管理

BattleEngineに敵専用のHPマップを持たせる。

```ts
private enemyCurrentHp: Record<string, number> = {};
private enemyMaxHp: Record<string, number> = {};
```

初回参照時に `enemy.stats.hp` から最大HPと現在HPを初期化する。以降のダメージ、復活、ボスHP割合判定はこのランタイムHPを使う。

### 2.3 BattleStateへの反映

`BattleState` に `enemyCurrentHp` / `enemyMaxHp` を追加する。現時点ではBattleEngine内部のテスト・デバッグ向けだが、将来的にBattleCanvasやServer ActionがBattleEngine状態を直接参照する場合も同じ契約を使える。

```ts
enemyCurrentHp: Record<string, number>;
enemyMaxHp: Record<string, number>;
```

### 2.4 対象範囲

今回のBUG-6では敵HPの共有オブジェクト破壊のみを修正する。

| 項目 | 今回の扱い |
|---|---|
| 敵HP | ランタイムマップへ分離 |
| 敵最大HP | `MonsterData.stats.hp` を維持 |
| ボスREVIVE | ランタイムHPを回復 |
| ボスENRAGEのATK変更 | 既存仕様を維持 |
| shieldHp / shieldBroken | 既存のランタイム直接更新を維持 |
| statusEffects | 既存のランタイム直接更新を維持 |

shield / statusEffects も将来的には敵ランタイム状態へ移す余地があるが、今回の不具合はHP破壊に限定する。

## 3. 実装詳細

### 3.1 ヘルパー

BattleEngineに以下のヘルパーを追加する。

| ヘルパー | 役割 |
|---|---|
| `ensureEnemyRuntimeHp(enemy)` | 初回参照時に最大HP・現在HPを初期化 |
| `getEnemyMaxHp(enemy)` | 敵最大HPを取得 |
| `getEnemyRuntimeHp(enemy)` | 敵現在HPを取得 |
| `setEnemyCurrentHp(enemy, hp)` | 現在HPを0〜最大HPに丸めて保存 |
| `applyDamageToEnemy(enemy, damage)` | ダメージ反映とHP割合計算を一括で返す |
| `getEnemyCurrentHp(enemyId)` | テスト・デバッグ用の公開getter |

### 3.2 ダメージ反映箇所

以下の直接更新を `applyDamageToEnemy()` に置き換える。

- プレイヤー通常攻撃 / スキル
- 魔神技
- 味方魔物の追撃
- 武器パッシブの追加ダメージ

### 3.3 ボスギミック

HP割合ギミックは `applyDamageToEnemy()` が返す `prevHpPct` / `newHpPct` を使う。

REVIVE は `boss.stats.hp` を書き換えず、`setEnemyCurrentHp()` で現在HPのみを回復する。

```ts
setEnemyCurrentHp(boss, getReviveHp(getEnemyMaxHp(boss), gimmick));
```

これにより、復活後も `boss.stats.hp` は最大HPとして維持される。

## 4. テスト方針

`src/logic/BattleEngine.test.ts` で以下を保証する。

| テスト | 確認内容 |
|---|---|
| 敵HP非破壊 | 2回攻撃しても `enemy.stats.hp` と `enemy.stats` 参照が変わらず、`getEnemyCurrentHp()` だけが減る |
| REVIVE | HP0時に `getEnemyCurrentHp()` が最大HPの50%へ戻り、`boss.stats.hp` は最大HPのまま |
| HP50%跨ぎ | 50%を跨いだだけではREVIVEせず、ランタイム現在HPだけが減る |

## 5. 完了条件

- 敵へのダメージで `MonsterData.stats.hp` を直接変更しない。
- 連続攻撃でもランタイムHPが継続して減る。
- ボスREVIVEがランタイムHPで動作する。
- BattleEngine単体テスト、全Jest、型検査、ビルドが成功する。
