# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Startup

新しいセッションを開始したら、まず以下を確認する:

1. **作業タスク** → `docs/progress/CH1_TODO.md` — 第1章実装チェックリスト（Phase A〜D）
2. **設計書参照** → `docs/設計書/00_INDEX.md` — 「この質問ならこの設計書」早引き表
3. **完了済み確認** → `docs/progress/DONE.md` — 実装済みシステム・解決済み意思決定
4. **今回の作業が第2章以降でないか** → `docs/progress/DEFERRED.md` で確認

## Project Overview

**Necromance Brave (ネクロマンスブレイブ)** — dark-fantasy mobile-first hack-and-slash RPG. Core game loop: Hub preparation → Map stage select → WAVE-based turn battle → Result screen.

- Design aesthetic: **Gothic-Morphism** — Void Purple `#8B00FF`, obsidian glass, aged parchment, bone frames
- Target quality: Star Rail / Genshin Impact production level
- Release scope: **第1章「亡国の王都」のみ**（5ステージ）

## Commands

```bash
npm run dev          # Next.js dev server on 0.0.0.0:3000
npm run build        # Production build
npm test             # Run all Jest tests
npm test -- --testPathPattern="BattleEngine"  # Single test file
npx tsc --noEmit     # Type check (run after every code change)
npx playwright test  # E2E tests (expects dev server at localhost:3080)
```

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

### Routing / navigation

Single-page app (`src/app/page.tsx`), navigation via `currentTab` in Zustand.  
Tabs: `HOME | BATTLE | MAP | EQUIP | LAB | LOGS`  
MAP and BATTLE = full-screen overlays (`position: absolute, inset: 0, zIndex: 9999`).  
BattleCanvas loaded via `next/dynamic` with `ssr: false`.

### Component layout

```
src/components/
  battle/    BattleCanvas.tsx (PixiJS), ResultScreen.tsx
  home/      HomeHero.tsx
  layout/    ResponsiveFrame.tsx, BottomNavBar, DashboardFrame, MobileHeader
  legion/    LegionHub.tsx (army formation + equipment)
  map/       AreaMap.tsx, MapCanvas.tsx (PixiJS)
  necro/     NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx
  ui/        ArmySlot, CapsuleStatBar, GameFrame, NecroLog, FuchsiaButton
  story/     DialogueScene.tsx, MonologueOverlay.tsx, ChapterTitleCard.tsx  ← Phase B 実装予定
  tutorial/  SpotlightOverlay.tsx, BubbleHint.tsx  ← Phase B 実装予定
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

## Damage Formula (BattleEngine.calculateDamage)

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
if (isCritical) damage *= (critDmg + synergyBonus.critDmgBonus) / 100

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
