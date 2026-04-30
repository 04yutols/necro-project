# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Necromance Brave (ネクロマンスブレイブ)** — a dark-fantasy mobile-first hack-and-slash RPG. The protagonist wields both hero and demon-lord powers via necromancy. Core game loop: Hub preparation → Map stage select → WAVE-based turn battle → Result screen (with "purple pillar" rare drop VFX).

Design aesthetic: **Gothic-Morphism** — obsidian dark glass, aged parchment, bone frames, and Void Purple (#8A2BE2) as the accent color. Targeting "Star Rail / Genshin" production quality.

## Commands

```bash
# Development
npm run dev          # Next.js dev server on 0.0.0.0:3000

# Build
npm run build        # Production build

# Unit tests (Jest, .test.ts files under src/)
npm test             # Run all Jest tests
npm test -- --testPathPattern="BattleEngine"  # Single test file

# E2E tests (Playwright, tests/ directory)
npx playwright test                          # All E2E tests
npx playwright test tests/necro-lab.spec.ts  # Single spec
npx playwright test --headed                 # Headed mode
```

Playwright expects the dev server at `http://localhost:3080` by default (override with `PLAYWRIGHT_TEST_BASE_URL`).

## Architecture

### Separation of concerns

Game logic is strictly separated from UI components:

- **`src/types/game.ts`** — canonical TypeScript types for all game entities (CharacterData, MonsterData, BattleState, etc.). All GDD references are annotated here.
- **`src/logic/BattleEngine.ts`** — pure class for turn-based combat simulation. Accepts `CharacterData` + `MonsterData[]`, returns `BattleLog[]`. No React/Zustand dependency. Called from `BattleCanvas.tsx` to drive animation.
- **`src/logic/GameManager.ts`** — orchestrates the full game loop (startStage, processStageResult, soulStone). Uses Prisma directly; server-side only.
- **`src/services/MasterDataService.ts`** — singleton that loads JSON master data files from `src/data/master/` (jobs, monsters, items, stages, skills). Used by both `BattleEngine` and `GameManager`.
- **`src/services/`** — `JobService`, `NecroService`, `RewardService` each own one domain; called by `GameManager`.
- **`src/store/useGameStore.ts`** — Zustand store holding all runtime client state: `player`, `party` (3 slots), `inventoryMonsters`, `soulShards`, `inventoryItems`, `currentTab`, `battleLogs`, `actionTrigger`. `initialize()` seeds mock data for local dev (no DB required).

### Routing / navigation

The app is a single-page app (`src/app/page.tsx`). Navigation is managed entirely by `currentTab` in Zustand (`HOME | BATTLE | MAP | EQUIP | LAB | LOGS`). `BattleCanvas` is loaded via `next/dynamic` with `ssr: false` (PixiJS is browser-only).

### Component layout

```
src/components/
  battle/      BattleCanvas.tsx (PixiJS), ResultScreen.tsx, AppraisalCertificate.tsx
  character/   EquipmentManager.tsx
  home/        HomeHero.tsx
  layout/      ResponsiveFrame.tsx (wraps left/main/right), BottomNavBar, DashboardFrame, MobileHeader
  map/         AreaMap.tsx, MapCanvas.tsx (PixiJS)
  necro/       NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx, SoulSlotRing.tsx, useNecroLabPixi.ts, useGothicSound.ts
  ui/          Reusable primitives (ArmySlot, CapsuleStatBar, GameFrame, NecroLog, GrimoireLog, FuchsiaButton)
```

All screens must fit `h-[100dvh]` without scrolling or overlapping critical info.

### Damage formula (BattleEngine)

```
baseDamage = stat² / (stat + counterStat)          // ATK vs DEF, or MATK vs MDEF
finalDamage = baseDamage × powerMultiplier × elementMultiplier × (1 + TEC/100)
critMultiplier = 1.5 + TEC/200  (applied when LUCK% roll succeeds)
elementMultiplier = 1 - (resistance / 100)          // resistance < 0 → weakness
```

### Stats system

9 base stats: `hp, mp, atk, def, matk, mdef, agi, luck, tec`. Physical jobs have low max MP / low skill cost; Magical jobs have high max MP / high skill cost. Passive bonuses accumulated via job level milestones persist across job changes and are stored in `passiveAtkBonus` etc. on the Character model.

### Database (Prisma + PostgreSQL)

Schema is at `prisma/schema.prisma`. Key models: `Character` (9 stats + 8 equipment slots + passives + necro fields), `UserJob` (per-job level/exp), `Monster` (with optional `SoulShard` and `SpiritCore`), `Item` (with `isUnique`, `discovererId`, `serialNo` for the first-discoverer system), `AbyssalResidue`. Run `npx prisma generate` after schema changes.

## Coding Rules

- Keep PixiJS at 60fps — avoid heavy JS in the render loop; prefer pre-computed values.
- Party always has exactly 3 slots (`(MonsterData | null)[]`); validate cost against `NecroStatus.maxCost` before deploying.
- GDD references (e.g., `GDD-003`, `GDD-005`) in comments refer to `docs/requirements.md` sections.
- All UI text for actions uses direct Japanese verbs: 装備, 強化, 攻撃, 術, 魔神化.
- `MasterDataService` is a singleton — always use `MasterDataService.getInstance()`.
