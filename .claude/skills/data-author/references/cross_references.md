# データ相互参照マップ

データを追加・変更するとき、参照先 ID が必ず実在することを確認する。

## src/data/master/ 内

| Source File | Field | Target File | Target |
|---|---|---|---|
| `stages.json` | `waves[].enemyIds[]` | `enemies.json` | キー / `id` |
| `stages.json` | `unlockRequires[]` | `stages.json` | キー / `id` |
| `stages.json` | `rewards.dropTable[].itemId` | `items.json` または `materials.json` | キー / `id` |
| `stages.json` | `rewards.dropTable[].monsterId` | `monsters.json` | キー |
| `stages.json` | `(chapter, area)` の組 | `areas.json` | `chapter` + `area` |
| `enemies.json` | `dropTable[].itemId` | `items.json` または `materials.json` | キー / `id` |
| `enemies.json` | `dropTable[].monsterId` | `monsters.json` | キー |
| `enemies.json` | `necromance.skillIds[]` | `skills.json` | キー / `id` |
| `jobs.json` | `skills[].skillId` | `skills.json` | キー / `id` |
| `jobs.json` | `unlock.jobs[].jobId` | `jobs.json` | キー |
| `jobs.json` | `unlock.clearedStageId` | `stages.json` | キー / `id` |
| `demonForms.json` | キー / `jobId` | `jobs.json` | キー（全12職業と 1:1） |

## src/data/story/ → master

| Source File | Field | Target File | Target |
|---|---|---|---|
| `ch1_scenes.json` | `trigger.stageId` / `trigger.bossStageId` | `stages.json` | キー / `id` |
| `ch1_scenes.json` | `lines[].speaker` | `characters.json` (story/) | `id` |

## 検証手順

1. **ID 一貫性**: `id` フィールドを持つファイル（enemies / items / stages / skills /
   materials / areas）はオブジェクト内 `id` と JSON キーの一致を確認する。
   jobs / monsters / demonForms はキー自体が ID。
2. **参照整合性**: dropTable に追加したアイテムは items.json か materials.json に
   必ず存在すること。
3. **トリガー検証**: ストーリーシーンの `stageId` が存在し、意図したトリガー地点であること。
4. **座標チェック**: stages.json の `position` (x, y) が AreaMap 上で既存ノードと
   重ならないこと。
5. **一括検証**: `/validate-master` コマンドで上記を自動チェックできる。
