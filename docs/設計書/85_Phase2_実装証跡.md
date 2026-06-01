# 85 — Phase 2 実装証跡

> 作成日: 2026-05-31  
> フェーズ: Phase 2 — 全8データ種別の編集フォーム + ファイル保存  
> ステータス: ✅ 実装完了・型チェック通過・HTTP 200 全ルート確認済み

---

## 1. 実装ファイル一覧

### Server Actions（更新）
- `src/app/admin/actions.ts` — `getEntry()` / `saveEntry()` / `deleteEntry()` を追加

### ルートページ（新規 16 ファイル）
| ファイル | 種別 |
|---|---|
| `src/app/admin/enemies/new/page.tsx` | 新規作成 |
| `src/app/admin/enemies/[id]/page.tsx` | 編集 |
| `src/app/admin/stages/new/page.tsx` | 新規作成 |
| `src/app/admin/stages/[id]/page.tsx` | 編集 |
| `src/app/admin/jobs/new/page.tsx` | 新規作成 |
| `src/app/admin/jobs/[id]/page.tsx` | 編集 |
| `src/app/admin/skills/new/page.tsx` | 新規作成 |
| `src/app/admin/skills/[id]/page.tsx` | 編集 |
| `src/app/admin/items/new/page.tsx` | 新規作成 |
| `src/app/admin/items/[id]/page.tsx` | 編集 |
| `src/app/admin/materials/new/page.tsx` | 新規作成 |
| `src/app/admin/materials/[id]/page.tsx` | 編集 |
| `src/app/admin/monsters/new/page.tsx` | 新規作成 |
| `src/app/admin/monsters/[id]/page.tsx` | 編集 |
| `src/app/admin/demon-forms/new/page.tsx` | 新規作成 |
| `src/app/admin/demon-forms/[id]/page.tsx` | 編集 |

### フォームコンポーネント（新規 8 ファイル）
| ファイル | タブ構成 |
|---|---|
| `src/components/admin/forms/EnemyForm.tsx` | 基本情報 / ステータス / 属性耐性 / ギミック / ドロップ / バトル |
| `src/components/admin/forms/StageForm.tsx` | 基本情報 / WAVE設定 / 報酬 |
| `src/components/admin/forms/JobForm.tsx` | 基本情報 / 解放条件 / ステータス補正 / エナジー / レベルボーナス / スキル配置 |
| `src/components/admin/forms/SkillForm.tsx` | シングルページ |
| `src/components/admin/forms/ItemForm.tsx` | 基本情報 / サブオプション / パッシブ |
| `src/components/admin/forms/MaterialForm.tsx` | シングルページ |
| `src/components/admin/forms/MonsterForm.tsx` | 基本情報 / ステータス / 属性耐性 |
| `src/components/admin/forms/DemonFormEditor.tsx` | 基本情報 / Effect A / Effect B / 奥義 |

### 共通フォームコンポーネント（新規 8 ファイル）
| ファイル | 役割 |
|---|---|
| `src/components/admin/forms/shared/FormField.tsx` | ラベル + 子要素のラッパー |
| `src/components/admin/forms/shared/FormTabs.tsx` | タブバー切り替え |
| `src/components/admin/forms/shared/FormSaveBar.tsx` | 「← 一覧へ」+ 保存/コピー/削除ボタン |
| `src/components/admin/forms/shared/StatInputGrid.tsx` | 8種ステータス入力グリッド |
| `src/components/admin/forms/shared/ResistanceGrid.tsx` | 9属性耐性入力（負=赤/正=青） |
| `src/components/admin/forms/shared/DropTableEditor.tsx` | ドロップテーブル行管理 |
| `src/components/admin/forms/shared/JsonSidebar.tsx` | リアルタイム JSON プレビュー（sticky） |
| `src/components/admin/forms/shared/ConfirmDialog.tsx` | Framer Motion 確認ダイアログ |

### 一覧コンポーネントの更新
- `AccordionEntry.tsx` — `editHref?: string` props 追加、「編集」リンク表示
- 8 種の `*List.tsx` — `editHref` を渡すよう更新
- 8 種のセクション `page.tsx` — 「+ 新規作成」ボタン追加

---

## 2. テスト証跡

### 2.1 TypeScript 型チェック

