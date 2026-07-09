# BUG-5 BURN免疫チェック設計

> 作成日: 2026-05-25
> 対象: `src/logic/StatusAilmentSystem.ts`, `src/logic/StatusAilmentSystem.test.ts`

## 1. 背景

`processStatusEffects()` はターン開始時の状態異常処理を一括で行い、`options.immuneTypes` に含まれる状態異常の持続ダメージを無効化する。

既存実装では BLEED と POISON は免疫対象ならダメージ0になる一方、BURN は `target.maxHp * 0.05` を常に与えていた。そのため、燃焼免疫を持つ装備・種族シナジー・ギミックが追加された場合でも、BURN の持続ダメージだけが貫通してしまう。

## 2. 問題

```ts
if (effect.type === 'POISON') {
  damage = options?.immuneTypes?.includes('POISON') ? 0 : Math.floor(target.maxHp * 0.03);
}
if (effect.type === 'BURN') damage = Math.floor(target.maxHp * 0.05);
```

- `BURN` が `immuneTypes` を参照していない。
- `BLEED` / `POISON` / `BURN` の DoT 免疫契約が状態異常ごとに分散している。
- 将来的に `AilmentType` が追加された際、同じ漏れが再発しやすい。

## 3. 設計方針

### 3.1 DoT免疫の契約

`processStatusEffects(effects, target, rng, { immuneTypes })` における免疫は以下を意味する。

| 対象 | 仕様 |
|---|---|
| BLEED | ダメージを0にする。スタック残りターンは通常通り減る |
| POISON | ダメージを0にする。残りターンは通常通り減る |
| BURN | ダメージを0にする。残りターンは通常通り減る |
| FREEZE / PARALYSIS | 現時点では `immuneTypes` によるスキップ無効化は扱わない |
| WEAKEN | 攻撃倍率補正は `getAilmentAttackMultiplier()` の責務として維持する |

免疫は「状態異常が自然経過するが、該当するターン開始時効果は発生しない」扱いにする。これにより、敵・プレイヤー双方で、免疫が一時バフや装備効果から与えられても状態管理が破綻しない。

### 3.2 付与免疫との分離

状態異常の付与そのものを防ぐ免疫は `tryApplyAilment(..., { immune: true })` が扱う。

今回のBUG-5では、すでに付与済みの BURN がターン開始時にダメージを出す問題を修正するため、`processStatusEffects()` の持続効果処理のみを変更する。

## 4. 実装

### 4.1 共通免疫フラグ

各 `effect` の処理冒頭で `effect.type` を基準に免疫判定を1回だけ行う。

```ts
const isImmune = options?.immuneTypes?.includes(effect.type) ?? false;
```

### 4.2 BURNへの適用

BURN は POISON と同じく、免疫時にダメージ0へ分岐する。

```ts
if (effect.type === 'BURN') damage = isImmune ? 0 : Math.floor(target.maxHp * 0.05);
```

### 4.3 既存挙動の維持

- BURN の基礎ダメージは最大HPの5%のまま。
- BURN の持続は2ターンのまま。
- 免疫時も残りターンは通常通り減る。
- ダメージ0の tick は出さない。UI側は不要な0ダメージ演出を出さない。

## 5. テスト方針

`src/logic/StatusAilmentSystem.test.ts` に以下の回帰テストを追加する。

| テスト | 確認内容 |
|---|---|
| BURN免疫 | `immuneTypes: ['BURN']` のとき `totalDamage=0`、BURNダメージtickなし、残りターンは減る |
| DoT免疫一貫性 | BLEED / POISON / BURN をすべて免疫にしたとき、合計ダメージ0で状態は自然経過する |

## 6. 完了条件

- BURN が `immuneTypes` を尊重する。
- BLEED / POISON / BURN のDoT免疫が同じ実装パターンになる。
- 状態異常単体テスト、全Jest、型検査、ビルドが成功する。
