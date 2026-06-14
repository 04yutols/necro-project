# ネクロマンス・ブレイブ (Necromance Brave)

魔族の少年が親友の復讐と「新魔王」への道を歩む、魔王育成・ターン制RPG。  
Gothic-Morphism デザイン (Void Purple `#8B00FF` / Obsidian Glass) — Star Rail / Genshin クオリティを目指す。

## ゲームシステム

| システム | 設計書 | 概要 |
|---|---|---|
| 職業 (勇者の力) | 10 | Tier1/2 の12職業。転職しても永続パッシブが蓄積 |
| 死霊術 (魔族の力) | 05 | 3スロットコスト制の軍団編成。Lv.99→ランクアップ転生 |
| WAVE制バトル | 03 | ターン制コマンドバトル。属性×攻撃種別のエリアギミック |
| 深淵の残滓 | 11 | ランダムサブオプション付きビルドアイテム (原神・聖遺物ライク) |
| 魔神化 | 16 | ゲージ MAX 時に発動。3行動後に自動終了 |
| 第一発見者システム | 28 | 隠しユニーク初ドロップ者名がアイテムに刻印される |

## 技術スタック

```
Framework:  Next.js 15 (App Router, SPA)
UI:         React 19, Tailwind CSS v4, Framer Motion
Game:       SVG + Framer Motion (BattleCanvas), PixiJS 8 (MapCanvas)
State:      Zustand 5
Backend:    Next.js Server Actions, Prisma 6, PostgreSQL (Neon)
Testing:    Jest (unit/integration), Playwright (E2E)
Deploy:     Cloudflare Workers (opennextjs-cloudflare)
```

## 起動

```bash
# Docker (推奨 — PostgreSQL ローカル込み)
# 1. .env.local.example を .env.local にコピーして AUTH_SECRET を設定
cp .env.local.example .env.local
# 2. 起動
docker compose up --build
# → http://localhost:3080

# ローカル (Neon など外部DBを使う場合)
npm install
# .env.local に DATABASE_URL を設定
npx prisma migrate deploy && npx prisma generate
npm run dev          # Next.js full server → http://localhost:3000
npm run dev:ui       # Vite (UI専用、Server Actions / admin は動かない) → http://localhost:5173
```

## 開発者向け: 管理画面 (`/admin`)

**development モードでのみ動作**。`NODE_ENV=production` ではミドルウェアと `assertDev()` により全 route / Server Action がブロックされる。

| 機能 | URL | 説明 |
|---|---|---|
| マスターデータ編集 | `/admin/enemies` など | JSON を GUI で編集・保存 |
| AI 草案エージェント | `/admin/agents` | LangGraph + Gemini (設計書 100–107) |
| 一括変更 | `/admin/agents/batch` | 自然言語 → BulkSpec 変換 |
| 監査 | `/admin/audit` | マスターデータ整合性チェック |
| シミュレータ | `/admin/simulator` | 戦闘シミュレーション評価 |
| ストーリー生成 | `/admin/story` | 会話シーン草案生成 |

### AI エージェントに必要な環境変数 (`.env.local`)

```bash
# aistudio (無料枠) を使う場合
GEMINI_BACKEND="aistudio"
GEMINI_API_KEY="..."

# Vertex AI (GCP 推奨) を使う場合
GEMINI_BACKEND="vertex"
GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
GOOGLE_CLOUD_REGION="us-central1"
# 事前に: gcloud auth application-default login
```

### AI エージェント CLI 検証スクリプト

```bash
npm run agent:verify              # エネミー生成エージェント
npm run agent:verify-skill        # スキル
npm run agent:verify-demon        # 魔神化形態
npm run agent:verify-stage        # ステージ
npm run agent:verify-weapon       # 武器
npm run agent:verify-material     # 素材
npm run agent:verify-job          # 職業
npm run agent:verify-area         # エリア
npm run agent:verify-monster      # 魔物
npm run agent:verify-audit-fix    # 監査修正エージェント
npm run agent:verify-sim-eval     # シミュレータ評価
npm run agent:verify-story        # ストーリー生成
npm run agent:verify-bulk         # 一括変更
```

### マスターデータ / バランス解析スクリプト

```bash
npm run data:audit          # 全マスターデータ整合性チェック
npm run data:template       # エントリ雛形生成
npm run balance:report      # バランスレポート
npm run balance:progression # 成長曲線レポート
npm run balance:drops       # ドロップ率レポート
npm run balance:skills      # スキル強度レポート
```

## プロジェクト構造

