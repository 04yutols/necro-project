# Necromance Brave — マスターデータ管理ツール 操作ガイド

> 対象バージョン: Phase 2（編集フォーム実装済み）  
> 最終更新: 2026-05-31

---

## 目次

1. [起動方法](#1-起動方法)
2. [管理ツールへのアクセス](#2-管理ツールへのアクセス)
3. [画面構成の説明](#3-画面構成の説明)
4. [データを閲覧する（一覧・JSON プレビュー）](#4-データを閲覧する)
5. [既存データを編集する](#5-既存データを編集する)
6. [新しいデータを作成する](#6-新しいデータを作成する)
7. [データを削除する](#7-データを削除する)
8. [データ監査を実行する](#8-データ監査を実行する)
9. [各セクションの操作リファレンス](#9-各セクションの操作リファレンス)
10. [注意事項・制約](#10-注意事項制約)
11. [トラブルシューティング](#11-トラブルシューティング)

---

## 1. 起動方法

管理ツールは **Next.js の開発サーバー** として起動します。  
（Vite の `npm run dev` では動作しません。必ず `npx next dev` を使ってください）

### ① 前提条件

- Node.js 18+ がインストール済み
- プロジェクトの依存関係がインストール済み: `npm install`

### ② 開発サーバーの起動

```bash
cd /Users/yuto/workspace/necro-project   # プロジェクトルートへ移動
npx next dev --port 3200                  # 任意のポートで起動
```

起動ログの例:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3200
- Environments: .env.local

✓ Ready in 3.2s
```

### ③ 停止方法

ターミナルで `Ctrl+C` を押して停止します。

---

## 2. 管理ツールへのアクセス

ブラウザで以下の URL を開きます:

```
http://localhost:3200/admin
```

> **本番環境での保護**: `NODE_ENV=production` の環境では `/admin` にアクセスすると 404 が返ります。開発環境（`next dev`）でのみ動作します。

---

## 3. 画面構成の説明

### 3.1 ナビゲーションバー（上部固定）

```
NECRO ADMIN  [ダッシュボード] [敵] [ステージ] [職業] [スキル] [武器] [素材] [魔物] [魔神化] [監査]
```

各タブをクリックすると対応するセクションに移動します。  
現在のセクションはハイライト（紫ボーダー）で示されます。

### 3.2 ダッシュボード（`/admin`）

各データ種別のエントリ件数をカードで表示。カードをクリックして各セクションへ移動できます。

```
☠ 9       ⚑ 6       ⚔ 12      ✦ 28
敵         ステージ    職業       スキル

◈ 10      ◇ 7       ♟ 10      ☾ 4
武器       素材       魔物       魔神化
```

右下に「データ監査を実行 →」のクイックリンクがあります。

### 3.3 一覧ページ（例: `/admin/enemies`）

各セクションの一覧ページ構成:

```
敵データ                     [+ 新規作成]
enemies.json — 9 エントリ

▶ grave_soldier  [MINION] [UNDEAD] 霊体騎士  Grave Soldier  HP:15 ATK:4 …  [編集]
▶ rot_hound      [MINION] [BEAST]  腐敗猟犬  Rot Hound      HP:14 ATK:5 …  [編集]
▶ abyss_warden   [ELITE]  [UNDEAD] 深淵の看守 Abyss Warden  HP:36 ATK:5 …  [編集]
…
```

- **▶ をクリック**: アコーディオン展開 → JSON プレビュー表示（コピーボタン付き）
- **「編集」ボタン**: 編集フォームへ遷移
- **「+ 新規作成」**: 新規作成フォームへ遷移

### 3.4 編集フォームページ（例: `/admin/enemies/grave_soldier`）

```
← 一覧へ  敵: grave_soldier          [JSONコピー] [削除] [保存]
┌─────────────────────────────┬──────────────────────────┐
│ [基本情報] [ステータス] ...   │ {                        │
│                              │   "id": "grave_soldier", │
│ id: grave_soldier (固定)     │   "name": "Grave Soldier"│
│ 英名: Grave Soldier          │   ...                    │
│ 日本語名: 霊体騎士            │ }                        │
│ ...                          │  [JSONコピー]            │
└─────────────────────────────┴──────────────────────────┘
```

- **左側**: タブ切り替えで各フィールドを編集
- **右側**: フォーム入力に連動してリアルタイムで JSON を更新
- **「保存」**: 確認ダイアログ → OK でファイルに書き込み
- **「JSONコピー」**: 現在のフォーム内容を JSON としてクリップボードコピー
- **「削除」**: 確認ダイアログ → OK でエントリを削除

---

## 4. データを閲覧する

### 一覧で確認する

1. ナビゲーションバーで目的のセクション（例: 「敵」）をクリック
2. エントリの一覧が表示される
3. エントリ行の **▶** をクリックしてアコーディオンを展開
4. 展開された JSON プレビューで全フィールドを確認

### JSON をコピーする

1. エントリを展開（▶ クリック）
2. JSON プレビュー右上の「**コピー**」ボタンをクリック
3. クリップボードに整形済み JSON がコピーされる（「コピー済み」と 2 秒間表示）

---

## 5. 既存データを編集する

### 手順

1. 一覧ページで目的のエントリを探す
2. 行右端の「**編集**」ボタンをクリック（または URL `/admin/enemies/[id]` を直接入力）
3. 編集フォームが開く
4. タブを切り替えて各フィールドを編集
5. 右側の JSON プレビューで変更内容をリアルタイム確認
6. 「**保存**」ボタンをクリック
7. 確認ダイアログで「**保存する**」をクリック
8. 保存が完了すると一覧ページに自動でリダイレクト

### ID の変更について

**ID（エントリキー）は編集できません**。  
ID を変更したい場合は、新しい ID で新規作成し、古いエントリを削除してください。

### 保存の確認ダイアログ

```
┌─────────────────────────────────┐
│  保存の確認                      │
│  grave_soldier を保存しますか？   │
│                [キャンセル] [保存] │
└─────────────────────────────────┘
```

---

## 6. 新しいデータを作成する

### 手順

1. 一覧ページ右上の「**+ 新規作成**」ボタンをクリック
2. 空の新規作成フォームが開く
3. 全フィールドを入力（`id` フィールドは必須）
4. 「**保存**」ボタンをクリック
5. 確認ダイアログで「**保存する**」をクリック
6. 保存後、一覧ページに自動でリダイレクト

### ID のルール

- 英小文字、数字、アンダースコアのみ使用可
- 数字から始めてはいけない
- 既存の ID との重複は不可
- 例: `grave_archer`, `area1_node4`, `skill_warrior_3`

> **正規表現**: `^[a-z][a-z0-9_]*$`

### 入力例: 素材を新規作成する

1. ナビ「**素材**」→「**+ 新規作成**」
2. フィールドを入力:
   - `id`: `royal_dust`
   - `name`: 王都の塵
   - `quantity`: 1
   - `expValue`: 200
   - `rarity`: RARE
3. 「**保存**」→ 確認 → 完了

---

## 7. データを削除する

> ⚠️ **警告**: 削除したデータは元に戻せません。他のデータから参照されているエントリ（例: stages.json の enemyIds に含まれている敵）を削除すると、監査で FAIL が発生します。

### 手順

1. 編集フォームを開く（一覧の「編集」ボタンから）
2. ページ上部の「**削除**」ボタン（赤系のボタン）をクリック
3. 確認ダイアログで「**削除する**」をクリック
4. 削除後、一覧ページに自動でリダイレクト

```
┌─────────────────────────────────────────┐
│  削除の確認                              │
│  grave_soldier を削除しますか？           │
│  この操作は元に戻せません。              │
│                    [キャンセル] [削除する] │
└─────────────────────────────────────────┘
```

---

## 8. データ監査を実行する

監査パネルで全マスターデータの整合性チェックを実行できます。

### アクセス方法

- ナビゲーションバーの「**監査**」をクリック
- または: `http://localhost:3200/admin/audit`

### 監査結果の見方

```
検出結果:  3 FAIL  7 WARN  42 PASS    合計 52 件

[FAIL (3)] [WARN (7)] [PASS (42)]

FAIL  stages  area1_node2: waves[0] references missing enemy "new_minion"
FAIL  jobs    dark_knight: references missing skill "skill_dk_new"
…
```

- **FAIL**: 修正必須のエラー（参照切れ、ID 不整合など）
- **WARN**: 確認推奨の警告（未使用スキル、シールドなし精鋭など）
- **PASS**: 正常

### 監査チェック項目

| チェック | 内容 |
|---|---|
| ID 整合性 | エントリの `id` フィールドと JSON キーが一致するか |
| 敵参照 | stages の `waves[].enemyIds` が enemies.json に存在するか |
| スキル参照 | jobs の `skills[].skillId` が skills.json に存在するか |
| ドロップ参照 | `dropTable[].itemId` が items.json / materials.json に存在するか |
| 解放条件 | stages の `unlockRequires[]` が stages.json に存在するか |
| 魔神化参照 | demonForms の `jobId` が jobs.json に存在するか |

---

## 9. 各セクションの操作リファレンス

### 9.1 敵データ（enemies.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | ID・名前・tier（MINION/ELITE/BOSS）・tribe・説明を設定 |
| **ステータス** | HP/ATK/DEF/SPD/critRate/critDmg/effectHit/effectRes を設定 |
| **属性耐性** | 9 属性の耐性値を -100〜+100 で設定。負値 = 弱点（赤）、正値 = 耐性（青）|
| **ギミック** | 霊的防壁 HP + ボスギミック（trigger × effect × value）を設定 |
| **ドロップ** | ドロップテーブルのエントリを追加/削除。type・itemId・rate・isHidden を設定 |
| **バトル** | 表示カラー・スプライト種別・サイズを設定 |

### 9.2 ステージ（stages.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | ID・名前・chapter/area・nodeType・element・difficulty・解放条件・位置を設定 |
| **WAVE設定** | 各 WAVE の role と enemyIds を設定（SAFE ノードは無効）|
| **報酬** | 基本 EXP/ゴールドとドロップテーブルを設定 |

### 9.3 職業（jobs.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | 名前・tier・category・baseAttackType・役割説明を設定 |
| **解放条件** | Tier2 のみ: 前提職業 + 必要レベルを設定 |
| **ステータス補正** | 8 種の statModifiers（0.50〜1.50）と growthModifiers を設定 |
| **エナジー** | baseMaxEnergy / ultimateCost / spGrowthPerLevel を設定 |
| **レベルボーナス** | Lv10/20/30 のパッシブボーナスを設定 |
| **スキル配置** | 各レベルで解放されるスキル（level + skillId）を追加 |

### 9.4 スキル（skills.json）

単一フォーム。id・name・mpCost・power・type・element・attackType・targetType・effectKey・ailmentType・description を設定。

### 9.5 武器/アイテム（items.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | ID・名前・type・rarity・archetype・rank・ilv・フレーバーを設定 |
| **サブオプション** | subOptions の type と value を行追加で設定 |
| **パッシブ** | passiveA / passiveB の名称・説明テンプレート・Rank1〜5 の値を設定 |

### 9.6 素材（materials.json）

単一フォーム。id・name・quantity・expValue・rarity を設定。

### 9.7 編成モンスター（monsters.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | ID・名前・tribe・cost（1〜5）を設定 |
| **ステータス** | 8 種ステータスを設定 |
| **属性耐性** | 9 属性の耐性値を設定 |

### 9.8 魔神化フォーム（demonForms.json）

| タブ | 主な操作 |
|---|---|
| **基本情報** | jobId・formName・tier・concept を設定 |
| **Effect A** | 効果 A の説明・statBoosts・フラグを設定 |
| **Effect B** | 効果 B の説明・riskType・onAttackEffect を設定 |
| **奥義** | 奥義の名称・ダメージ設定・残響効果を設定 |

---

## 10. 注意事項・制約

### データの安全性

- 管理ツールは **開発環境でのみ動作** します（本番では 404）
- 保存ボタンを押すと `src/data/master/*.json` が **直接上書き** されます
- 削除は **元に戻せません**
- 重要な変更の前に Git でコミット・バックアップを取ることを推奨:
  ```bash
  git add src/data/master/
  git commit -m "backup before admin edit"
  ```

### 参照整合性

他のデータから参照されているエントリを変更・削除する場合は注意してください:

| 変更対象 | 影響を受ける可能性があるデータ |
|---|---|
| enemies.json のID | stages.json の waves[].enemyIds |
| skills.json のID | jobs.json の skills[].skillId |
| items.json のID | enemies/stages.json の dropTable[].itemId |
| jobs.json のID | demonForms.json の jobId |
| stages.json のID | 他ステージの unlockRequires |

変更後は必ず**監査パネル**で 0 FAIL を確認してください。

### ID の変更

ID（JSON キー）は変更できません。ID を変更したい場合:
1. 新しい ID で新規作成
2. 古いエントリを削除
3. 他のデータの参照（`enemyIds` など）も手動で更新
4. 監査で FAIL がないことを確認

---

## 11. トラブルシューティング

### `/admin` にアクセスすると 404 になる

`next dev` で起動しているか確認してください。  
`npm run dev`（Vite）では動作しません。

```bash
npx next dev --port 3200  # ← これを使う
npm run dev               # ← これでは動かない
```

### 保存しても変更が反映されない

1. ブラウザの **ハードリフレッシュ**（`Cmd+Shift+R` / `Ctrl+Shift+R`）を試す
2. 一覧ページに戻って再度開く
3. `src/data/master/[file].json` をエディタで直接確認

### 保存時にエラーが表示される

よくあるエラーとその対処:

| エラー | 原因 | 対処 |
|---|---|---|
| `ID は必須です` | id フィールドが空 | id を入力する |
| `ID の形式が正しくありません` | 大文字・記号が含まれている | 英小文字・数字・アンダースコアのみ使用 |
| `この ID はすでに存在します` | 重複 ID で新規作成しようとした | 別の ID を使うか既存エントリを編集する |
| `保存に失敗しました` | ファイルシステムエラー | ターミナルで Next.js のエラーログを確認 |

### 監査で FAIL が出た

監査ページで FAIL のタブをクリックし、エラーメッセージを確認してください。  
FAIL 行の scope（`enemies` など）をクリックすると該当セクションに移動します。

よくある FAIL の例:
- `waves[0] references missing enemy "xxx"` → stages.json の enemyIds に存在しない敵IDが指定されている
- `ID不整合: キー="foo" vs id="bar"` → JSON キーと `id` フィールドの値が食い違っている

### フォームの動作がおかしい（入力が消える等）

ブラウザをリロード（`F5`）して再度試してください。  
状態は保存されていないので、再入力が必要です。

---

## Appendix: 管理ツールのアーキテクチャ概要

```
src/app/admin/
  actions.ts            ← Server Action（ファイル R/W）: dev 環境のみ
  layout.tsx            ← 開発環境ガード + ナビゲーション
  page.tsx              ← ダッシュボード
  [section]/
    page.tsx            ← 一覧（Server Component）
    new/page.tsx        ← 新規作成フォーム（Server Component）
    [id]/page.tsx       ← 編集フォーム（Server Component）

src/components/admin/
  AdminNav.tsx          ← 上部ナビ（Client Component）
  AccordionEntry.tsx    ← アコーディオン（Client Component）
  Badges.tsx            ← 各種バッジ（Server/Client 両対応）
  JsonPreview.tsx       ← JSON 表示 + コピー（Client Component）
  AuditPanel.tsx        ← 監査結果表示（Client Component）
  *List.tsx             ← 各セクション一覧（Client Component）
  forms/
    *Form.tsx           ← 各セクション編集フォーム（Client Component）
    shared/             ← 共通フォーム部品（全て Client Component）
```

**データフロー（編集保存時）:**
```
フォーム入力
  → Client Component (useState で管理)
  → 「保存」クリック → バリデーション
  → 確認ダイアログ
  → saveEntry() Server Action 呼び出し
  → fs.readFileSync → JSON 更新 → fs.writeFileSync
  → { success: true }
  → router.push('/admin/[section]') でリダイレクト
```
