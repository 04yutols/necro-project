# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Session Startup

新しいセッションを開始したら、まず以下を確認する:

1. **作業タスク** → `docs/progress/CH1_TODO.md` — 第1章実装チェックリスト（Phase A〜D）
2. **設計書参照** → `docs/設計書/00_INDEX.md` — 「この質問ならこの設計書」早引き表
3. **完了済み確認** → `docs/progress/DONE.md` — 実装済みシステム・解決済み意思決定
4. **今回の作業が第2章以降でないか** → `docs/progress/DEFERRED.md` で確認

技術的負債・バグの一覧は `docs/progress/TECH_DEBT.md`。

## Project Overview

**Necromance Brave (ネクロマンスブレイブ)** — dark-fantasy mobile-first hack-and-slash RPG. Core game loop: Hub preparation → Map stage select → WAVE-based turn battle → Result screen.

- Design aesthetic: **Gothic-Morphism** — Void Purple `#8B00FF`, obsidian glass, aged parchment, bone frames
- Target quality: Star Rail / Genshin Impact production level
- Release scope: **第1章「亡国の王都」のみ**（5ステージ）

## Commands

```bash
npm run dev          # Next.js dev server on 0.0.0.0:3000（フル機能: Server Actions / admin / NextAuth）
npm run dev:ui       # Vite dev server（UI 高速イテレーション用。Server Actions/admin は動かない）
npm run build        # Production build
npm test             # Run all Jest tests
npm test -- --testPathPattern="BattleEngine"  # Single test file
npx tsc --noEmit     # Type check (run after every code change)
npx playwright test  # E2E tests (expects dev server at localhost:3080)
npm run content:assets:prompts -- <package.json>  # Codex画像生成jobを作る
npm run content:assets:forge -- <package.json>    # 原本を検査・WebP化・manifest更新
npm run content:assets:check -- <package.json>    # 画像manifestを非破壊検査
```

CI（`.github/workflows/ci.yml`）: push/PR で tsc + jest（`src/tests/` の DB 統合テストは除外）+
`git diff --exit-code src/data/master`（テスト非破壊チェック）を実行する。

## Architecture

### Separation of concerns

- **`src/types/game.ts`** — canonical TypeScript types. Source of truth for all game entities.
- **`src/logic/BattleEngine.ts`** — pure class, turn-based combat. No React/Zustand dependency.
- **`src/logic/TribeSynergySystem.ts`** — tribe synergy calculation, integrated into BattleEngine.
- **`src/logic/StatusAilmentSystem.ts`** — ailment application/processing with immuneTypes support.
- **`src/logic/DemonizationSystem.ts`** — demonization gauge and form management.
- **`src/logic/GameManager.ts`** — full game loop orchestration (server-side, uses Prisma).
- **`src/services/MasterDataService.ts`** — singleton. Always use `MasterDataService.getInstance()`.
- **`src/services/`** — `JobService`, `NecroService`, `RewardService` each own one domain.
- **`src/store/useGameStore.ts`** — Zustand store: all client runtime state.
- **`src/lib/agent/`** — admin-screen AI draft agents (LangGraph + Gemini) with deterministic
  balance gates (`*Balance.ts`). Surfaced via `src/app/admin/`. See `docs/設計書/100〜107`.
- **`src/lib/content/`** — Content Package、数値Authoring、Visual Asset Forge。画像原本は`content/packages/{id}/originals/`、最適化物は`optimized/`。

### Master data (src/data/master/)

`areas` / `demonForms` / `enemies` / `items` / `jobs` / `materials` / `monsters` / `skills` / `stages` /
`necroConfig` / `residueNames`.
Keyed JSON objects loaded by `MasterDataService`. Story scenes live in `src/data/story/`.

### Routing / navigation

Single-page app (`src/app/page.tsx`), navigation via `currentTab` in Zustand.
Tabs: `HOME | BATTLE | MAP | EQUIP | LAB | LOGS`
MAP and BATTLE = full-screen overlays (`position: absolute, inset: 0, zIndex: 9999`).
BattleCanvas loaded via `next/dynamic` with `ssr: false`.

### Component layout

```
src/components/
  admin/     AdminNav, *List.tsx, AI*DraftPanel.tsx, AuditPanel, SimulatorClient
  battle/    BattleCanvas.tsx (SVG + Framer Motion。PixiJS 不使用), ResultScreen.tsx
  home/      HomeHero.tsx
  layout/    ResponsiveFrame.tsx, BottomNavBar, DashboardFrame, MobileHeader
  legion/    LegionHub.tsx (army formation + equipment)
  map/       AreaMap.tsx, MapCanvas.tsx (PixiJS)
  necro/     NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx
  ui/        ArmySlot, CapsuleStatBar, GameFrame, NecroLog, FuchsiaButton
  story/     DialogueScene.tsx, MonologueOverlay.tsx, ChapterTitleCard.tsx, StoryArchive.tsx
  tutorial/  TutorialOrchestrator.tsx, SpotlightOverlay.tsx, BubbleHint.tsx, TutorialBanner.tsx
src/store/   useGameStore.ts, useStoryStore.ts, useTutorialStore.ts, useAudioStore.ts
```