```
src/
├── app/
│   ├── page.tsx          SPA エントリ — currentTab で画面切り替え
│   ├── layout.tsx        viewport設定 (maximumScale:1, viewportFit:cover, 100dvh), フォント
│   ├── globals.css       Gothic-Morphism グローバル CSS
│   ├── actions.ts        ゲーム用 Server Actions (ステージクリア・装備・転職等)
│   └── admin/            ★開発専用 — adminGuard で production ブロック
│       ├── actions.ts    マスターデータ R/W Server Actions
│       └── agents/       AI エージェント UI + Server Actions
├── components/
│   ├── battle/           BattleCanvas.tsx (SVG+Framer Motion), ResultScreen.tsx
│   ├── home/             HomeHero.tsx
│   ├── layout/           ResponsiveFrame.tsx, BottomNavBar.tsx, MobileHeader.tsx
│   ├── legion/           LegionHub.tsx (軍団編成 + 装備 + 残滓管理)
│   ├── map/              AreaMap.tsx, MapCanvas.tsx (PixiJS)
│   ├── necro/            NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx
│   ├── story/            DialogueScene.tsx, MonologueOverlay.tsx, ChapterTitleCard.tsx,
│   │                     StoryOrchestrator.tsx, StoryArchive.tsx
│   ├── tutorial/         SpotlightOverlay.tsx, BubbleHint.tsx, TutorialOrchestrator.tsx
│   └── ui/               ArmySlot, CapsuleStatBar, FuchsiaButton, GameFrame, NecroLog
├── lib/
│   └── agent/            LangGraph+Gemini エージェント群 + *Balance.ts 決定論ゲート
├── logic/                ゲームロジック (~30 モジュール)
│   ├── BattleDamage.ts   BattleEngine / BattleCanvas 共通ダメージ計算式
│   ├── BattleEngine.ts   純粋クラス。React/Zustand 依存なし
│   └── GameManager.ts    ゲームループ全体 (サーバーサイド, Prisma使用)
├── services/             JobService, NecroService, RewardService, MasterDataService 等
├── store/
│   ├── useGameStore.ts   Zustand — 全クライアント状態
│   ├── useStoryStore.ts  ストーリー進行 (Zustand persist)
│   └── useTutorialStore.ts チュートリアル進行 (Zustand persist)
├── types/
│   └── game.ts           全型定義の正典
└── data/
    ├── master/           areas, demonForms, enemies, items, jobs,
    │                     materials, monsters, skills, stages (9ファイル)
    └── story/            ch1_scenes.json (17シーン)
```

## 画面構成 (currentTab)

| Tab | コンポーネント | 表示方式 |
|---|---|---|
| `HOME` | HomeHero | ResponsiveFrame内 |
| `MAP` | AreaMap | 全画面オーバーレイ (z:9999) |
| `BATTLE` | BattleCanvas | 全画面オーバーレイ (z:9999) |
| `EQUIP` | LegionHub | ResponsiveFrame内 |
| `LAB` | NecroLab | ResponsiveFrame内 |
| `LOGS` | NecroLog / StoryArchive | ResponsiveFrame内 |
| `JOB` | JobChangeScreen | 内部遷移 (ナビに表示なし) |

## Zustand ストア主要状態

```typescript
player: CharacterData | null
necroStatus: NecroStatus | null           // { level, rank, maxCost, baseStatsBonus }
party: (MonsterData | null)[]             // 常に3スロット
inventoryMonsters: MonsterData[]
soulShards: SoulShardData[]
inventoryItems: ItemData[]
abyssalResidues: AbyssalResidueData[]     // lv1-20, rarity: R/SR/SSR/UR
equippedResidueSlots: (AbyssalResidueData | null)[]  // 5スロット
residueMaterials: ResidueMatData[]
demonGauge: number                        // 0-100
isDemonMode: boolean
demonActionsRemaining: number             // 3行動で自動解除
currentTab: 'HOME'|'BATTLE'|'MAP'|'EQUIP'|'LAB'|'LOGS'|'JOB'
battleLogs: string[]                      // 最大50件
isServerBacked: boolean                   // ログイン済みの場合 true
```

## ダメージ計算式 (src/logic/BattleDamage.ts)

```
baseDamage    = ATK × powerMultiplier
defReduction  = 1 - DEF / (DEF + 200)
elementBoost  = 1 + elementDmgBoostPct / 100 + synergyElementPct / 100
resistance    = 1 - resistancePct / 100       // resistancePct < 0 → 弱点
critMulti     = 1 + critDmg / 100             // critDmg=150 (デフォルト) で2.5倍
finalDamage   = max(1, floor(baseDamage × defReduction × elementBoost × resistance × critMulti))
```

## テスト

```bash
npm test                                        # Jest 全テスト (co-located *.test.ts)
npm test -- --testPathPattern="BattleEngine"    # 単一ファイル
npx playwright test                             # E2E (docker compose 起動後 or localhost:3080)
npx tsc --noEmit                                # 型チェック
```

- ユニットテスト: `src/logic/*.test.ts`, `src/services/*.test.ts`, `src/lib/agent/*.test.ts`
- DB統合テスト: `src/tests/` (CI 除外 — 実 Neon 接続が必要)
- E2E: `tests/*.spec.ts` (Playwright、デフォルト `http://localhost:3080`)

## デプロイ

```bash
npm run deploy    # Cloudflare Workers (opennextjs-cloudflare build + deploy)
npm run preview   # Cloudflare ローカルプレビュー
npm run upload    # ビルドのみアップロード (デプロイなし)
```

## 設計ルール

- **iOS Safari**: `overflow:hidden` と CSS `transform` を同一要素に置かない (`motion.div` は transform のみ、内側 `div` が `overflow:hidden`)
- **BattleCanvas**: SVG + Framer Motion で実装。PixiJS は使っていない (MapCanvas / NecroLab Pixi hooks のみ PixiJS)
- **パーティ**: 常に3スロット。配備前に `NecroStatus.maxCost` に対してコスト検証
- **MasterDataService**: `MasterDataService.getInstance()` のみ使用 (`new` しない)
- **テストでマスターデータを書き換えない**: CI が `git diff --exit-code src/data/master` で機械的に検証する
- **admin は development 専用**: `adminGuard.ts` の `assertDev()` + `middleware.ts` でブロック。production に混入させない
- **Prisma スキーマ変更後**: `npx prisma generate` を実行

## 設計書

`docs/設計書/` に全設計書。`docs/設計書/00_INDEX.md` に早引き表。  
`docs/progress/CH1_TODO.md` が第1章実装チェックリスト。`docs/progress/TECH_DEBT.md` に積み残しバグ。
