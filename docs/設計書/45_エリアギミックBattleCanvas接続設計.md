# 45. エリアギミック BattleCanvas 接続設計

## 目的

`StageData.areaGimmick` に設定されたエリアギミックを、実際の `BattleCanvas` 戦闘進行へ接続する。

対象ギミックは以下。

- `SLIP_DAMAGE`: 手番開始時に現在HPの5%ダメージ
- `STATUS_AILMENT`: 手番開始時に確定で毒を付与
- `NONE`: ギミックなし

## 現状の問題

`BattleEngine` には `processAreaGimmick()` があり、スリップダメージと毒沼処理を持っていた。  
一方、実際に画面でプレイされる `BattleCanvas` は独自の戦闘フローを持つため、ステージにギミックが設定されても何も起きなかった。

## 適用タイミング

BattleEngine の実装と揃え、プレイヤー手番開始時、つまりコマンド実行直前に処理する。

```text
プレイヤーが攻撃 / 術 / アイテム / 魔神技を選択
  -> エリアギミック処理
  -> プレイヤー状態異常の継続ダメージ / 行動阻害処理
  -> 実際のアクション実行
```

この順序により、`STATUS_AILMENT` で付与された毒は同じ手番で継続ダメージ処理へ流れる。  
魔神化中は毒付与を無効化するが、`SLIP_DAMAGE` は地形ダメージとして受ける。

## ギミック仕様

### SLIP_DAMAGE

```text
rawDamage = floor(currentHp * 0.05)
damage = floor(rawDamage * (1 - defenseReducePct / 100))
nextHp = max(0, currentHp - damage)
```

`defenseReducePct` は種族シナジーの軽減値を参照する。

### STATUS_AILMENT

```text
if demonMode:
  immune = true
else:
  applyStatusEffect(POISON, sourceAtk = 0)
```

エリア由来の毒は通常の効果命中 / 効果抵抗判定を使わず、確定付与とする。  
魔神化は状態異常免疫として扱うため、付与自体を防ぐ。

## データフロー

```text
src/data/master/stages.json
  -> StageData.areaGimmick
  -> resolveStageAreaGimmick(stage)
  -> BattleCanvas.areaGimmick
  -> applyAreaGimmickToPlayer()
  -> playerHp / playerStatusEffects / Battle Log / HUD Badge
```

`BattleEngine.processAreaGimmick()` も同じ `applyAreaGimmickToPlayer()` を使うことで、画面戦闘とロジック戦闘の式を揃える。

## UI/UX

- ギミックありステージでは、戦闘開始ログにギミック名と説明を表示する。
- 画面上部 HUD にギミックバッジを表示する。
- スリップダメージ時はプレイヤー上にダメージ表示を出し、画面を薄くフラッシュする。
- 毒沼で毒を受けた場合はログに表示し、既存の状態異常アイコン表示へ流す。
- 魔神化で無効化した場合もログへ表示し、プレイヤーが免疫の価値を理解できるようにする。

## 実装ファイル

- `src/types/game.ts`
  - `AreaGimmickType` と `StageData.areaGimmick` を追加。
- `src/logic/AreaGimmickSystem.ts`
  - ギミックメタ情報、ステージ解決、プレイヤー適用処理を追加。
- `src/components/battle/BattleCanvas.tsx`
  - ステージギミックを取得し、プレイヤー行動前処理へ接続。
  - HUD バッジとログ表示を追加。
- `src/logic/BattleEngine.ts`
  - 既存 `processAreaGimmick()` を共通ロジックへ接続。
- `src/data/master/stages.json`
  - 既存ステージへ `areaGimmick` を設定。

## テスト方針

- `SLIP_DAMAGE` が現在HPの5%を参照し、軽減値込みで HP を減らす。
- `STATUS_AILMENT` が毒を付与する。
- 魔神化中は `STATUS_AILMENT` を無効化する。
- マスターステージに有効な `areaGimmick` が設定されている。
