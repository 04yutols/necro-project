# ネクロマンス・ブレイブ (Necromance Brave)

魔族の少年が親友の復讐と「新魔王」への道を歩む、魔王育成・ターン制RPG。  
Gothic-Morphism デザイン (Void Purple / Obsidian Glass) — Star Rail / Genshin クオリティを目指す。

## ゲームシステム

| システム | GDD | 概要 |
|---|---|---|
| 職業 (勇者の力) | GDD-004 | Tier1/2 の12職業。転職しても永続パッシブが蓄積 |
| 死霊術 (魔族の力) | GDD-005 | 3スロットコスト制の軍団編成。Lv.99→ランクアップ転生 |
| WAVE制バトル | GDD-006 | ターン制コマンドバトル。属性×攻撃種別のエリアギミック |
| 深淵の残滓 | GDD追加 | ランダムサブオプション付きビルドアイテム (原神・聖遺物ライク) |
| 魔神化 | GDD追加 | ゲージが MAX 時に発動。demon ガウジ 0-100 |
| 第一発見者システム | GDD追加 | 隠しユニーク初ドロップ者名がアイテムに刻印される |

## 技術スタック

```
Framework:  Next.js 15 (App Router, SPA)
UI:         React 19, Tailwind CSS v4, Framer Motion
Game:       PixiJS 8 (BattleCanvas, MapCanvas)
State:      Zustand 5
Backend:    Next.js Server Actions, Prisma 6, PostgreSQL
Testing:    Jest (unit), Playwright (E2E)
```

## 起動

```bash
# Docker (推奨)
docker compose up --build
# → http://localhost:3080

# ローカル
npm install
# .env に DATABASE_URL="postgresql://..." を設定
npx prisma db push && npx prisma generate
npm run dev
# → http://localhost:3000
```

## プロジェクト構造

```
src/
├── app/
│   ├── page.tsx          SPA エントリ — currentTab で画面切り替え
│   ├── layout.tsx        viewport設定 (maximumScale:1, 100dvh), フォント定義
│   ├── globals.css       Gothic-Morphism グローバル CSS
│   └── actions.ts        Server Actions
├── components/
│   ├── battle/           BattleCanvas.tsx (PixiJS), ResultScreen.tsx, AppraisalCertificate.tsx
│   ├── character/        EquipmentManager.tsx (未使用; LegionHub が EQUIP タブを担当)
│   ├── home/             HomeHero.tsx
│   ├── layout/           ResponsiveFrame.tsx, BottomNavBar.tsx, MobileHeader.tsx, DashboardFrame.tsx
│   ├── legion/           LegionHub.tsx (軍団編成 + 8スロット装備 + 深淵残滓管理 — 1342行)
│   ├── map/              AreaMap.tsx, MapCanvas.tsx (PixiJS)
│   ├── necro/            NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx, SoulSlotRing.tsx
│   │                     useNecroLabPixi.ts, useGothicSound.ts, useResidueEnhancePixi.ts
│   └── ui/               ArmySlot, CapsuleStatBar, FuchsiaButton, GameFrame, GrimoireLog, NecroLog
├── logic/
│   ├── BattleEngine.ts   純粋クラス。React/Zustand 依存なし。BattleLog[] を返す
│   └── GameManager.ts    ゲームループ全体 (サーバーサイド, Prisma使用)
├── services/
│   ├── MasterDataService.ts  シングルトン。src/data/master/*.json を読む
│   ├── JobService.ts
│   ├── NecroService.ts
│   └── RewardService.ts
├── store/
│   └── useGameStore.ts   Zustand — 全クライアント状態。initialize() でモックデータ投入
├── types/
│   └── game.ts           全型定義の正典 (GDD参照注釈付き)
└── data/master/
    jobs.json, monsters.json, items.json, stages.json, skills.json
```

## 画面構成 (currentTab)

| Tab | コンポーネント | 表示方式 |
|---|---|---|
| HOME | HomeHero | ResponsiveFrame内 |
| MAP | AreaMap | 全画面オーバーレイ (z:9999) |
| BATTLE | BattleCanvas (PixiJS) | 全画面オーバーレイ (z:9999) |
| EQUIP | LegionHub | ResponsiveFrame内 |
| LAB | NecroLab | ResponsiveFrame内 |
| LOGS | NecroLog (inline) | ResponsiveFrame内 |

## Zustand ストア主要状態

```typescript
player: CharacterData | null
necroStatus: NecroStatus | null           // { level, rank, maxCost, baseStatsBonus }
party: (MonsterData | null)[]             // 常に3スロット
inventoryMonsters: MonsterData[]
soulShards: SoulShardData[]
inventoryItems: ItemData[]
abyssalResidues: AbyssalResidueData[]     // lv1-20, rarity: COMMON/RARE/EPIC
equippedResidueSlots: (AbyssalResidueData | null)[]  // 3スロット
residueMaterials: ResidueMatData[]
demonGauge: number                        // 0-100
isDemonMode: boolean
currentTab: 'HOME'|'BATTLE'|'MAP'|'EQUIP'|'LAB'|'LOGS'
battleLogs: string[]                      // 最大50件
```

## ダメージ計算式

```
baseDamage = stat² / (stat + counterStat)   // 物理: ATK vs DEF / 魔法: MATK vs MDEF
finalDamage = baseDamage × powerMultiplier × elementMultiplier × (1 + TEC/100)
critMultiplier = 1.5 + TEC/200              // LUCK% でクリット判定
elementMultiplier = 1 - (resistance / 100)  // resistance < 0 → 弱点
```

## テスト

```bash
npm test                                        # Jest 全テスト
npm test -- --testPathPattern="BattleEngine"    # 単一ファイル
npx playwright test                             # E2E (dev server 要)
npx tsc --noEmit                                # 型チェック
```

テストファイル: `src/logic/BattleEngine.test.ts`, `src/services/*.test.ts`, `src/tests/integration.test.ts`  
E2E: `tests/` 配下 (Playwright, デフォルト `http://localhost:3080`)

## 設計ルール

- **iOS Safari**: `overflow:hidden` と CSS `transform` を同一要素に置かない。`motion.div` は transform のみ、内側の `div` が `overflow:hidden` を持つ
- **PixiJS**: 60fps 維持。レンダーループ内で重い JS を実行しない
- **パーティ**: 常に3スロット。配備前に `NecroStatus.maxCost` に対してコスト検証
- **MasterDataService**: `MasterDataService.getInstance()` のみ使用 (`new` しない)
- **UI テキスト**: 直接的な日本語動詞 — 装備, 強化, 攻撃, 術, 魔神化
- **GDD参照**: コメント内 `GDD-003` 等は `docs/requirements.md` のセクションを指す
- **Prisma スキーマ変更後**: `npx prisma generate` を実行する
