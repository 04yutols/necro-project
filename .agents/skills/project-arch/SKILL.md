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
    layout.tsx        ← viewport 設定、フォント定義
    globals.css       ← Gothic-Morphism グローバル CSS
    actions.ts        ← Server Actions
  components/
    battle/           BattleCanvas.tsx (Pixi.js), ResultScreen.tsx, AppraisalCertificate.tsx
    character/        EquipmentManager.tsx
    home/             HomeHero.tsx
    layout/           ResponsiveFrame.tsx, BottomNavBar.tsx, MobileHeader.tsx, DashboardFrame.tsx
    legion/           LegionHub.tsx (装備画面 — 巨大ファイル)
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
// src/store/useGameStore.ts
type Tab = 'HOME' | 'BATTLE' | 'MAP' | 'EQUIP' | 'LAB' | 'LOGS'

// 新タブ追加手順:
// 1. useGameStore.ts の型に追加
// 2. BottomNavBar.tsx の TABS 配列に追加
// 3. page.tsx の if/switch に追加
```

## Zustand ストア

```typescript
// useGameStore.ts — よく使う状態
const {
  player,           // CharacterData | null
  necroStatus,      // NecroStatus | null
  party,            // (MonsterData | null)[] — 常に 3 スロット
  inventoryMonsters, // MonsterData[]
  soulShards,       // SoulShardData[]
  inventoryItems,   // ItemData[]
  abyssalResidues,  // AbyssalResidue[] — 8スロット
  demonGauge,       // 0-100
  isDemonMode,      // boolean
  currentTab,       // Tab
  battleLogs,       // BattleLog[] — 最大50件

  // アクション
  setCurrentTab,
  updatePartySlot,  // (index: 0|1|2, monster: MonsterData|null) => void
  equipResidueToSlot, // (slotIndex, residue) => void
  addBattleLog,
  toggleDemonMode,
  fillDemonGauge,   // (amount: number) => void
} = useGameStore();
```

## 主要型 (src/types/game.ts)

```typescript
BaseStats: { hp, mp, atk, def, matk, mdef, agi, luck, tec: number }
CharacterData: { id, name, currentJobId, category, stats, passives, equipment, baseResistances, jobs, isAwakened, clearedStages }
MonsterData: { id, name, emoji, tribe, element, stats, resistances, soulShard?, spiritCore? }
ItemData: { id, name, type (8スロット), rarity, stats, isUnique, subOptions? }
AbyssalResidue: { id, slotIndex (0-7), level (1-20), type, baseEffect, subEffects }
SoulShardData: { id, monsterId, effect: SoulShardEffect }
SkillData: { id, name, mpCost, power, type, element?, description }
ElementType: 'FIRE' | 'ICE' | 'THUNDER' | 'LIGHT' | 'DARK' | 'NONE'
Tribe: 'UNDEAD' | 'DEMON' | 'BEAST' | 'HUMANOID'
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
// シングルトンパターン — 常にこれを使う
const masterData = MasterDataService.getInstance();
const monsters = masterData.getMonsters();
const jobs = masterData.getJobs();
const items = masterData.getItems();
const stages = masterData.getStages();
const skills = masterData.getSkills();
```

## Pixi.js パターン

```typescript
// キャンバスコンポーネント
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
    // ⚠️ motion.div と overflow:hidden は必ず分離 (iOS Safari バグ)
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0 }}
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
