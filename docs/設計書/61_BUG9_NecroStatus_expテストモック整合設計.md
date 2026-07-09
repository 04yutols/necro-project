# BUG-9 NecroStatus.exp テストモック整合設計

> 作成日: 2026-05-26
> 対象: `src/services/NecroService.test.ts`, `src/types/game.ts`, `src/services/NecroService.ts`

## 1. 背景

`NecroStatus` は死霊術ランク・レベル・編成コスト・基礎ステータス倍率に加え、現在のネクロEXPを保持する正規クライアント状態である。

```ts
export interface NecroStatus {
  level: number;
  rank: number;
  maxCost: number;
  baseStatsBonus: number;
  exp: number;
}
```

しかし `src/services/NecroService.test.ts` のモックは `exp` 追加前の形のままで、`NecroStatus` としては不完全だった。

## 2. 問題

```ts
const mockNecroStatus: NecroStatus = {
  level: 1,
  rank: 1,
  maxCost: 10,
  baseStatsBonus: 1.0,
};
```

- `NecroStatus.exp` が必須なのに、テストモックが欠落している。
- 直書きモックが複数あるため、今後フィールド追加時に同じ欠落が再発しやすい。
- `performRankUp()` は `exp: 0` を返しているが、その仕様をテストで明示していない。

## 3. 設計方針

### 3.1 NecroStatusの正規形

テストでも本番と同じ `NecroStatus` の正規形を使う。

| フィールド | テスト既定値 | 備考 |
|---|---:|---|
| `level` | 1 | 1〜99 |
| `rank` | 1 | 1〜10 |
| `maxCost` | 10 | 初期編成コスト |
| `baseStatsBonus` | 1.0 | 初期倍率 |
| `exp` | 0 | 現在ネクロEXP |

### 3.2 テストファクトリ化

`NecroService.test.ts` に `createNecroStatus()` を置き、全テストがこのファクトリから `NecroStatus` を生成する。

```ts
const createNecroStatus = (overrides: Partial<NecroStatus> = {}): NecroStatus => ({
  level: 1,
  rank: 1,
  maxCost: 10,
  baseStatsBonus: 1.0,
  exp: 0,
  ...overrides,
});
```

これにより、今後 `NecroStatus` の必須フィールドが増えた場合、修正点をファクトリに集約できる。

### 3.3 RankUp時のEXP

`NecroService.performRankUp(status, true)` はランクアップ後に以下を返す。

| 項目 | 仕様 |
|---|---|
| `level` | 1へリセット |
| `rank` | +1、最大10 |
| `maxCost` | +5 |
| `baseStatsBonus` | +0.5 |
| `exp` | 0へリセット |

今回のテストでは `exp: 999` の入力から `exp: 0` へ戻ることを明示する。

## 4. 実装

- `mockNecroStatus` の直書きを `createNecroStatus()` に置き換える。
- RankUp成功テストは `createNecroStatus({ level: 99, exp: 999 })` を使う。
- RankUp成功テストで `nextStatus.exp === 0` を検証する。
- Lv不足テストも `createNecroStatus({ level: 98 })` を使う。

## 5. 完了条件

- `NecroService.test.ts` 内の `NecroStatus` モックがすべて `exp` を持つ。
- RankUp後に `exp` が0へリセットされることをテストで保証する。
- `NecroService` 単体テスト、テストファイル型検査、全Jest、型検査、ビルドが成功する。