## Stats System

**8種ステータス（game.ts の BaseStats）:**

| フィールド | 説明 | デフォルト |
|---|---|---|
| `hp` | 最大HP | — |
| `atk` | 攻撃力（物理・魔法共通） | — |
| `def` | 防御力 | — |
| `spd` | 速度（行動値 = 10000/spd） | — |
| `critRate` | 会心率 % | 5.0 |
| `critDmg` | 会心ダメージ % | 150.0 |
| `effectHit` | 効果命中 % | 0.0 |
| `effectRes` | 効果抵抗 % | 0.0 |

**Energy リソース:**
`currentEnergy` / `maxEnergy` — スキルコストは旧名 `mpCost` をマスターデータ互換で維持。

## Damage Formula (BattleEngine.calculateDamage / BattleDamage.ts)

```
// 1. 基礎ダメージ
damage = atk × powerMultiplier

// 2. 防御軽減（HSR簡易版）
defMult = 1 - def / (def + 200)
damage *= defMult

// 3. 属性ダメージ加成（装備/残滓 + 種族シナジー）
damage *= (1 + elementBoostPct/100 + synergyElementPct/100)

// 4. 属性耐性（resistance < 0 = 弱点, > 0 = 耐性）
damage *= (1 - resistance/100)

// 5. 会心
isCritical = random() * 100 < (critRate + synergyBonus.critRateBonus)
if (isCritical) damage *= 1 + (critDmg + synergyBonus.critDmgBonus) / 100

finalDamage = Math.max(1, Math.floor(damage))
```

## Key Types (src/types/game.ts)

```typescript
Tribe = 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID' | 'DRAGON' | 'ORC'
ElementType = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH' | 'WIND' | 'ICE' | 'LIGHT' | 'DARK' | 'NONE'

BaseStats: { hp, atk, def, spd, critRate, critDmg, effectHit, effectRes: number }

CharacterData: {
  id, name, currentJobId, category: ClassCategory
  stats: BaseStats, passives: PassiveBonuses
  equipment: EquipmentSlots  // weapon + 7 slots (weapon only active)
  baseResistances: Resistances
  jobs: UserJobState[], isAwakened: boolean, clearedStages: string[]
  currentEnergy: number, maxEnergy: number
  elementDmgBoosts: Partial<Record<ElementType, number>>
}

MonsterData: {
  id, name, tribe: Tribe, cost: number
  stats: BaseStats, resistances: Resistances
  equipment?: EquipmentSlots           // weapon slot
  equippedResidues?: (AbyssalResidueData | null)[]  // 5 slots
  equippedShardId?: string             // SoulShard
  spiritCore?: SpiritCoreData
  // battle runtime only (not persisted):
  tier?, weaknesses?, shieldHp?, statusEffects?
}

SoulShardData: { id, originMonsterName, effect: { atkBonus, elementDmgBoost, specialAbility? } }
AbyssalResidueData: { id, name, itemId, rarity, mainStat, subOptions, level(1-20), exp, maxExp }
SpiritCoreData: { id, name, element?, skillChangeId?, atkMultiplier }
NecroStatus: { level(1-99), rank(1-10), maxCost, baseStatsBonus }
```

## Coding Rules

- **Party = Aldo (CharacterData) + 3 monster slots (`(MonsterData | null)[]`)**. No human companions in Part 1.
- Party always has exactly 3 slots. Validate cost against `necroStatus.maxCost` before deploying.
- Keep PixiJS at 60fps — avoid heavy JS in the render loop; prefer pre-computed values.
- All UI text for actions uses direct Japanese verbs: 装備, 強化, 攻撃, 術, 魔神化.
- `MasterDataService` is a singleton — always use `MasterDataService.getInstance()`.
- Run `npx tsc --noEmit` after every code change.

## iOS Safari Layout Rule

**Never put `overflow: hidden` and CSS `transform` on the same element.**
Always separate into two layers:

```tsx
// GOOD
<motion.div animate={{ y: 0 }} style={{ position: 'absolute', inset: 0 }}>
  <div className="absolute inset-0 overflow-hidden">
    {/* content */}
  </div>
</motion.div>
```

## Database (Prisma + PostgreSQL)

Schema: `prisma/schema.prisma`. Run `npx prisma generate` after schema changes.
Key models: `Character`, `UserJob`, `Monster`, `SoulShard`, `SpiritCore`, `Item`, `AbyssalResidue`.
Online: NextAuth.js v5 + Upstash Redis (ranking) + Pusher Channels (world log) — see `docs/設計書/25_オンラインゲーム設計.md`.

## Task Tracking (docs/progress/)

| ファイル | 用途 |
|---|---|
| `docs/progress/CH1_TODO.md` | **第1章実装チェックリスト** Phase A〜D ← 作業時はここを見る |
| `docs/progress/DONE.md` | 完了済みアーカイブ（設計書・実装・意思決定） |
| `docs/progress/DEFERRED.md` | 第2章以降に先送り（今は実装しない） |
| `docs/progress/TECH_DEBT.md` | 技術的負債・バグ一覧（C-X / M-X / NC-X / NM-X / NL-X） |
