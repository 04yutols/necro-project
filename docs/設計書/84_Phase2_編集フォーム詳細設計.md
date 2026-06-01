# 84 — Phase 2 編集フォーム詳細設計

> 作成日: 2026-05-31  
> フェーズ: Phase 2 — 全8データ種別の編集フォーム + ファイル保存  
> 前提: Phase 1（`docs/設計書/83_Phase1_管理ツール詳細設計と証跡.md`）が完了済み

---

## 1. Phase 2 スコープ

| 機能 | 優先度 |
|---|---|
| `writeMasterFile` / `saveEntry` / `deleteEntry` Server Action | 必須 |
| 全 8 データ種別の新規作成フォーム (`/new`) | 必須 |
| 全 8 データ種別の編集フォーム (`/[id]`) | 必須 |
| 保存確認ダイアログ（上書き警告） | 必須 |
| JSON プレビュー（フォーム入力と常時同期） | 必須 |
| エントリ削除（確認ダイアログ付き） | 必須 |
| 一覧ページへの「新規作成」「編集」ボタン追加 | 必須 |
| ダメージシミュレータ | 除外（Phase 4） |
| 依存関係タブ | 除外（Phase 3） |

---

## 2. ルーティング設計

```
/admin/enemies             ← Phase 1: 一覧（AccordionEntry 展開）
/admin/enemies/new         ← Phase 2: 新規作成フォーム
/admin/enemies/[id]        ← Phase 2: 編集フォーム（id = JSON キー）

/admin/stages/new
/admin/stages/[id]

/admin/jobs/new
/admin/jobs/[id]

/admin/skills/new
/admin/skills/[id]

/admin/items/new
/admin/items/[id]

/admin/materials/new
/admin/materials/[id]

/admin/monsters/new
/admin/monsters/[id]

/admin/demon-forms/new
/admin/demon-forms/[id]
```

---

## 3. Server Actions 拡張（`src/app/admin/actions.ts`）

```typescript
// 単一エントリ読み込み
export async function getEntry(
  fileKey: keyof MasterDataCollection,
  entryKey: string
): Promise<Record<string, unknown> | null>

// エントリ保存（新規 or 更新）
export async function saveEntry(
  fileKey: keyof MasterDataCollection,
  entryKey: string,            // 新規は '' でなく実際のキー
  data: Record<string, unknown>
): Promise<SaveResult>

// エントリ削除
export async function deleteEntry(
  fileKey: keyof MasterDataCollection,
  entryKey: string
): Promise<SaveResult>

type SaveResult = {
  success: boolean
  error?: string
}
```

**保存フロー:**
1. `assertDev()` — 開発環境チェック
2. 既存ファイルを読み込む
3. 対象エントリを更新（新規 or 上書き）
4. JSON.stringify(data, null, 2) でシリアライズ
5. `fs.writeFileSync` で書き込み
6. `{ success: true }` を返す

**削除フロー:**
1. `assertDev()`
2. 既存ファイルを読み込む
3. 対象キーを delete
4. 書き込み

---

## 4. 共通フォームコンポーネント

### 4.1 レイアウト構成

```
/admin/enemies/[id]/page.tsx  (Server Component)
  └─ EnemyForm (Client Component)
       ├─ FormHeader           ← タイトル + 保存/削除ボタン
       ├─ FormTabs             ← タブ切り替え（基本 / ステータス / 耐性 / ...）
       ├─ [各タブのコンテンツ]
       └─ JsonPreviewSidebar   ← フォーム入力をリアルタイムで JSON 表示
```

### 4.2 共通コンポーネント一覧

```
src/components/admin/forms/shared/
  FormField.tsx        ← ラベル + 入力フィールド（text / number / select / textarea）
  FormTabs.tsx         ← タブバー切り替え
  FormSaveBar.tsx      ← 「保存」「JSONコピー」「削除」ボタン行
  StatInputGrid.tsx    ← 8種ステータス入力グリッド（hp/atk/def/spd/critRate/critDmg/effectHit/effectRes）
  ResistanceGrid.tsx   ← 9属性耐性入力グリッド（スライダー + 数値入力）
  DropTableEditor.tsx  ← ドロップエントリの追加/削除テーブル
  SkillRefEditor.tsx   ← jobs.skills[] 用: level + skillId セレクタ行追加
  GimmickEditor.tsx    ← gimmicks[] 用: trigger + effect + value 行追加
  JsonSidebar.tsx      ← フォームデータのリアルタイム JSON 表示
  ConfirmDialog.tsx    ← 保存/削除確認モーダル
```

### 4.3 フォームの状態管理パターン

