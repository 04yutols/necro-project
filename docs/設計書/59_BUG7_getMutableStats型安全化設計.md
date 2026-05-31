# BUG-7 getMutableStats型安全化設計

> 作成日: 2026-05-26
> 対象: `src/logic/BattleEngine.ts`, `src/logic/BattleEngine.test.ts`

## 1. 背景

`BattleEngine` は `CharacterData` を受け取り、戦闘中のプレイヤーHP、状態異常、SP、魔神化ゲージを更新する。

既存の `getMutableStats()` は `CharacterData.stats` が必須であるにもかかわらず、`any` キャストで `stats` / `baseStats` の両方を参照していた。

```ts
private getMutableStats(player: CharacterData): BaseStats {
  return ((player as any).stats ?? (player as any).baseStats) as BaseStats;
}
```

## 2. 問題

### 2.1 型安全性の破壊

`CharacterData.stats` は `BaseStats` 型として必須フィールドで宣言されている。`as any` を使うと、`stats` が欠落した不正データでもコンパイラが検知できず、BattleEngine内部に旧形状データを持ち込めてしまう。

### 2.2 `stats` と `baseStats` の責務混同

現在の設計では、それぞれの役割は以下の通り。

| フィールド | 役割 |
|---|---|
| `CharacterData.stats` | 現在職業・ランク補正などを反映した、戦闘で参照・更新するランタイムステータス |
| `CharacterData.baseStats` | 職業変更、レベル成長、永続成長の計算元 |

BattleEngineが `baseStats` へフォールバックすると、戦闘中HPの更新先が曖昧になり、職業補正や成長計算元を誤って現在HPとして扱うリスクがある。

## 3. 設計方針

### 3.1 BattleEngineの入力契約

BattleEngineは正規化済みの `CharacterData` のみを受け取る。

- `stats` は必須。
- 戦闘中のプレイヤーHP更新は `stats.hp` のみに反映する。
- `baseStats` はBattleEngineではHP更新対象にしない。
- DBレコードや旧形式データからの補完は `GameManager.convertToCharacterData()` や `JobService` などの変換層で行う。

### 3.2 実装修正

`getMutableStats()` は `player.stats` を直接返す。

```ts
private getMutableStats(player: CharacterData): BaseStats {
  return player.stats;
}
```

これにより、`CharacterData` の型定義とBattleEngineの実行時契約が一致する。

### 3.3 非対応範囲

今回のBUG-7では以下は変更しない。

| 項目 | 理由 |
|---|---|
| `CharacterData.baseStats` の廃止 | 職業変更・成長計算で必要 |
| DB変換層の大規模変更 | 既に `stats` を構築してBattleEngineへ渡している |
| プレイヤーHPの専用ランタイムマップ化 | 別設計で扱うべき大きな変更 |

## 4. テスト方針

`src/logic/BattleEngine.test.ts` に、戦闘中HPが `stats.hp` にだけ反映され、`baseStats.hp` を触らないことを確認する回帰テストを追加する。

| テスト | 確認内容 |
|---|---|
| プレイヤーランタイムHP更新 | 敵反撃で `player.stats.hp` が0になり、`player.baseStats.hp` は維持される |

## 5. 完了条件

- `BattleEngine.ts` から `getMutableStats()` の `as any` が消えている。
- BattleEngineのプレイヤーHP更新先が `CharacterData.stats` に固定されている。
- BattleEngine単体テスト、全Jest、型検査、ビルドが成功する。
