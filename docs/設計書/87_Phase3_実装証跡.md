# 87 — Phase 3 実装証跡

> 作成日: 2026-05-31  
> フェーズ: Phase 3 — 依存関係タブ + フィルタ・ソート強化  
> ステータス: ✅ 実装完了・型チェック通過・HTTP 200 全ルート確認済み

---

## 1. 実装ファイル一覧

### Server Action（更新）
- `src/app/admin/actions.ts` — `DependencyRef` 型 + `getDependencies()` 追加

### 共通コンポーネント（新規 2 ファイル）
| ファイル | 役割 |
|---|---|
| `src/components/admin/forms/shared/DependenciesTab.tsx` | スコープ別依存関係一覧表示 + 「開く →」リンク |
| `src/components/admin/forms/shared/ListFilterBar.tsx` | テキスト検索・チップフィルタ・ソートキー共通バー |

### 編集ページ（8 件更新）— `getDependencies()` 追加
| ファイル | 変更内容 |
|---|---|
| `src/app/admin/enemies/[id]/page.tsx` | `getDependencies('enemies', id)` を Promise.all に追加 |
| `src/app/admin/stages/[id]/page.tsx` | 同上 |
| `src/app/admin/jobs/[id]/page.tsx` | 同上 |
| `src/app/admin/skills/[id]/page.tsx` | 同上 |
| `src/app/admin/items/[id]/page.tsx` | 同上 |
| `src/app/admin/materials/[id]/page.tsx` | 同上 |
| `src/app/admin/monsters/[id]/page.tsx` | 同上 |
| `src/app/admin/demon-forms/[id]/page.tsx` | 同上 |

### フォームコンポーネント（8 件更新）— 依存関係タブ追加
| ファイル | タブ追加方法 |
|---|---|
| `EnemyForm.tsx` | TABS 末尾に `'依存関係'` 追加 |
| `StageForm.tsx` | 同上 |
| `JobForm.tsx` | 同上 |
| `ItemForm.tsx` | 同上 |
| `MonsterForm.tsx` | 同上 |
| `DemonFormEditor.tsx` | 同上 |
| `SkillForm.tsx` | `FormTabs(['フォーム', '依存関係'])` を新規追加 |
| `MaterialForm.tsx` | 同上 |

### 一覧コンポーネント（8 件更新）— フィルタ・ソート追加
| ファイル | 追加したフィルタ | ソートキー |
|---|---|---|
| `EnemiesList.tsx` | Tier × Tribe + テキスト | HP / ATK / DEF / SPD |
| `SkillsList.tsx` | Element × Target × Type + テキスト | power / MP |
| `JobsList.tsx` | Tier × Category + テキスト | Tier |
| `ItemsList.tsx` | Rarity × Archetype + テキスト | rarity / rank |
| `MaterialsList.tsx` | Rarity + テキスト | expValue |
| `StagesList.tsx` | NodeType + テキスト | difficulty / chapter |
| `MonstersList.tsx` | Tribe × Cost + テキスト | HP / ATK / COST |
| `DemonFormsList.tsx` | Tier + テキスト | Tier |

---

## 2. テスト証跡

### 2.1 TypeScript 型チェック

```
$ npx tsc --noEmit
(出力なし = エラーなし)
→ PASS: no type errors
```

### 2.2 全ルート HTTP ステータス確認（8 編集ルート）

実行環境: `npx next dev --port 3200`

| ルート | HTTP |
|---|---|
| `/admin/enemies/grave_soldier` | ✅ 200 |
| `/admin/skills/skill_warrior_1` | ✅ 200 |
| `/admin/items/bone_cleaver` | ✅ 200 |
| `/admin/jobs/warrior` | ✅ 200 |
| `/admin/demon-forms/warrior` | ✅ 200 |
| `/admin/stages/area1_node1` | ✅ 200 |
| `/admin/materials/bone_chip` | ✅ 200 |
| `/admin/monsters/goblin` | ✅ 200 |
| `/admin/enemies` | ✅ 200 |

### 2.3 依存関係ロジック検証（Node.js スクリプト）