```typescript
// 各フォームの基本パターン
function EnemyForm({ initialData, entryKey }: Props) {
  const [form, setForm] = useState<EnemyFormData>(
    initialData ? parseInitialData(initialData) : defaultEnemyFormData()
  )
  const [isNew] = useState(!initialData)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // フォームデータ → JSON オブジェクト変換
  const asJson = useMemo(() => formToJson(form), [form])

  // 保存ハンドラ
  async function handleSave() {
    const validationError = validate(form)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    const result = await saveEntry('enemies', form.id, asJson)
    setSaving(false)
    if (result.success) router.push('/admin/enemies')
    else setError(result.error ?? '保存に失敗しました')
  }
}
```

---

## 5. 各フォームの仕様

---

### 5.1 敵データフォーム（EnemyForm）

**タブ構成: 基本情報 / ステータス / 属性耐性 / ギミック / ドロップ / バトル**

#### 基本情報タブ
| フィールド | 入力種別 | バリデーション |
|---|---|---|
| `id` | text（新規時のみ編集可） | `^[a-z][a-z0-9_]*$`、既存IDとの重複チェック |
| `name`（英名）| text | 必須 |
| `nameJa` | text | 必須 |
| `nameEn` | text | 任意（大文字推奨） |
| `tier` | select | MINION / ELITE / BOSS |
| `tribe` | select | 6種族 |
| `description` | textarea | 任意 |

#### ステータスタブ
8種ステータスを `StatInputGrid` で入力。  
各フィールド: 数値入力 (min=0)。

#### 属性耐性タブ
9属性を `ResistanceGrid` で入力。  
スライダー（-100〜+100）+ 数値入力の両方で設定可。  
`weaknesses` 配列は -1 以下の属性を自動抽出して表示（編集不可の導出値）。

#### ギミックタブ（ELITE/BOSS のみ）
| フィールド | 入力種別 |
|---|---|
| `shieldHp` | number（0 = シールドなし） |
| gimmicks 行追加 | trigger × effect × value テーブル |

trigger: `HP_BELOW_50` / `TURN_3` / `ON_SHIELD_BREAK` / `ON_REVIVE`  
effect: `ENRAGE` / `AV_DELAY` / `REVIVE` / `SUMMON_MINIONS`

#### ドロップテーブルタブ
`DropTableEditor` で行の追加/削除。  
type = WEAPON/MATERIAL → itemId セレクト（items.json / materials.json から）  
type = RESIDUE → itemId 不要（rarity のみ）  
`isHidden` チェックボックス（UR 非掲載）

#### バトル表示タブ
| フィールド | 入力種別 |
|---|---|
| `battle.color` | `<input type="color">` |
| `battle.sprite` | select（WRAITH / GIANT / WYRM） |
| `battle.size` | number（0.5〜1.5, step 0.01） |

---

### 5.2 ステージフォーム（StageForm）

**タブ構成: 基本情報 / WAVE設定 / 報酬**

#### 基本情報タブ
| フィールド | 入力種別 |
|---|---|
| `id` | text（新規のみ編集可） |
| `nameJa` / `nameEn` / `name` | text |
| `chapter` / `area` | number |
| `nodeType` | select（SAFE / DUNGEON / BOSS） |
| `element` | select（9属性） |
| `difficulty` | number（0〜5） |
| `areaGimmick` | select（NONE / UNDEAD_BUFF 等） |
| `unlockRequires` | stages.json からマルチセレクト |
| `position.x` / `.y` | number |
| `description` | textarea |

#### WAVE設定タブ（nodeType = DUNGEON/BOSS の場合のみ）
WAVE 行（1〜3 行）の管理テーブル。  
各行: label（自動）/ role セレクト / enemyIds マルチセレクト（enemies.json から）/ intent テキスト  
選択した敵の tier / tribe / shieldHp を行内でプレビュー表示。

#### 報酬タブ
| フィールド | 入力種別 |
|---|---|
| `baseExp` | number |
| `baseGold` | number |
| dropTable | `DropTableEditor` |

---

### 5.3 職業フォーム（JobForm）

**タブ構成: 基本情報 / 解放条件 / ステータス補正 / エナジー / レベルボーナス / スキル配置**

#### 基本情報タブ
name（英キー）/ displayName / nameEn / title / tier（1/2）/ category / baseAttackType / role / description

#### 解放条件タブ（tier = 2 の場合のみ）
前提職業 + minLevel のペアを追加。jobs.json からセレクト。

#### ステータス補正タブ
8種の statModifiers を 0.50〜1.50 の number 入力で設定。  
右側に「ATK: 100 × 1.20 = 120」スタイルのプレビュー表示。

#### エナジーカーブタブ
baseMaxEnergy / ultimateCost / spGrowthPerLevel の 3 フィールド。

