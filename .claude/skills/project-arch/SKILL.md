---
name: project-arch
description: Necromance Brave のプロジェクト構造・パターン・規約の完全リファレンス — ファイル配置、Zustand、Pixi.js、型システム
---

# Necromance Brave — プロジェクトアーキテクチャ

## ディレクトリ構成

```
src/
  app/
    page.tsx          ← SPA エントリ。currentTab で画面切り替え
    layout.tsx        ← viewport 設定 (maximumScale:1, viewportFit:cover)、フォント定義
    globals.css       ← Gothic-Morphism グローバル CSS
    actions.ts        ← Server Actions（auth() 必須、ステージトークン検証あり）
    api/              ← API Routes（NextAuth 等）
    admin/            ← 管理画面（adminGuard.ts でガード。enemies/skills/jobs/stages/
                         monsters/items/materials/areas/demon-forms/story/agents/
                         simulator/audit の各サブページ + admin/actions.ts）
  components/
    admin/     AdminNav, *List.tsx (各マスター一覧), AI*DraftPanel.tsx (AI草案),
               AuditPanel, BulkChangePanel, SimulatorClient, forms/
    auth/      AuthGate, AuthPanel, CharacterCreation, ReloginModal, LoadingScreen
    battle/    BattleCanvas.tsx (SVG + Framer Motion。PixiJS 不使用), ResultScreen.tsx,
               AppraisalCertificate.tsx
    character/ EquipmentManager.tsx（未使用 — LegionHub が EQUIP タブを担当）
    home/      HomeHero.tsx
    job/       JobChangeScreen.tsx
    layout/    ResponsiveFrame.tsx, BottomNavBar.tsx, MobileHeader.tsx, DashboardFrame.tsx
    legion/    LegionHub.tsx（軍団編成 + 装備管理の巨大コンポーネント）
    map/       AreaMap.tsx, MapCanvas.tsx (PixiJS — Pixi 使用箇所はここと necro の hooks)
    necro/     NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx, SoulSlotRing.tsx,
               useNecroLabPixi.ts, useGothicSound.ts, useResidueEnhancePixi.ts
    social/    WorldLogPanel.tsx (Pusher ワールドログ)
    story/     StoryOrchestrator, DialogueScene, MonologueOverlay, ChapterTitleCard,
               EnvironmentCaption, CharacterPortrait, TypewriterText, StoryArchive
    tutorial/  TutorialOrchestrator, SpotlightOverlay, BubbleHint, TutorialBanner
    ui/        ArmySlot, CapsuleStatBar, FuchsiaButton, GameFrame, GrimoireLog, NecroLog
  logic/       ← 純粋ロジック層（React 非依存・全モジュールに .test.ts ペアあり）
    BattleEngine.ts          ← ターン制バトルの中核クラス
    BattleDamage.ts          ← BattleEngine / BattleCanvas 共通のダメージ計算式
    BattleFlowSystem.ts, TurnOrderSystem.ts (spd→行動値), EnergySystem.ts
    StatusAilmentSystem.ts, TribeSynergySystem.ts, DemonizationSystem.ts
    BossGimmickSystem.ts, AreaGimmickSystem.ts, MonsterAttackSystem.ts
    NecromanceCaptureSystem.ts, PlayerDefeat.ts
    StatSystem.ts (calculateCharacterStatProfile), JobSystem.ts,
    JobGrowthSystem.ts, JobBaseStatsInterpolation.ts, ExperienceSystem.ts
    WeaponSystem.ts, WeaponPassive.ts, ResidueScore.ts, AbyssalResidueUnlockSystem.ts
    DropPolicySystem.ts, DungeonSystem.ts, StageAreaLinkSystem.ts, WorldMapSystem.ts
    GameManager.ts           ← ゲームループ全体。Prisma 使用。サーバーサイドのみ
    BalanceConfig.ts
  services/
    MasterDataService.ts  ← シングルトン。src/data/master/*.json を読む
    JobService.ts, NecroService.ts, RewardService.ts, AuthService.ts,
    SessionSecurityService.ts, RateLimitService.ts, RankingService.ts (Upstash),
    WorldEventService.ts (Pusher), AudioService.ts
  store/
    useGameStore.ts      ← Zustand。全クライアント実行時状態
    useStoryStore.ts, useTutorialStore.ts, useAudioStore.ts
  hooks/
    useAuthFlow, useBGM, useSoundEffects, useRanking, useWorldLog,
    useStoryTrigger, useTutorialTrigger
  lib/agent/   ← 管理画面 AI エージェント（LangGraph + Gemini。設計書 100〜107）
    enemyAgent/skillAgent/jobAgent/stageAgent/monsterAgent/weaponAgent/
    materialAgent/areaAgent/demonAgent/storyAgent.ts + 各 *Balance.ts (決定論的ゲート)
    auditFixAgent.ts + auditFix/, bulkAgent.ts + bulk/, simEvalAgent.ts + sim/,
    story/ (storyContext, storyValidator), gemini.ts, knownFields.ts, thinkingBudget.ts
  types/
    game.ts           ← 全型定義の正典（serverGame.ts はサーバー受け渡し用）
  data/
    master/   areas, demonForms, enemies, items, jobs, materials, monsters,
              skills, stages の 9 JSON
    story/    ch1_scenes.json, prologue_scenes.json, characters.json, packs.ts
    tutorial/ phases.ts
```