```
$ node /tmp/test-deps.mjs

grave_soldier in stages: PASS (4 refs)
  stages/area1_node1: 王都外縁の墓道 (WAVE 1 · WARMUP)
  stages/area1_node1: 王都外縁の墓道 (WAVE 3 · ELITE)
  stages/area1_node2: 煤けた王城の地下牢 (WAVE 1 · WARMUP)
  stages/area2_gate: 幽霊都市の城門 (WAVE 1 · WARMUP)

skill_warrior_1 in jobs: PASS (1 refs)
  jobs/warrior: 剣士 (Lv1 解放)

bone_cleaver drop refs: PASS (8 refs)
  enemies/grave_soldier: 霊体騎士 (ドロップ率 42%)
  enemies/rot_hound: 腐敗猟犬 (ドロップ率 35%)
  enemies/hollow_handmaid: 廃城の侍女 (ドロップ率 38%)
  enemies/bloodmire_leech: 血沼の蛭 (ドロップ率 30%)
  enemies/grave_knight: 霊体騎士長 (ドロップ率 45%)
  stages/area1_node1: 王都外縁の墓道 (ステージ報酬 55%)
  stages/area1_node2: 煤けた王城の地下牢 (ステージ報酬 45%)
  stages/area1_boss: 竜骨祭壇 (ステージ報酬 62%)

warrior demon forms: PASS (1 refs)
  demonForms/warrior: 黒翼の剣聖 (魔神化フォーム)

demonForm warrior -> job: PASS (jobId=warrior, displayName=剣士)

area1_node1 unlock required by: 1 stages
  area1_node2: 煤けた王城の地下牢

goblin monster refs: PASS (always empty - no cross-refs)

=== All dependency logic tests PASSED ===
```

---

## 3. 設計書・ガイド一覧

| ファイル | 内容 |
|---|---|
| `docs/設計書/82_マスターデータ管理ツール仕様書.md` | Phase 1〜4 全体仕様 |
| `docs/設計書/83_Phase1_管理ツール詳細設計と証跡.md` | Phase 1 詳細設計 + 証跡 |
| `docs/設計書/84_Phase2_編集フォーム詳細設計.md` | Phase 2 詳細設計書 |
| `docs/設計書/85_Phase2_実装証跡.md` | Phase 2 実装証跡 |
| `docs/設計書/86_Phase3_詳細設計.md` | Phase 3 詳細設計書 |
| `docs/設計書/87_Phase3_実装証跡.md` | Phase 3 実装証跡（本ファイル）|
| `docs/ADMIN_GUIDE.md` | ユーザー向け操作ガイド |

---

## 4. Phase 3.1 修正: StageForm 敵ID紐付け

### 問題
Phase 3 実装後、`StageForm` の WAVE設定タブで `enemyIds` がフリーテキスト入力（カンマ区切り文字列）になっており `enemies.json` との紐付けが不完全だった。

### 修正内容

**型修正**: `WaveRow.enemyIds: string` → `WaveRow.enemyIds: string[]`

**ページ更新**:
- `src/app/admin/stages/[id]/page.tsx` — `getMasterFile('enemies')` を追加、`enemyData` を生成して渡す
- `src/app/admin/stages/new/page.tsx` — 同上

**UI修正**: `StageForm.tsx`
- フリーテキスト入力 → チップ型マルチセレクト
- 全敵エントリを TIER バッジ + 日本語名 + ID で一覧表示
- クリックでトグル（選択→紫チップ / 未選択→グレー）
- 選択中の敵IDを下部に一覧表示

### テスト結果

```
$ npx tsc --noEmit
(エラーなし)

ルート確認:
GET /admin/stages/area1_node1 200
GET /admin/stages/new         200
GET /admin/stages/area1_boss  200

敵ID整合性検証:
Valid enemy ID references: 22
Invalid references: 0
→ ALL PASS
```

---

## 5. 未実装事項（Phase 4 以降）

| 機能 | フェーズ |
|---|---|
| ダメージシミュレータ（BattleEngine 統合）| Phase 4 |
| 深淵の残滓（AbyssalResidue）管理 | Phase 4 |
| 画像・スプライトのアップロード | Phase 4 |
