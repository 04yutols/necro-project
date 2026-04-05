'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import BattleCanvas from '../components/battle/BattleCanvas';
import NecroLab from '../components/necro/NecroLab';
import EquipmentManager from '../components/character/EquipmentManager';
import AreaMap from '../components/map/AreaMap';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { DashboardFrame } from '../components/layout/DashboardFrame';
import { CapsuleStatBar } from '../components/ui/CapsuleStatBar';
import { NecroLog } from '../components/ui/NecroLog';
import { ArmySlot } from '../components/ui/ArmySlot';
import { Shield, Skull, Map, Activity, Image as ImageIcon } from 'lucide-react';
import { BloodButton } from '../components/ui/BloodButton';

import { MasterDataService } from '../services/MasterDataService';

export default function Home() {
  const { 
    player, 
    setPlayer, 
    setNecroStatus, 
    setInventoryMonsters, 
    setInventoryItems, 
    party, 
    equippingMonsterId, 
    inventoryMonsters: allMonsters, 
    setEquippingMonsterId, 
    addClearedStage,
    battleLogs
  } = useGameStore();

  const [isInBattle, setIsInBattle] = useState(false);
  const [activeTab, setActiveTab] = useState<'HUB' | 'LAB' | 'MAP'>('HUB');
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  
  const masterData = MasterDataService.getInstance();

  const equippingMonster = equippingMonsterId ? allMonsters.find(m => m.id === equippingMonsterId) : null;

  // 使用可能なスキルの取得 (グローバル)
  const currentJob = player?.jobs.find(j => j.jobId === player?.currentJobId);
  const availableSkills = currentJob && player
    ? (masterData.getJob(player.currentJobId)?.skills || [])
        .filter((s: any) => s.level <= currentJob.level)
        .map((s: any) => masterData.getSkill(s.skillId))
        .filter(Boolean)
    : [];

  useEffect(() => {
    if (!player) {
      setPlayer({
        id: '1',
        name: 'アルド',
        currentJobId: 'warrior',
        category: 'PHYSICAL',
        stats: { hp: 100, mp: 20, atk: 50, def: 30, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 20 },
        baseResistances: {},
        passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveMatkBonus: 0, passiveMdefBonus: 0 },
        equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
        jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
        isAwakened: false,
        clearedStages: [],
      });

      setNecroStatus({
        level: 1,
        rank: 1,
        maxCost: 10,
        baseStatsBonus: 1.0,
      });

      setInventoryMonsters([
        { id: 'm1', name: 'ゴブリン', tribe: 'HUMANOID', cost: 3, stats: { hp: 50, mp: 0, atk: 10, def: 5, matk: 0, mdef: 2, agi: 5, luck: 5, tec: 5 }, resistances: { FIRE: -20 } },
        { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD', cost: 4, stats: { hp: 40, mp: 0, atk: 12, def: 8, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 8 }, resistances: { LIGHT: -50, DARK: 50 } },
        { id: 'm3', name: 'ゾンビ', tribe: 'UNDEAD', cost: 4, stats: { hp: 80, mp: 0, atk: 8, def: 4, matk: 0, mdef: 0, agi: 2, luck: 2, tec: 2 }, resistances: { FIRE: -50, LIGHT: -20, DARK: 20 } },
      ]);
      
      setInventoryItems([
        { id: 'i1', name: 'Iron Sword', type: 'WEAPON', rarity: 'COMMON', stats: { atk: 10 } },
        { id: 'i2', name: 'Leather Armor', type: 'BODY', rarity: 'COMMON', stats: { def: 5, mdef: 2 } },
        { id: 'i3', name: 'Hero Soul Blade', type: 'WEAPON', rarity: 'UNIQUE', stats: { atk: 50, matk: 50, def: 10, mdef: 10 }, specialEffect: 'SOUL_RESONANCE' },
      ]);

      const { addSoulShard } = useGameStore.getState();
      addSoulShard({
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, matkBonus: 0 }
      });
    }
  }, [player, setPlayer, setNecroStatus, setInventoryMonsters, setInventoryItems]);

  if (!player) return <div className="p-8 text-center bg-dark min-h-screen font-cinzel text-white">Loading Digital Soul...</div>;

  const tabVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  };

  const leftSidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-primary/30 pb-2 mb-2 font-cinzel font-bold text-primary">
        <Activity size={16} /> PROFILE
      </div>
      <div className="flex-1 flex flex-col justify-center items-center">
        <motion.div 
          animate={{ y: [0, -10, 0] }} 
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-full aspect-square border-4 border-primary/50 rounded-lg bg-black/60 shadow-[0_0_20px_rgba(224,141,255,0.3)] relative flex items-center justify-center overflow-hidden mb-4"
        >
          {/* image_99510a.png reference: 2D SD Chibi Character */}
          <img 
            src="/image_99510a.png" 
            alt="Hero Avatar" 
            className="w-[80%] h-auto object-contain [image-rendering:pixelated]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
          {/* Fallback text if image missing */}
          <span className="absolute text-gray-700 font-bold font-space pointer-events-none -z-10 flex flex-col items-center">
            <ImageIcon className="w-8 h-8 mb-1" />
            2D AVATAR
          </span>
        </motion.div>

        <div className="w-full font-space">
          <div className="text-2xl font-bold text-white text-center drop-shadow-md mb-1">{player.name}</div>
          <div className="text-sm font-bold text-cursedGold text-center tracking-widest mb-4">Class: {player.currentJobId.toUpperCase()}</div>
          
          <CapsuleStatBar label="HP" value={player.stats.hp} max={100} color="blood" />
          <CapsuleStatBar label="MP" value={player.stats.mp} max={20} color="secondary" />
        </div>
      </div>

      <div className="mt-auto">
        <div className="flex gap-2 flex-col">
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            onClick={() => setActiveTab('HUB')} 
            className={`w-full py-2 border-2 rounded-lg font-bold transition-all ${activeTab === 'HUB' ? 'border-primary bg-primary/20 text-white' : 'border-gray-700 text-gray-500 hover:border-primary/50 hover:text-primary'}`}
          >
            HUB
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            onClick={() => setActiveTab('LAB')} 
            className={`w-full py-2 border-2 rounded-lg font-bold transition-all ${activeTab === 'LAB' ? 'border-primary bg-primary/20 text-white' : 'border-gray-700 text-gray-500 hover:border-primary/50 hover:text-primary'}`}
          >
            LAB
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            onClick={() => setActiveTab('MAP')} 
            className={`w-full py-2 border-2 rounded-lg font-bold transition-all ${activeTab === 'MAP' ? 'border-primary bg-primary/20 text-white' : 'border-gray-700 text-gray-500 hover:border-primary/50 hover:text-primary'}`}
          >
            MAP
          </motion.button>
        </div>
      </div>
    </>
  );

  const rightSidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-primary/30 pb-2 mb-2 font-cinzel font-bold text-primary">
        <Shield size={16} /> ARMY STATUS
      </div>
      <div className="flex flex-col gap-2 mb-4">
        {party.map((m, i) => (
          <ArmySlot 
            key={i} 
            index={i} 
            monster={m} 
            onClick={() => setActiveTab('LAB')} 
            onEquipClick={() => m && setEquippingMonsterId(m.id)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-primary/30 pb-2 mt-auto mb-2 font-cinzel font-bold text-primary">
        <Activity size={16} /> SYSTEM LOG
      </div>
      <NecroLog logs={battleLogs} />
    </>
  );

  const mainMonitorContent = (
    <>
      {!isInBattle ? (
        <div className="w-full h-full overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'HUB' && (
              <motion.div key="HUB" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <EquipmentManager />
              </motion.div>
            )}

            {activeTab === 'LAB' && (
              <motion.div key="LAB" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <NecroLab />
              </motion.div>
            )}

            {activeTab === 'MAP' && (
              <motion.div key="MAP" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                <AreaMap onStartStage={(stageId) => {
                  setActiveStageId(stageId);
                  setIsInBattle(true);
                }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          className="w-full h-full flex flex-col relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <BattleCanvas onEnd={() => {
            setIsInBattle(false);
            if (activeStageId) {
              addClearedStage(activeStageId);
            }
          }} />
          <div className="absolute top-4 right-4 z-50">
            <BloodButton variant="secondary" onClick={() => setIsInBattle(false)}>RETREAT</BloodButton>
          </div>
        </motion.div>
      )}
    </>
  );

  return (
    <>
      <DashboardFrame
        leftSidebar={leftSidebarContent}
        mainMonitor={mainMonitorContent}
        rightSidebar={rightSidebarContent}
      />
      
      {equippingMonster && (
        <ShardEquipModal 
          monster={equippingMonster} 
          onClose={() => setEquippingMonsterId(null)} 
        />
      )}
    </>
  );
}