## ナビゲーション

```typescript
// currentTab の値と対応コンポーネント
type Tab = 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS' | 'JOB'

// MAP と BATTLE は全画面オーバーレイ (position:absolute, inset:0, z:9999)
// それ以外は ResponsiveFrame 内にレンダリング
// BattleCanvas は next/dynamic + ssr:false でロード

// 新タブ追加手順:
// 1. useGameStore.ts の currentTab 型に追加
// 2. BottomNavBar.tsx の TABS 配列に追加
// 3. page.tsx の if/switch に追加
```

## Zustand ストア (useGameStore.ts)

```typescript
const {
  // --- 永続データ ---
  player,                  // CharacterData | null
  necroStatus,             // NecroStatus | null — { level, rank, maxCost, baseStatsBonus, exp }
  party,                   // (MonsterData | null)[] — 常に 3 スロット
  inventoryMonsters,       // MonsterData[]
  soulShards,              // SoulShardData[]
  inventoryItems,          // ItemData[] — 武器 + CONSUMABLE（quantity でスタック）
  abyssalResidues,         // AbyssalResidueData[] — level 1-20
  equippedResidueSlots,    // (AbyssalResidueData | null)[] — 5スロット
  residueMaterials,        // ResidueMatData[]
  weaponMaterials,         // WeaponMaterialData[] — IDEA_COMMON/SR/SSR, ABYSSAL_OBSIDIAN
  transmutationPoints,     // number
  isServerBacked,          // boolean — loadFromServer() 後 true

  // --- バトルランタイム ---
  monsterCurrentHp,        // Record<string, number>
  battleLogs,              // string[] — 最大50件
  actionTrigger,           // { type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId? } | null

  // --- 魔神化 ---
  demonGauge,              // number 0-100
  isDemonMode,             // boolean
  demonActionsRemaining,   // number — DEMON_ACTION_LIMIT から減算
  demonUltimateUsed,       // boolean
  demonFormJobId,          // string | null — demonForms.json のキー
  demonEffectBFlag,        // string | null — onAttackEffect
  demonRiskType,           // DemonRiskType
  demonRiskValue,          // number

  // --- UI ---
  currentTab,              // Tab
  equippingMonsterId,      // string | null — モーダル制御

  // --- 主要アクション ---
  setCurrentTab, updatePartySlot, swapPartySlots, removeMonster,
  equipItem, unequipItem, equipShard, addSoulShard,
  equipResidueToSlot, upgradeResidue,
  rankUpWeapon, reforgeWeapon, dismantleWeapon,        // 武器: 共鳴/打ち直し/分解
  updateHP, updateEnergy, updateEnergyBy, restoreEnergy,
  addExp, addGold, addClearedStage, changeJob,
  consumeInventoryItem, addInventoryItems,
  fillDemonGauge, startDemonMode, consumeDemonAction, endDemonMode, toggleDemonMode,
  damageMonster, resetMonsterHp,
  addBattleLog, clearBattleLogs, setActionTrigger,
  initialize,              // ローカル開発用モックデータ投入（DB 不要）
  loadFromServer,          // ServerGameData → ストア反映 (isServerBacked: true)
  clearServerData,
} = useGameStore();
```

ストーリー進行は `useStoryStore.ts`、チュートリアルは `useTutorialStore.ts`、
音声は `useAudioStore.ts` に分離されている。

## 主要型 (src/types/game.ts)

