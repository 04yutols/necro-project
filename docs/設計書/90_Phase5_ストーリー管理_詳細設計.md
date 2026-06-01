# 90 — Phase 5 詳細設計書：ストーリー管理機能

> 作成日: 2026-06-01  
> フェーズ: Phase 5 — ストーリー編集機能  
> ステータス: 設計完了

---

## 1. 概要

`src/data/story/ch1_scenes.json`（17シーン）と`characters.json`（4キャラ）を  
管理画面から CRUD 編集できるようにする。  
対象ファイルはフラット JSON なので、マスターデータと同じ読み書き方式を採用。

---

## 2. 機能仕様

### 2.1 ルート構成

| ルート | 種別 | 内容 |
|---|---|---|
| `/admin/story` | Server+Client | シーン一覧（17件）+ フィルタ |
| `/admin/story/new` | Server+Client | 新規シーン作成 |
| `/admin/story/[id]` | Server+Client | シーン編集 |
| `/admin/story/characters` | Server+Client | キャラクター管理 |

### 2.2 シーン一覧（`/admin/story`）
- シーケンス順に全シーンを表示
- フィルタ: SceneType × TriggerType
- 各行: `[sequence]` `[type badge]` `[id]` `[archiveTitle]` `[trigger]` `[台詞数]` `[編集→]`
- 新規シーン作成ボタン

### 2.3 シーン編集（`/admin/story/[id]`）

3タブ構成:

**① 基本情報タブ**
- id（テキスト）
- sequence（数値）
- type（セレクト: DIALOGUE / MONOLOGUE / ENVIRONMENT / CHAPTER_TITLE）
- background（セレクト: DARK / SEPIA / BLOOD_RED / RUIN_LIGHT / BLUR_MAP / STAGE_DARK）
- archiveTitle / archiveChapter
- isSkippable（チェックボックス）
- CHAPTER_TITLE 専用: title / titleEn / description
- **トリガー設定**（type セレクト + 引数入力）

**② 台詞編集タブ**（メイン）
- 行ごとに追加・削除・並べ替え
- 各行フィールド: speaker / speakerJa / text / textEn
- ポートレート設定: characterId × position × expression（最大 3体）
- オプション: vfx / bgm / pauseAfter / expression

**③ 完了アクションタブ**
- onComplete.setFlag（テキスト）
- onComplete.unlockArea（テキスト）
- onComplete.navigateTo（テキスト）

### 2.4 キャラクター管理（`/admin/story/characters`）
- キャラクター一覧（4件）
- 各キャラ: id / nameJa / nameEn / color / glow / expressions[] 編集
- expressions は chips 形式で追加・削除

---

## 3. サーバーアクション（`actions.ts` 追記）

```typescript
// ── Story Actions ──
export async function getStoryScenes(): Promise<StoryScene[]>
export async function getStoryScene(id: string): Promise<StoryScene | null>
export async function saveStoryScene(scene: StoryScene): Promise<{ ok: boolean }>
export async function deleteStoryScene(id: string): Promise<{ ok: boolean }>
export async function getStoryCharacters(): Promise<Record<string, StoryCharacter>>
export async function saveStoryCharacter(char: StoryCharacter): Promise<{ ok: boolean }>
```

---

## 4. データ定数

### BackgroundOptions
`DARK` | `SEPIA` | `BLOOD_RED` | `RUIN_LIGHT` | `BLUR_MAP` | `STAGE_DARK`

### TriggerTypes
`GAME_START` | `FLAG_SET` | `STAGE_CLEAR` | `STAGE_ENTER` | `AREA_UNLOCK` | `BOSS_CLEAR` | `DEMONIZE_FIRST` | `MANUAL`

### VfxOptions
`soulChain` | `cursedPillarBreath` | `demonRingConverge` | `ssrGoldPillar`

### SceneTypes
`DIALOGUE` | `MONOLOGUE` | `ENVIRONMENT` | `CHAPTER_TITLE`

---

## 5. ファイル構成

| ファイル | 種別 |
|---|---|
| `src/app/admin/story/page.tsx` | Server Component |
| `src/app/admin/story/new/page.tsx` | Server Component |
| `src/app/admin/story/[id]/page.tsx` | Server Component |
| `src/app/admin/story/characters/page.tsx` | Server Component |
| `src/components/admin/StoryScenesList.tsx` | Client Component |
| `src/components/admin/forms/StorySceneForm.tsx` | Client Component |
| `src/components/admin/forms/StoryCharactersForm.tsx` | Client Component |
| `src/app/admin/actions.ts` | Server Actions 追記 |
| `src/components/admin/AdminNav.tsx` | ナビ追記 |
| `src/app/admin/page.tsx` | ダッシュボード追記 |
