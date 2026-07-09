# 83 — Phase 1 管理ツール詳細設計と実装証跡

> 作成日: 2026-05-31  
> フェーズ: Phase 1 — 読み取り専用ビュー + データ監査パネル  
> ステータス: ✅ 実装完了・型チェック通過・HTTP 200 全ルート確認済み

---

## 1. Phase 1 スコープ

| 機能 | 状態 |
|---|---|
| `/admin` ルート（開発環境ガード）| ✅ |
| ダッシュボード（8データ種別の件数サマリ）| ✅ |
| 全 8 データ種別の一覧表示 | ✅ |
| アコーディオン展開 + JSON プレビュー（コピーボタン付き）| ✅ |
| データ監査パネル（FAIL/WARN/PASS タブ切り替え）| ✅ |
| AdminNav（sticky、アクティブリンク判定）| ✅ |
| TierBadge / TribeBadge / RarityBadge / NodeTypeBadge / ElementBadge | ✅ |

---

## 2. ファイル一覧

### Server Actions / Layout
```
src/app/admin/actions.ts       ← 'use server' — マスターデータ読み込み + 監査ロジック
src/app/admin/layout.tsx       ← 開発環境ガード（NODE_ENV != development → notFound()）
```

### ページ（Server Components）
```
src/app/admin/page.tsx                ← ダッシュボード
src/app/admin/enemies/page.tsx        ← 敵データ一覧
src/app/admin/stages/page.tsx         ← ステージ一覧
src/app/admin/jobs/page.tsx           ← 職業一覧
src/app/admin/skills/page.tsx         ← スキル一覧
src/app/admin/items/page.tsx          ← 武器一覧
src/app/admin/materials/page.tsx      ← 素材一覧
src/app/admin/monsters/page.tsx       ← 編成モンスター一覧
src/app/admin/demon-forms/page.tsx    ← 魔神化フォーム一覧
src/app/admin/audit/page.tsx          ← データ監査
```

### コンポーネント（`src/components/admin/`）
```
AdminNav.tsx        ← 'use client' — sticky ナビ、usePathname でアクティブ判定
JsonPreview.tsx     ← 'use client' — コピーボタン付き整形 JSON ブロック
AccordionEntry.tsx  ← 'use client' — Framer Motion height:auto アコーディオン
Badges.tsx          ← TierBadge / TribeBadge / RarityBadge / NodeTypeBadge / ElementBadge
EnemiesList.tsx     ← 'use client' — stats ミニバー付き
StagesList.tsx      ← 'use client'
JobsList.tsx        ← 'use client'
SkillsList.tsx      ← 'use client'
ItemsList.tsx       ← 'use client'
MaterialsList.tsx   ← 'use client'
MonstersList.tsx    ← 'use client'
DemonFormsList.tsx  ← 'use client'
AuditPanel.tsx      ← 'use client' — FAIL/WARN/PASS タブ切り替え、50件超で「もっと見る」
```

---

## 3. アーキテクチャ設計

### データフロー
```
URL アクセス
  │
  ├─ src/app/admin/layout.tsx (Server Component)
  │    ├─ NODE_ENV チェック → 'development' 以外は notFound()
  │    └─ AdminNav（Client Component）を配置
  │
  └─ 各 page.tsx (Server Component)
       ├─ getMasterFile('xxx.json') を呼ぶ
       │    └─ actions.ts の Server Action
       │         └─ assertDev() → fs.readFileSync → JSON.parse
       └─ XxxList（Client Component）へ data を props 渡し
```

### Server/Client 分離原則
- **Server**: データ読み込み（fs モジュール使用）、ガード判定
- **Client**: UI インタラクション（アコーディオン、クリップボード、タブ切り替え）
- `'use server'` と `'use client'` の境界を明確に分離

### iOS Safari ルール準拠
`AccordionEntry.tsx` の Framer Motion アニメーション:
```tsx
// ✅ GOOD: overflow:hidden は motion.div の内側の要素に付けない
<motion.div
  style={{ overflow: 'hidden' }}  // ← transform と別要素ではないが
  animate={{ height: 'auto' }}    //   transform は使用していない
>
```
`height: auto` アニメーションは transform を使用しないため問題なし。

---

## 4. 監査ロジック仕様

`src/app/admin/actions.ts` の `runMasterDataAudit()` が実行するチェック:

| チェック項目 | スコープ | FAIL 条件 | WARN 条件 |
|---|---|---|---|
| ID整合性 | enemies / stages / skills / items / materials | `id` フィールドが JSON キーと不一致 | `id` フィールドが存在しない |
| 敵参照 | stages → enemies | `waves[].enemyIds[]` が enemies.json に存在しない | — |
| スキル参照 | jobs → skills | `skills[].skillId` が skills.json に存在しない | スキル参照が 0 件 |
| ドロップ参照 | enemies/stages → items/materials | `dropTable[].itemId` が items.json / materials.json のどちらにも存在しない | — |
| 解放条件 | stages → stages | `unlockRequires[]` が stages.json に存在しない | — |
| 魔神化参照 | demonForms → jobs | `jobId` が jobs.json に存在しない | `jobId` フィールドがない |

---

## 5. 実装証跡

### 5.1 TypeScript 型チェック

```
$ npx tsc --noEmit
(出力なし = エラーなし)
```

### 5.2 HTTP ステータス確認（`npx next dev --port 3200`）

| ルート | HTTP ステータス |
|---|---|
| `/admin` | ✅ 200 OK |
| `/admin/enemies` | ✅ 200 OK |
| `/admin/stages` | ✅ 200 OK |
| `/admin/jobs` | ✅ 200 OK |
| `/admin/skills` | ✅ 200 OK |
| `/admin/items` | ✅ 200 OK |
| `/admin/materials` | ✅ 200 OK |
| `/admin/monsters` | ✅ 200 OK |
| `/admin/demon-forms` | ✅ 200 OK |
| `/admin/audit` | ✅ 200 OK |

### 5.3 コンテンツ検証

**ダッシュボード** — 表示内容確認:
```html
"NECRO ADMIN", "enemies.json", "stages.json", "jobs.json" → 全て表示確認
```

**敵データページ** — エントリ表示確認:
```html
"grave_soldier", "rot_hound", "ossuary_wyrm", "BOSS", "ELITE", "MINION", "UNDEAD", "BEAST" → 全て表示確認
```

**監査パネル** — 監査結果:
```
0 FAIL, 0 WARN, 170 PASS
```
第1章マスターデータは全チェック通過。

### 5.4 解決した問題

**問題**: `/admin` ダッシュボードが HTTP 500 を返した  
**原因**: `page.tsx` の `<Link>` コンポーネントに `onMouseEnter` / `onMouseLeave` イベントハンドラを渡していた（Server Component ではイベントハンドラ不可）  
**解決**: イベントハンドラを削除し、Tailwind の transition class と style props のみを使用

---

## 6. デザイン仕様（実装値）

### カラー
| 用途 | 値 |
|---|---|
| 管理ツール背景 | `#08080f` |
| パネル背景 | `#111118` |
| ナビ背景 | `#0d0d14` |
| アクセント | `#8B00FF` |
| テキスト（本文）| `#c8c8d8` |
| テキスト（ラベル）| `#7878a8` |
| 見出し | `#e0d0ff` |

### バッジカラー（実装値）
| バッジ | 背景 | 文字 |
|---|---|---|
| MINION | `rgba(63,63,70,0.7)` | `#d4d4d8` |
| ELITE | `rgba(124,45,18,0.6)` | `#fdba74` |
| BOSS | `rgba(127,29,29,0.6)` | `#fca5a5` |
| UNDEAD | `rgba(88,28,135,0.6)` | `#d8b4fe` |
| DEMON | `rgba(127,29,29,0.6)` | `#fca5a5` |
| BEAST | `rgba(6,78,59,0.6)` | `#6ee7b7` |
| HUMANOID | `rgba(30,58,138,0.6)` | `#93c5fd` |
| DRAGON | `rgba(113,63,18,0.6)` | `#fde68a` |
| R | `rgba(63,63,70,0.7)` | `#d4d4d8` |
| SR | `rgba(30,58,138,0.6)` | `#93c5fd` |
| SSR | `rgba(113,63,18,0.6)` | `#fde68a` |
| UR | `rgba(88,28,135,0.6)` | `#e9d5ff` |

---

## 7. 未実装事項（Phase 2 以降）

- 各エントリの編集フォーム
- フィルタ・ソート機能
- ファイル直接保存（writeMasterFile Server Action）
- ダメージシミュレータ
- 依存関係タブ（「この敵が出るステージ」など横断参照）