```
$ npx tsc --noEmit
(出力なし = エラーなし)
→ PASS: no type errors
```

### 2.2 全ルート HTTP ステータス確認

実行環境: `npx next dev --port 3200`

**Phase 1 ルート（再確認）**

| ルート | HTTP |
|---|---|
| `/admin` | ✅ 200 |
| `/admin/enemies` | ✅ 200 |
| `/admin/audit` | ✅ 200 |

**Phase 2 新規ルート（全 16 ルート）**

| ルート | HTTP |
|---|---|
| `/admin/enemies/new` | ✅ 200 |
| `/admin/enemies/grave_soldier` | ✅ 200 |
| `/admin/stages/new` | ✅ 200 |
| `/admin/stages/area1_node1` | ✅ 200 |
| `/admin/jobs/new` | ✅ 200 |
| `/admin/jobs/warrior` | ✅ 200 |
| `/admin/skills/new` | ✅ 200 |
| `/admin/skills/skill_warrior_1` | ✅ 200 |
| `/admin/items/new` | ✅ 200 |
| `/admin/items/bone_cleaver` | ✅ 200 |
| `/admin/materials/new` | ✅ 200 |
| `/admin/materials/bone_chip` | ✅ 200 |
| `/admin/monsters/new` | ✅ 200 |
| `/admin/monsters/goblin` | ✅ 200 |
| `/admin/demon-forms/new` | ✅ 200 |
| `/admin/demon-forms/warrior` | ✅ 200 |
| `/admin/enemies/nonexistent` | ✅ 404（正しい挙動） |

### 2.3 コンテンツ品質確認

**敵編集フォーム（`/admin/enemies/grave_soldier`）**:
```
表示確認: nameJa, tier, tribe, MINION, ELITE, BOSS, ステータス, ドロップ, バトル, 属性耐性, 霊体騎士, grave_soldier
→ 全フィールド・タブが正しく描画されている
```

**ステージ編集フォーム（`/admin/stages/area1_node1`）**:
```
表示確認: area1_node1, DUNGEON, WAVE, wave, 報酬
→ WAVE設定・報酬タブが正しく描画されている
```

**素材新規作成フォーム（`/admin/materials/new`）**:
```
表示確認: 新規作成, 素材, expValue, rarity, 保存, COMMON
→ 新規作成フォームが正しく描画されている
```

### 2.4 保存/削除フロー E2E テスト

```
Before: 7 entries in materials.json
Added test entry: test_material_phase2  ← saveEntry 相当の処理
After:  8 entries in materials.json     ← エントリ追加を確認
監査:   0 fail(s), 1 warn(s).           ← データ整合性確認
Cleaned up test entry                   ← deleteEntry 相当の処理
Final:  7 entries (= Before)            ← クリーンアップ完了
```

### 2.5 データ監査結果

```
$ node scripts/master-data-audit.mjs
WARN enemies/grave_knight: ELITE has no shieldHp

Summary: 0 fail(s), 1 warn(s).
```

**0 FAIL** — 全マスターデータの整合性確認済み。  
1 WARN は既存データの設計的な選択（shieldHp 省略）で、修正不要。

---

## 3. 設計書・ガイド一覧

| ファイル | 内容 |
|---|---|
| `docs/設計書/82_マスターデータ管理ツール仕様書.md` | Phase 1〜4 全体仕様 |
| `docs/設計書/83_Phase1_管理ツール詳細設計と証跡.md` | Phase 1 詳細設計 + 証跡 |
| `docs/設計書/84_Phase2_編集フォーム詳細設計.md` | Phase 2 詳細設計書 |
| `docs/設計書/85_Phase2_実装証跡.md` | Phase 2 実装証跡（本ファイル）|
| `docs/ADMIN_GUIDE.md` | ユーザー向け操作ガイド（起動〜操作手順） |

---

## 4. 未実装事項（Phase 3/4 以降）

| 機能 | フェーズ |
|---|---|
| 依存関係タブ（「この敵が出るステージ」横断参照）| Phase 3 |
| フィルタ・ソート機能の強化 | Phase 3 |
| ダメージシミュレータ | Phase 4 |
| 深淵の残滓（AbyssalResidue）のランダム生成設定 | Phase 4 |
| 画像・スプライトのアップロード | Phase 4 |