#### レベルボーナスタブ
Lv10 / Lv20 / Lv30 のボーナス種別と値をテーブルで設定。  
ボーナス種別: passiveAtkBonus / passiveDefBonus / passiveSpdBonus / passiveCritRateBonus / passiveCritDmgBonus

#### スキル配置タブ
level + skillId のペアを追加。  
skillId は skills.json からセレクト。  
各スキルの power / mpCost / element を行内プレビュー。

---

### 5.4 スキルフォーム（SkillForm）

**シングルページ（タブなし）**

| フィールド | 入力種別 |
|---|---|
| `id` | text（新規のみ） |
| `name` | text |
| `mpCost` | number（0〜999） |
| `power` | number（0.0〜5.0, step 0.01） |
| `type` | select（PHYSICAL / MAGICAL / SUPPORT / HEAL） |
| `element` | select（9属性 + NONE） |
| `attackType` | select（SLASH / STRIKE / PROJECTILE / MAGIC / SUMMON / HEAL） |
| `targetType` | select（SINGLE / ALL_ENEMIES / SELF / ALLY / ALL_ALLIES） |
| `effectKey` | text |
| `ailmentType` | select（任意: BURN / POISON / PARALYSIS / BLEED / WEAKEN / FREEZE） |
| `ailmentBaseRate` | number 0.0〜1.0（ailmentType が設定されている場合のみ表示） |
| `healSelfPct` | number（任意） |
| `description` | textarea |

---

### 5.5 武器・アイテムフォーム（ItemForm）

**タブ構成: 基本情報 / サブオプション / パッシブ**

#### 基本情報タブ
id / name / type（WEAPON/CONSUMABLE）/ rarity（R/SR/SSR/UR）/ archetype（LOW/MID/HIGH/MYTHIC）/ rank（0〜5）/ ilv（1〜90）/ isUnique / flavor

#### サブオプションタブ
subOptions 行（最大3行）: type × value テーブル。  
type: ATK% / CRIT_DMG / CRIT_RATE / EFFECT_HIT / FIRE_DMG_BOOST / WATER_DMG_BOOST 等

#### パッシブタブ
passiveA / passiveB それぞれ:
- nameJa
- descTemplate（{value} プレースホルダー）
- values: 5段階数値配列（Rank 1〜5 の入力欄 × 5）
- 右側に各ランクでの説明文プレビュー自動展開

---

### 5.6 素材フォーム（MaterialForm）

**シングルページ（タブなし）**

id / name / quantity（number, min=1）/ expValue（number）/ rarity（COMMON/RARE/EPIC/LEGENDARY）

---

### 5.7 編成モンスターフォーム（MonsterForm）

**タブ構成: 基本情報 / ステータス / 属性耐性**

id（JSONキー）/ name / tribe / cost（1〜5）/ stats（StatInputGrid）/ resistances（ResistanceGrid）

---

### 5.8 魔神化フォームエディタ（DemonFormEditor）

**タブ構成: 基本情報 / Effect A / Effect B / 奥義**

#### 基本情報タブ
jobId（jobs.json からセレクト）/ formName / tier（1/2）/ concept

#### Effect A タブ
| フィールド | 入力種別 |
|---|---|
| `descJa` | textarea |
| statBoosts | ステータス名 × 倍率のテーブル（行追加/削除） |
| flags | チェックボックス（DARK_EDGE / ELEMENT_SURGE / DRAIN_STRIKE / SWIFT_BLOOD 等） |

#### Effect B タブ
| フィールド | 入力種別 |
|---|---|
| `descJa` | textarea |
| `riskType` | select（null / SELF_DAMAGE / HP_DRAIN） |
| `onAttackEffect` | text または select |

#### 奥義タブ
| フィールド | 入力種別 |
|---|---|
| `nameJa` | text |
| damage.power | number（1.0〜5.0） |
| damage.element | 9属性セレクト |
| damage.targetType | SINGLE / ALL_ENEMIES |
| damage.attackType | 攻撃種別セレクト |
| damage.flags | チェックボックス |
| lingering.type | select（PARTY_BUFF / SELF_BUFF / DOT 等） |
| lingering.descJa | textarea |
| lingering.duration | number（1〜5） |

---

## 6. バリデーションルール

### 全フォーム共通
- `id` フィールド: `/^[a-z][a-z0-9_]*$/` にマッチすること
- 新規作成時: 既存キーとの重複 → FAIL
- 必須フィールドが空 → 保存ボタン無効化

### 敵フォーム固有
- stats.hp > 0, stats.atk > 0
- shieldHp >= 0（0 = シールドなし）
- gimmick.effect が `REVIVE` の場合 trigger は `HP_BELOW_50` 推奨 → WARN

