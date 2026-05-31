# 55. SEC-5 ドロップ率ボーナス critRate 分離設計

作成日: 2026-05-24
対象: `src/logic/GameManager.ts` / `src/services/RewardService.ts`
ステータス: 実装済み

---

## 1. 背景

旧 `GameManager.processStageResult()` は、戦闘ステータスである `Character.critRate` をドロップ率ボーナスとして `RewardService.processDropTable()` に渡していた。

```ts
const rewards = this.rewardService.processDropTable(stage.rewards.dropTable, char.critRate ?? 5);
```

`critRate` は会心発生率であり、報酬発見率ではない。たとえば `critRate = 50` のキャラクターが `rate = 0.68` のドロップを抽選すると、旧式では `0.68 * 1.5 = 1.02` となり、実質100%超のドロップ率になっていた。

---

## 2. 問題点

### 2.1 ステータス意味論の混線

`critRate` は `BattleDamage` / `BattleEngine` の会心判定に使う戦闘ステータスであり、報酬抽選に使ってはいけない。

ドロップ率上昇は、将来以下のような独立した `discoveryBonusRate` として計算する。

- 装備パッシブ
- イベント祝福
- 周回ボーナス
- 探索/鑑定系の専用効果

### 2.2 確率上限の欠落

`RewardService` は `entry.rate * multiplier` をそのまま使っていたため、最終確率が1.0を超える可能性があった。

確率として扱う値は必ず `0.0 <= adjustedRate <= 1.0` に丸める。

---

## 3. 対応方針

### 3.1 GameManager

旧 `GameManager.processStageResult()` は専用発見ボーナスを持っていないため、`discoveryBonusRate` を渡さない。

```ts
const rewards = this.rewardService.processDropTable(stage.rewards.dropTable);
```

これにより `RewardService` のデフォルト値 `0` が使われ、`critRate` は報酬抽選に影響しない。

### 3.2 RewardService

将来の専用発見ボーナスに備え、最終ドロップ率を明示的にクランプする。

```ts
function clampDropRate(rate: number): number {
  return Math.max(0, Math.min(1, rate));
}

const adjustedRate = clampDropRate(entry.rate * multiplier);
if (roll >= adjustedRate) continue;
```

---

## 4. 非対象

今回の修正では新しい `discoveryBonusRate` の算出元は追加しない。

理由:

- 現在のDBスキーマに専用発見ステータスがない。
- 既存装備パッシブに報酬発見率の正式仕様がない。
- 仮の別ステータスを増やすと、再び意味論が曖昧になる。

必要になった時点で、装備/祝福/イベントから `discoveryBonusRate` を集約する専用関数を追加する。

---

## 5. テスト設計

### 5.1 RewardService

`src/services/RewardService.test.ts`

- `discoveryBonusRate` が効いても最終確率は100%で打ち止めになる。
- `roll = 1.0` の場合、`rate * multiplier > 1.0` でもドロップしない。
- 既存の `rate = 0.68 / discoveryBonusRate = 50 / roll = 0.99` は `adjustedRate = 1.0` としてドロップする。

### 5.2 GameManager

`src/logic/GameManager.test.ts`

- `critRate = 100` のキャラクターで `processStageResult()` を実行。
- `Math.random() = 0.99` のとき、`area1_node1` のドロップテーブルはすべて失敗する。
- 旧実装なら `critRate` ボーナスにより一部ドロップしていたため、回帰検知できる。

---

## 6. 完了条件

- `GameManager.processStageResult()` が `char.critRate` を `processDropTable()` に渡していない。
- `RewardService` の最終ドロップ率が `0..1` にクランプされる。
- `critRate` が高くてもドロップ率が変わらないテストがある。
- 専用テスト、全体テスト、TypeScriptチェック、本番ビルドが通る。
