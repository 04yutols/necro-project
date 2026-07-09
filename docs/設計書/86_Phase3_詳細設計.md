# 86 — Phase 3 詳細設計書

> 作成日: 2026-05-31  
> フェーズ: Phase 3 — 依存関係タブ + フィルタ・ソート強化  
> ステータス: 設計中

---

## 1. スコープ

Phase 2 で実装した 8 種別編集フォームと 8 種別一覧に、以下を追加する。

| 機能 | 詳細 |
|---|---|
| **依存関係タブ** | 各エントリに「このデータを参照しているエントリ」を横断表示するタブ |
| **フィルタ・ソート強化** | 各一覧にテキスト検索・チップフィルタ・ソートキーを追加 |

---

## 2. 依存関係タブ仕様

### 2.1 概念

```
/admin/enemies/grave_soldier を開いたとき →
  [依存関係] タブに以下が表示される:
  ■ stages / area1_node1 — 王都外縁の墓道  (WAVE 1 · WARMUP)
  ■ stages / area1_boss  — 呪縛の霊王廟    (WAVE 1 · WARMUP)
```

### 2.2 依存関係マッピング表

| エントリ種別 | スキャン対象 | 表示コンテキスト |
|---|---|---|
| `enemies` | `stages[].waves[].enemyIds` | `WAVE N (role)` |
| `skills` | `jobs[].skills[].skillId` | `Lv{level} 解放` |
| `items` | `enemies[].dropTable[].itemId` + `stages[].rewards.dropTable[].itemId` | `ドロップ率 N%` |
| `materials` | `enemies[].dropTable[].itemId` + `stages[].rewards.dropTable[].itemId` | `ドロップ率 N%` |
| `jobs` | `demonForms[].jobId` + `jobs[].unlockRequires[].jobId` | `魔神化フォーム` / `転職条件 LvN` |
| `stages` | `stages[].unlockRequires[]` | `解放条件として参照` |
| `monsters` | なし（現時点で参照なし） | — |
| `demonForms` | `demonForms[].jobId` → 対応職業 1件 | `対応職業` |

### 2.3 DependencyRef 型

```typescript
export type DependencyRef = {
  scope: string;      // 参照元のデータ種別（'stages', 'jobs' 等）
  id: string;         // 参照元エントリのキー
  label: string;      // 参照元の表示名（nameJa / displayName）
  href: string;       // /admin/{scope}/{id}
  context: string;    // 参照の文脈（'WAVE 1 · WARMUP' 等）
};
```

### 2.4 Server Action 追加

```typescript
// src/app/admin/actions.ts に追加
export async function getDependencies(
  fileKey: keyof MasterDataCollection,
  entryKey: string,
): Promise<DependencyRef[]>
```

### 2.5 フォームへの統合方法

各 `[id]/page.tsx`（編集ページ）で `getDependencies()` を呼び出し、
フォームコンポーネントへ `dependencies` props として渡す。

各フォームコンポーネントは末尾に `'依存関係'` タブを追加し、
`<DependenciesTab refs={dependencies} />` を表示する。

新規作成ページ（`/new`）では `dependencies` は空配列を渡す。

---

## 3. フィルタ・ソート強化仕様

### 3.1 共通 UI コンポーネント: ListFilterBar