```typescript
Tribe = 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID' | 'DRAGON' | 'ORC'
ElementType = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH' | 'WIND' | 'ICE' | 'LIGHT' | 'DARK' | 'NONE'
EnemyTier = 'MINION' | 'ELITE' | 'BOSS'
AilmentType = 'BLEED' | 'POISON' | 'BURN' | 'FREEZE' | 'PARALYSIS' | 'WEAKEN'

// 8種ステータス
BaseStats: { hp, atk, def, spd, critRate, critDmg, effectHit, effectRes: number }
// spd: 行動値 = 10000/spd。critRate 基礎5.0、critDmg 基礎150.0

CharacterData: {
  id, name, currentJobId, category: ClassCategory,
  baseStats?, stats: BaseStats, passives: PassiveBonuses,
  equipment: EquipmentSlots,        // weapon + 7 slots (weapon のみ有効)
  baseResistances: Resistances,
  jobs: UserJobState[], isAwakened: boolean, clearedStages: string[], gold: number,
  necroLevel?, necroBaseStatsBonus?,
  currentEnergy, maxEnergy: number, // Energy リソース（魔神化ゲージとは別）
  elementDmgBoosts: Partial<Record<ElementType, number>>
}

MonsterData: {
  id, masterId?, name, tribe: Tribe, cost: number,
  stats: BaseStats, resistances: Resistances, skillIds?: string[],
  equipment?: EquipmentSlots,                        // weapon スロットのみ使用
  equippedResidues?: (AbyssalResidueData | null)[],  // 5 slots
  equippedShardId?: string, spiritCore?: SpiritCoreData,
  // バトルランタイム専用 (DB 非保存):
  tier?, weaknesses?, shieldHp?, maxShieldHp?, statusEffects?, gimmicks?
}

SkillData: {
  id, name, mpCost, power: number,   // mpCost は旧名のままマスター互換維持
  type: 'PHYSICAL'|'MAGICAL'|'HEAL',
  element?, attackType?: SkillAttackType,
  targetType?: 'SINGLE'|'ALL_ENEMIES'|'SELF'|'ALLY',
  isUltimate?: boolean,              // true → maxEnergy 全消費
  ailments?, effectKey?, description
}

SoulShardData: { id, originMonsterName, effect: { atkBonus, elementDmgBoost, specialAbility? } }
AbyssalResidueData: { id, name, itemId, rarity, mainStat, subOptions, level(1-20), exp, maxExp }
SpiritCoreData: { id, name, element?, skillChangeId?, atkMultiplier }
NecroStatus: { level(1-99), rank(1-10), maxCost, baseStatsBonus, exp }
ItemData(武器): { weaponRarity: R|SR|SSR|UR, archetype: LOW|MID|HIGH|MYTHIC,
                  rank(共鳴0-5), ilv(1-90), passiveA/B: WeaponPassive }
```

## ダメージ計算式 (BattleEngine.calculateDamage / BattleDamage.ts)

```
damage  = atk × powerMultiplier
damage *= 1 - def / (def + 200)                          // 防御軽減 (HSR簡易版)
damage *= 1 + elementBoostPct/100 + synergyElementPct/100 // 属性ダメージ加成
damage *= 1 - resistance/100                              // 耐性 (<0 = 弱点)
if (crit) damage *= 1 + (critDmg + synergyCritDmg) / 100  // 会心
finalDamage = max(1, floor(damage))
```

## MasterDataService

```typescript
// シングルトンパターン — 常にこれを使う (new しない)
const master = MasterDataService.getInstance();
master.getAllJobs() / getAllMonsters() / getAllEnemies() / getAllItems() /
       getAllStages() / getAllAreas() / getAllSkills() / getAllDemonForms() /
       getAllMaterials()
master.getJob(id) / getEnemy(id) / getDemonForm(jobId) ... // 単体取得も同名規則
```

## 描画レイヤー

- **BattleCanvas.tsx**: SVG + Framer Motion（PixiJS 不使用）。マスター JSON を直接 import。
- **MapCanvas.tsx / necro の use*Pixi.ts**: PixiJS。60fps 維持 — レンダーループ内で重い JS を避ける。
- PixiJS コンポーネントは `next/dynamic` + `ssr: false` でロードする。

## コンポーネントテンプレート

```tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

export function NewScreen() {
  const { player } = useGameStore();

  return (
    // ⚠️ iOS Safari: motion.div と overflow:hidden は必ず分離
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0 }}  // transformのみ、overflowなし
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden"
        style={{ background: '#050505' }}>

        {/* Header: shrink-0 必須 */}
        <div className="shrink-0 flex items-center px-3"
          style={{ height: 44, borderBottom: '1px solid rgba(139,0,255,0.16)' }}>
        </div>

        {/* Content: flex-1 min-h-0 必須 */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
        </div>

        {/* Footer: shrink-0 必須 */}
        <div className="shrink-0 px-3 py-3">
        </div>
      </div>
    </motion.div>
  );
}
```

## 規約

- UI テキスト: 直接的な日本語動詞 — 装備, 強化, 攻撃, 術, 魔神化
- パーティ = アルド (CharacterData) + モンスター 3 スロット `(MonsterData | null)[]`
- コスト検証: `necroStatus.maxCost` に対して検証してから編成
- `MasterDataService.getInstance()` — new しない
- コード変更後は必ず `npx tsc --noEmit`
- **モックなし**: テストでは実ロジックを呼ぶ (モック/本番の乖離でバグを見逃した経緯あり)
- タスク管理: `docs/progress/CH1_TODO.md`（作業中）/ `DONE.md` / `DEFERRED.md` / `TECH_DEBT.md`
- 設計書の早引きは `docs/設計書/00_INDEX.md`
