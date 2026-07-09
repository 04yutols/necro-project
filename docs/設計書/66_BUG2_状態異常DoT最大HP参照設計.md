# 66 — BUG-2 状態異常DoT最大HP参照設計

> 対象: `src/logic/BattleEngine.ts` / `src/logic/StatusAilmentSystem.ts`  
> 対応日: 2026-05-27  
> 関連: `docs/progress/BUGS_AND_SECURITY.md` / `docs/progress/IMPROVEMENTS.md` の `BUG-2`

---

## 1. 背景

状態異常のうち、POISON と BURN は最大HP割合ダメージとして設計されている。

| 状態異常 | ダメージ |
|---|---|
| POISON | 最大HPの3% |
| BURN | 最大HPの5% |
| BLEED | 付与元ATKの5%をスタックごとに加算 |

`StatusAilmentSystem.processStatusEffects()` 自体は `target.maxHp` を受け取って割合ダメージを計算する純粋関数であり、問題は `BattleEngine` 側が渡す `maxHp` にあった。

---

## 2. 問題

旧実装:

```typescript
const result = processStatusEffects(
  effects,
  { maxHp: targetStats.hp },
  Math.random,
);
```

`targetStats.hp` はバトル中の現在HPとして直接減少する。つまり、HP1000のプレイヤーがHP100まで削られた後に POISON を受けると、本来30ダメージのところ3ダメージになる。

この挙動は以下の問題を生む。

| 観点 | 問題 |
|---|---|
| ゲームバランス | 毒・燃焼が終盤ほど軽くなり、割合DoTとして機能しない。 |
| 表示整合 | UIや設計書上は最大HP割合なのに、実際は現在HP割合に近い動作になる。 |
| 敗北判定 | BUG-1で状態異常ダメージを敗北判定へ接続したが、DoT量が過小になり致死タイミングがずれる。 |
| 将来拡張 | 敵状態異常処理を追加する際にも、現在HPを渡すと同じバグが再発する。 |

---

## 3. 設計方針

### 3.1 `processStatusEffects()` は変更しない

`StatusAilmentSystem` は `maxHp` を受け取る純粋関数として正しい。責務は「渡された最大HPを基準にDoTを計算する」ことであり、BattleEngine内のランタイムHP管理を知らない。

### 3.2 BattleEngineが最大HPを明示して渡す

プレイヤーについては、BattleEngine constructor で保持している `playerInitialMaxHp` を状態異常処理に渡す。

```typescript
const playerStatus = this.processRuntimeStatus(
  player.name,
  player.stats,
  player.statusEffects,
  this.playerInitialMaxHp,
);
```

### 3.3 汎用化の余地を残す

`processRuntimeStatus()` の引数に `targetMaxHp` を追加する。現在はプレイヤー状態異常処理からのみ呼ばれているが、敵ターン開始状態異常を追加する場合は `this.getEnemyMaxHp(enemy)` を渡せる。

```typescript
private processRuntimeStatus(
  targetName: string,
  targetStats: BaseStats,
  effects: StatusEffect[] | undefined,
  targetMaxHp: number,
)
```

---

## 4. 実装詳細

### 4.1 変更前

```typescript
const result = processStatusEffects(
  effects,
  { maxHp: targetStats.hp },
  Math.random,
  isPlayer ? { immuneTypes: this.synergyBonus.ailmentImmune as AilmentType[] } : undefined,
);
```

### 4.2 変更後

```typescript
const result = processStatusEffects(
  effects,
  { maxHp: targetMaxHp },
  Math.random,
  isPlayer ? { immuneTypes: this.synergyBonus.ailmentImmune as AilmentType[] } : undefined,
);
```

プレイヤー呼び出し側:

```typescript
this.processRuntimeStatus(
  player.name,
  player.stats,
  player.statusEffects,
  this.playerInitialMaxHp,
);
```

---

## 5. テスト設計

### 5.1 回帰テスト

`BattleEngine.test.ts` に以下を追加する。

| ケース | 期待 |
|---|---|
| バトル開始最大HP1000、現在HP100のプレイヤーにPOISON | DoTは `100 * 0.03 = 3` ではなく `1000 * 0.03 = 30` |
| DoT後の現在HP | `100 - 30 = 70` |
| 味方モンスターが生存 | 敵反撃がプレイヤーに入らず、DoT後HPを検証できる |

### 5.2 既存テスト

| テスト | 意図 |
|---|---|
| `lethal player status damage stops the action` | DoTでHP0到達時に行動停止と敗北ログが出る |
| `StatusAilmentSystem.test.ts` | `processStatusEffects()` 自体は渡された `maxHp` で割合DoTを計算する |

---

## 6. 対象外

- 敵ターン開始時の状態異常処理の新規追加。
- BURN / POISON の倍率調整。
- `playerInitialMaxHp` の装備変更中再計算。
- UI側の状態異常表示調整。

---

## 7. 完了条件

- `BattleEngine.processRuntimeStatus()` が現在HPを `maxHp` として渡さない。
- プレイヤーDoTが `playerInitialMaxHp` 基準で計算される。
- `BattleEngine.test.ts` の回帰テストが通る。
- `npx tsc --noEmit` / 全体 Jest / production build が通る。
