---
name: data-author
description: Necromance Brave のマスターデータ JSON オーサリング。エネミー・ステージ・武器・スキル・職業・魔神形態・ストーリーシーンのテキスト仕様を src/data/master/ の構造化 JSON に変換するときに使う
---

# Data Authoring Skill

Necromance Brave のマスターデータ JSON（`src/data/master/` の 9 ファイル）と
ストーリーデータ（`src/data/story/`）を正確に生成・保守するためのスキル。

## 対象ファイル

```
src/data/master/
  areas.json       エリア（章マップのノード群）
  demonForms.json  魔神化形態（キー = jobId）
  enemies.json     敵（MINION / ELITE / BOSS + necromance 設定）
  items.json       武器 + 消耗品
  jobs.json        職業（Tier1×4 + Tier2×8、レベル別基礎ステータス）
  materials.json   残滓強化素材
  monsters.json    味方モンスター（初期テンプレート）
  skills.json      スキル
  stages.json      ステージ（WAVE 構成 + 報酬）
src/data/story/
  ch1_scenes.json, prologue_scenes.json, characters.json
```

## Workflow Decision Tree

1. **何を追加する？**
   - **エネミー/ボス?** → `references/workflows.md#新しいボス戦の追加`
   - **ステージ?** → `references/workflows.md#新しいボス戦の追加`（Stage セクション）
   - **武器?** → `references/workflows.md#新しい武器の作成`
   - **スキル?** → `/skill-design` コマンドのガイドラインに従う（設計書19参照）
   - **ストーリーシーン?** → `references/schemas.md#10-src-data-story`
2. **依存関係は？**
   - `references/cross_references.md` で参照先 ID が実在することを確認。
3. **バランスは？**
   - `references/schemas.md#stats-criteria` の HP / Shield レンジに従う。

## Guidelines

- **キー対称性**: master JSON はキー付きオブジェクト。`id` フィールドを持つファイル
  （enemies, items, stages, skills, materials, areas）はキーと `id` を一致させる。
  jobs / monsters / demonForms は **キーが ID**（オブジェクト内に `id` なし。
  demonForms はキー = `jobId`）。story の scenes は **配列**で、この規則の対象外。
- **言語**: enemies / stages / areas は `nameJa` + `nameEn`（UI 用 nameEn は大文字）。
  items / skills / materials は日本語 `name` のみ。
- **精度**: 入力が曖昧なら `references/schemas.md` の基準に従う。ボスのギミック種別など
  重要な意図が欠けている場合はユーザーに確認する。

## Resources

- **[references/schemas.md](references/schemas.md)**: 全 9 ファイルのフィールド定義とステータス基準。
- **[references/cross_references.md](references/cross_references.md)**: ID 参照関係マップ。
- **[references/workflows.md](references/workflows.md)**: よくある作業の手順書。

## Validation

JSON 生成後は必ず:
1. `/validate-master` コマンド（または同等の node ワンライナー）で相互参照を検証。
2. `npx tsc --noEmit` で型整合を確認（master JSON は型付き import される）。
3. ID 衝突・末尾カンマ・参照切れがないこと。
4. テストは master JSON を直接読むため、`git diff src/data/master` が CI でチェックされる
   （テストがマスターデータを書き換えていないか）。