```
┌─ [🔍 検索テキスト入力 ─────────────────────────────] [{count}/{total}件] ─┐
│  [ALL] [MINION] [ELITE] [BOSS]  |  [UNDEAD] [DEMON] ...                   │
│  ソート: [HP ▲] [ATK ▼] [DEF] [SPD]                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

Props:
```typescript
type FilterChip = { label: string; value: string; active: boolean; onClick: () => void };
type SortKey = { key: string; label: string };
type Props = {
  searchText: string;
  onSearchChange: (t: string) => void;
  filterGroups?: Array<{ chips: FilterChip[] }>;
  sortKeys?: SortKey[];
  activeSort?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void;
  count: number;
  total: number;
};
```

### 3.2 各一覧のフィルタ・ソート設計

#### EnemiesList

| 種別 | 内容 |
|---|---|
| フィルタ（Tier） | ALL / MINION / ELITE / BOSS |
| フィルタ（Tribe） | ALL / UNDEAD / DEMON / BEAST / HUMANOID / DRAGON / ORC |
| テキスト検索 | id・nameJa・name 部分一致 |
| ソートキー | HP / ATK / DEF / SPD（昇順・降順） |

#### SkillsList

| 種別 | 内容 |
|---|---|
| フィルタ（Element） | ALL + 9属性 |
| フィルタ（Target） | ALL / SINGLE / ALL_ENEMIES / ALL_ALLIES / SELF |
| フィルタ（Type） | ALL / PHYSICAL / MAGICAL |
| テキスト検索 | id・name 部分一致 |
| ソートキー | power（デフォルト降順） / mpCost |

#### ItemsList

| 種別 | 内容 |
|---|---|
| フィルタ（Rarity） | ALL / R / SR / SSR / UR |
| フィルタ（Archetype） | ALL / FAST / MID / HEAVY |
| テキスト検索 | id・name 部分一致 |
| ソートキー | rarity（SSR>SR>R） / rank |

#### StagesList

| 種別 | 内容 |
|---|---|
| フィルタ（NodeType） | ALL / SAFE / DUNGEON / BOSS |
| テキスト検索 | id・nameJa 部分一致 |
| ソートキー | difficulty / chapter |

#### JobsList

| 種別 | 内容 |
|---|---|
| フィルタ（Tier） | ALL / Tier1 / Tier2 |
| フィルタ（Category） | ALL / PHYSICAL / MAGICAL |
| テキスト検索 | id・displayName 部分一致 |
| ソートキー | tier asc（デフォルト） |

#### MaterialsList

| 種別 | 内容 |
|---|---|
| フィルタ（Rarity） | ALL / COMMON / RARE / EPIC |
| テキスト検索 | id・name 部分一致 |
| ソートキー | expValue（昇順・降順） |

#### MonstersList

| 種別 | 内容 |
|---|---|
| フィルタ（Tribe） | ALL + 6種族 |
| フィルタ（Cost） | ALL / 1 / 2 / 3 / 4 / 5 |
| テキスト検索 | id・name 部分一致 |
| ソートキー | HP / ATK / COST |

#### DemonFormsList

| 種別 | 内容 |
|---|---|
| フィルタ（Tier） | ALL / Tier1 / Tier2 |
| テキスト検索 | id・formName・jobId 部分一致 |
| ソートキー | tier asc（デフォルト） |

---

## 4. 実装ファイル一覧

### 新規ファイル

| ファイル | 役割 |
|---|---|
| `src/components/admin/forms/shared/DependenciesTab.tsx` | 依存関係一覧表示コンポーネント |
| `src/components/admin/forms/shared/ListFilterBar.tsx` | 汎用フィルタ・ソートバー |

### 変更ファイル

**Server Action:**
- `src/app/admin/actions.ts` — `getDependencies()` + `DependencyRef` 型を追加

**編集ページ（8件）— dependencies 取得 & props 渡し:**
- `src/app/admin/enemies/[id]/page.tsx`
- `src/app/admin/stages/[id]/page.tsx`
- `src/app/admin/jobs/[id]/page.tsx`
- `src/app/admin/skills/[id]/page.tsx`
- `src/app/admin/items/[id]/page.tsx`
- `src/app/admin/materials/[id]/page.tsx`
- `src/app/admin/monsters/[id]/page.tsx`
- `src/app/admin/demon-forms/[id]/page.tsx`

**フォームコンポーネント（8件）— 依存関係タブ追加:**
- `src/components/admin/forms/EnemyForm.tsx`
- `src/components/admin/forms/StageForm.tsx`
- `src/components/admin/forms/JobForm.tsx`
- `src/components/admin/forms/SkillForm.tsx`
- `src/components/admin/forms/ItemForm.tsx`
- `src/components/admin/forms/MaterialForm.tsx`
- `src/components/admin/forms/MonsterForm.tsx`
- `src/components/admin/forms/DemonFormEditor.tsx`

**一覧コンポーネント（8件）— フィルタ・ソート追加:**
- `src/components/admin/EnemiesList.tsx`
- `src/components/admin/StagesList.tsx`
- `src/components/admin/JobsList.tsx`
- `src/components/admin/SkillsList.tsx`
- `src/components/admin/ItemsList.tsx`
- `src/components/admin/MaterialsList.tsx`
- `src/components/admin/MonstersList.tsx`
- `src/components/admin/DemonFormsList.tsx`

---

## 5. テスト計画

### 5.1 TypeScript 型チェック
```
npx tsc --noEmit → エラー 0 件
```

### 5.2 依存関係タブ確認（手動）

| テストケース | 期待結果 |
|---|---|
| `/admin/enemies/grave_soldier` → 依存関係タブ | `area1_node1`, `area1_node2`, `area1_boss` などが表示される |
| `/admin/skills/skill_warrior_1` → 依存関係タブ | `warrior` ジョブが Lv1 で使用と表示される |
| `/admin/items/bone_cleaver` → 依存関係タブ | `grave_soldier`, `area1_node1` などが表示される |
| `/admin/jobs/warrior` → 依存関係タブ | `warrior` 魔神化フォームが表示される |
| `/admin/demon-forms/warrior` → 依存関係タブ | 対応職業 `warrior` が表示される |
| `/admin/stages/area1_node1` → 依存関係タブ | `area1_node2` の解放条件として表示される（解放チェーン） |
| `/admin/monsters/goblin` → 依存関係タブ | 空（参照なし）と表示される |

### 5.3 フィルタ・ソート確認（手動）

| テストケース | 期待結果 |
|---|---|
| `/admin/enemies` → Tier: BOSS フィルタ | BOSS エントリのみ表示 |
| `/admin/enemies` → 検索: 「霊体」| 部分一致エントリのみ表示 |
| `/admin/skills` → Element: FIRE フィルタ | FIRE スキルのみ表示 |
| `/admin/skills` → ソート: power 降順 | 最高 power のスキルが先頭 |
| `/admin/items` → Rarity: SSR フィルタ | SSR アイテムのみ表示 |
| フィルタ解除（ALL 選択）| 全エントリが再表示される |
| 検索テキストクリア | 全エントリが再表示される |

---

## 6. 修正: StageForm の enemyIds 紐付け（Phase 3.1）

### 問題

Phase 2 で実装した `StageForm` の WAVE設定タブにおいて、`enemyIds` の入力が
「カンマ区切りのフリーテキスト入力」になっており、`enemies.json` との紐付けが不完全。

```
設計書の仕様: enemyIds | enemies.json からマルチセレクト
現状の実装:  enemyIds | フリーテキスト入力（カンマ区切り）
```

### 原因

- `StageForm.tsx` の `WaveRow.enemyIds` 型が `string`（連結文字列）だった
- `pages/stages/[id]/page.tsx` が `enemies` データを取得していなかった
- WAVE設定 UI がチップ選択 UI でなくテキスト入力だった

### 修正内容

**型変更**: `WaveRow.enemyIds: string` → `WaveRow.enemyIds: string[]`

**Props 追加**: `StageForm` に `enemyData: EnemyMeta[]` を追加
```typescript
type EnemyMeta = { id: string; nameJa: string; tier: string; tribe: string };
```

**ページ更新**:
- `src/app/admin/stages/[id]/page.tsx` — `getMasterFile('enemies')` を追加
- `src/app/admin/stages/new/page.tsx` — 同上

**WAVE設定 UI**: テキスト入力 → チップ型マルチセレクト
- 敵IDをクリックでトグル（選択→紫チップ / 未選択→グレー）
- TierBadge + nameJa + ID を表示
- 現在の選択数を表示

---

## 7. 未実装事項（Phase 4 以降）

| 機能 | 理由 |
|---|---|
| ダメージシミュレータ | BattleEngine 統合が必要、Phase 4 |
| 深淵の残滓 AbyssalResidue 管理 | ランダム生成ロジック複雑、Phase 4 |
| 画像・スプライトのアップロード | PixiJS 統合が必要、Phase 4 |
