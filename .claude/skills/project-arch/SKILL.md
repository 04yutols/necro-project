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
    actions.ts        ← Server Actions
  components/
    battle/           BattleCanvas.tsx (Pixi.js), ResultScreen.tsx, AppraisalCertificate.tsx
    character/        EquipmentManager.tsx (未使用 — LegionHub が EQUIP タブを担当)
    home/             HomeHero.tsx
    layout/           ResponsiveFrame.tsx, BottomNavBar.tsx, MobileHeader.tsx, DashboardFrame.tsx
    legion/           LegionHub.tsx (軍団編成 + 8スロット装備 + 深淵残滓管理 — 1342行の巨大コンポーネント)
    map/              AreaMap.tsx, MapCanvas.tsx (Pixi.js)
    necro/            NecroLab.tsx, ShardEquipModal.tsx, MonsterViewer.tsx,
                      SoulSlotRing.tsx, useNecroLabPixi.ts, useGothicSound.ts, useResidueEnhancePixi.ts
    ui/               ArmySlot, CapsuleStatBar, FuchsiaButton, GameFrame, GrimoireLog, NecroLog
  logic/
    BattleEngine.ts   ← 純粋クラス。React/Zustand 依存なし
    GameManager.ts    ← ゲームループ全体。Prisma 使用。サーバーサイドのみ
  services/
    MasterDataService.ts  ← シングルトン。src/data/master/*.json を読む
    JobService.ts, NecroService.ts, RewardService.ts
  store/
    useGameStore.ts   ← Zustand。全クライアント実行時状態
  types/
    game.ts           ← 全型定義の正典。GDD リファレンス注釈付き
  data/master/
    jobs.json, monsters.json, items.json, stages.json, skills.json
```

## ナビゲーション

```typescript
// currentTab の値と対応コンポーネント
type Tab = 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS'

// MAP と BATTLE は全画面オーバーレイ (position:absolute, inset:0, z:9999)
// それ以外は ResponsiveFrame 内にレンダリング

// 新タブ追加手順:
// 1. useGameStore.ts の型に追加
// 2. BottomNavBar.tsx の TABS 配列に追加
// 3. page.tsx の if/switch に追加
```

## Zustand ストア

```typescript
// useGameStore.ts — 状態の全リスト
const {
  player,                  // CharacterData | null
  necroStatus,             // NecroStatus | null — { level, rank, maxCost, baseStatsBonus }
  party,                   // (MonsterData | null)[] — 常に 3 スロット
  inventoryMonsters,       // MonsterData[]
  soulShards,              // SoulShardData[]
  inventoryItems,          // ItemData[]
  abyssalResidues,         // AbyssalResidueData[] — level 1-20
  equippedResidueSlots,    // (AbyssalResidueData | null)[] — 3スロット
  residueMaterials,        // ResidueMatData[]
  demonGauge,              // number 0-100
  isDemonMode,             // boolean
  currentTab,              // Tab
  battleLogs,              // string[] — 最大50件
  actionTrigger,           // { type: 'PHYSICAL_ATTACK' | 'MAGIC_SKILL', skillId? } | null

  // アクション
  setCurrentTab,
  updatePartySlot,         // (index: 0|1|2, monster: MonsterData|null) => void
  equipResidueToSlot,      // (slotIndex: number, residue: AbyssalResidueData|null) => void
  upgradeResidue,          // (residueId: string, matIds: string[]) => void
  addBattleLog,
  toggleDemonMode,
  fillDemonGauge,          // (amount: number) => void
  equipItem,               // (slot: keyof EquipmentSlots, item: ItemData) => void
  equipShard,              // (monsterId: string, shardId: string) => void
} = useGameStore();
```

## 主要型 (src/types/game.ts)

```typescript
BaseStats: { hp, mp, atk, def, matk, mdef, agi, luck, tec: number }

CharacterData: {
  id, name, currentJobId, category: ClassCategory,
  stats: BaseStats, passives: PassiveBonuses,
  equipment: EquipmentSlots,   // 8スロット: weapon/sub/head/body/arms/legs/acc1/acc2
  baseResistances: Resistances,
  jobs: UserJobState[], isAwakened: boolean, clearedStages: string[]
}

MonsterData: {
  id, name, tribe: Tribe, cost: number,
  stats: BaseStats, resistances: Resistances,
  equippedShardId?: string, spiritCore?: SpiritCoreData
}
// ※ MonsterData に emoji や element フィールドはない

ItemData: {
  id, name, type: 'WEAPON'|'SUB'|'HEAD'|'BODY'|'ARMS'|'LEGS'|'ACC1'|'ACC2',
  rarity: 'COMMON'|'UNIQUE'|'HIDDEN_UNIQUE',
  stats: Partial<BaseStats>, resistances?: Resistances,
  isUnique: boolean, discovererId?, discovererName?, serialNo?, discoveredAt?,
  subOptions?: SubOption[], specialEffect?: string
}

SoulShardData: {
  id, originMonsterName: string,
  effect: { atkBonus: number, matkBonus: number, specialAbility?: string }
}

AbyssalResidueData: {
  id, name, itemId: string,
  rarity: 'COMMON'|'RARE'|'EPIC',
  mainStat: { type: string, value: number },
  subOptions: SubOption[],
  level: number,  // 1-20
  exp: number, maxExp: number
}

ResidueMatData: {
  id, name, quantity: number, expValue: number,
  rarity: 'COMMON'|'RARE'|'EPIC'
}

SpiritCoreData: {
  id, name, element?: ElementType, skillChangeId?: string, atkMultiplier: number
}

SkillData: {
  id, name, mpCost, power: number,
  type: 'PHYSICAL'|'MAGICAL'|'HEAL',
  element?: ElementType, attackType?: SkillAttackType,
  targetType?: 'SINGLE'|'ALL_ENEMIES'|'SELF'|'ALLY',
  effectKey?: string, description: string
}

ElementType: 'FIRE'|'WATER'|'THUNDER'|'EARTH'|'WIND'|'LIGHT'|'DARK'|'ICE'|'NONE'
Tribe: 'UNDEAD'|'DEMON'|'BEAST'|'HUMANOID'
ClassCategory: 'PHYSICAL'|'MAGICAL'
```

## ダメージ計算式 (BattleEngine.ts)

```
baseDamage = stat² / (stat + counterStat)
  物理: ATK vs DEF
  魔法: MATK vs MDEF

finalDamage = baseDamage × powerMultiplier × elementMultiplier × (1 + TEC/100)
critMultiplier = 1.5 + TEC/200  (LUCK% でクリット判定)
elementMultiplier = 1 - (resistance / 100)  (resistance < 0 → 弱点)
```

## MasterDataService

```typescript
// シングルトンパターン — 常にこれを使う (new しない)
const masterData = MasterDataService.getInstance();
const monsters = masterData.getMonsters();
const jobs = masterData.getJobs();
const items = masterData.getItems();
const stages = masterData.getStages();
const skills = masterData.getSkills();
```

## Pixi.js パターン

```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  const app = new Application();
  app.init({ canvas: canvasRef.current, ... }).then(() => {
    // setup
  });
  return () => { app.destroy(); };  // クリーンアップ必須
}, []);

// page.tsx でのロード
const BattleCanvas = dynamic(() => import('../components/battle/BattleCanvas'), { ssr: false });
```

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
- パーティは常に 3 スロット `(MonsterData | null)[]`
- コスト検証: `NecroStatus.maxCost` に対して検証してから編成
- GDD 参照: コメントに `GDD-003` 等を記載 (docs/requirements.md)
- `MasterDataService.getInstance()` — new しない
- Pixi.js は 60fps 維持 — レンダーループ内で重い JS を実行しない
- **モックなし**: テストでは実ロジックを呼ぶ (モック/本番の乖離でバグを見逃した経緯あり)