### スキルフォーム固有
- power > 0
- mpCost >= 0
- ailmentType があれば ailmentBaseRate も必須

### 職業フォーム固有
- tier = 2 なら unlock.jobs に 2 要素必須

---

## 7. UI デザイン（Phase 2 追加仕様）

### フォームページ全体レイアウト
```
┌─────────────────────────────────────────────────────────────┐
│  AdminNav (sticky)                                           │
├─────────────────────────────────────────────────────────────┤
│  FormHeader: [← 一覧へ] タイトル  [保存] [JSONコピー] [削除] │
├──────────────────────────┬──────────────────────────────────┤
│  FormTabs + 各タブ内容    │  JSON プレビュー（リアルタイム）  │
│  (左 55%)                │  (右 45%, sticky)                │
│                          │                                   │
│  各フォームフィールド      │  JsonSidebar                     │
│                          │                                   │
└──────────────────────────┴──────────────────────────────────┘
```

### フォームフィールドスタイル
```css
/* ラベル */
color: #7878a8, font-size: 11px, font-family: font-space, margin-bottom: 4px

/* テキスト入力 */
background: #1a1a24
border: 1px solid rgba(139,0,255,0.2)
border-radius: 6px
padding: 8px 10px
color: #e0d0ff
font-size: 13px
&:focus { border-color: rgba(139,0,255,0.6), outline: none }

/* セレクト */
同上 + appearance: none

/* 数値スライダー */
-webkit-appearance: none
accent-color: #8B00FF

/* 保存ボタン */
background: rgba(139,0,255,0.22)
border: 1px solid rgba(139,0,255,0.5)
color: #d8b4fe
padding: 8px 20px
border-radius: 6px

/* 削除ボタン */
background: rgba(127,29,29,0.22)
border: 1px solid rgba(220,38,38,0.4)
color: #fca5a5
```

### 確認ダイアログ
Framer Motion でスケールイン。背景オーバーレイ + 中央モーダル。
- 保存確認: 「[ID] を保存しますか？」
- 削除確認: 「[ID] を削除しますか？この操作は元に戻せません。」

---

## 8. 一覧ページへの変更

各セクションの一覧ページ（Phase 1 実装済み）に以下を追加:

1. ページヘッダー右側に「+ 新規作成」ボタン → `/admin/[section]/new` へ遷移
2. AccordionEntry の展開ヘッダー右側に「編集」リンクボタン → `/admin/[section]/[id]` へ遷移

`AccordionEntry.tsx` に `editHref?: string` プロパティを追加。

---

## 9. ファイル構成（Phase 2 追加分）

```
src/app/admin/
  enemies/
    new/page.tsx
    [id]/page.tsx
  stages/
    new/page.tsx
    [id]/page.tsx
  jobs/
    new/page.tsx
    [id]/page.tsx
  skills/
    new/page.tsx
    [id]/page.tsx
  items/
    new/page.tsx
    [id]/page.tsx
  materials/
    new/page.tsx
    [id]/page.tsx
  monsters/
    new/page.tsx
    [id]/page.tsx
  demon-forms/
    new/page.tsx
    [id]/page.tsx

src/components/admin/forms/
  EnemyForm.tsx
  StageForm.tsx
  JobForm.tsx
  SkillForm.tsx
  ItemForm.tsx
  MaterialForm.tsx
  MonsterForm.tsx
  DemonFormEditor.tsx
  shared/
    FormField.tsx
    FormTabs.tsx
    FormSaveBar.tsx
    StatInputGrid.tsx
    ResistanceGrid.tsx
    DropTableEditor.tsx
    SkillRefEditor.tsx
    GimmickEditor.tsx
    JsonSidebar.tsx
    ConfirmDialog.tsx
```

---

## 10. テスト計画

### 10.1 TypeScript 型チェック
```bash
npx tsc --noEmit
```
エラーなし必須。

### 10.2 HTTP ステータス確認
| ルート | 期待値 |
|---|---|
| `GET /admin/enemies/grave_soldier` | 200 |
| `GET /admin/enemies/new` | 200 |
| `GET /admin/stages/area1_node1` | 200 |
| `GET /admin/stages/new` | 200 |
| 全 8 種別 × `/new` と `/[id]` | 200 |

### 10.3 保存フロー確認
1. `/admin/materials/new` で新規素材を作成 → 保存
2. `src/data/master/materials.json` に新エントリが追加されていること
3. 監査ページで 0 FAIL を確認
4. 作成したエントリを削除 → 元の状態に戻ること

### 10.4 バリデーション確認
- ID が空の場合、保存ボタンが無効化されること
- ID が `^[a-z][a-z0-9_]*$` に違反する場合、エラー表示されること
- 重複 ID で保存しようとするとエラーになること
