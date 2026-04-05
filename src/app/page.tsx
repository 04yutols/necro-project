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
    battleLogs,
    initialize
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
      try {
        console.log("Setting player mock data via initialize()...");
        initialize();
        console.log("Mock data set successfully.");
      } catch (err) {
        console.error("Error setting mock data:", err);
      }
    }
  }, [player, initialize]);

  if (!player) return <div className="p-8 text-center bg-dark min-h-screen font-cinzel text-white">Loading Digital Soul... (Check Console)</div>;

  const tabVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  };

  const leftSidebarContent = (
    <>
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-4 font-space font-bold text-gray-400 text-xs tracking-[0.2em] uppercase">
        <Activity size={14} /> System Navigation
      </div>
      
      {/* Icon-only Navigation */}
      <div className="flex gap-4 justify-between mb-8">
        {[
          { id: 'HUB', icon: Skull, label: 'HUB' },
          { id: 'LAB', icon: Activity, label: 'LAB' },
          { id: 'MAP', icon: Map, label: 'MAP' }
        ].map((tab) => (
          <motion.button 
            key={tab.id}
            whileHover={{ scale: 1.1, y: -2 }} 
            whileTap={{ scale: 0.9, y: 1 }} 
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex-1 aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border-b-4
              ${activeTab === tab.id 
                ? 'bg-primary text-dark border-purple-800 shadow-[0_0_20px_rgba(224,141,255,0.4)]' 
                : 'bg-black/60 text-gray-500 border-gray-900 hover:border-primary/40 hover:text-primary'}`}
          >
            <tab.icon size={20} />
            <span className="text-[9px] font-bold tracking-tighter">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-4 font-space font-bold text-gray-400 text-xs tracking-[0.2em] uppercase">
          <Activity size={14} /> Digital Soul
        </div>

        <div className="relative w-full aspect-square mb-6">
          {/* Digital Effects Background */}
          <div className="absolute inset-0 bg-black/40 rounded-3xl border-4 border-white/5 overflow-hidden">
            {/* Circular Grid Effect */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="w-[120%] h-[120%] border-[1px] border-primary rounded-full animate-pulse" />
              <div className="absolute w-[80%] h-[80%] border-[1px] border-primary rounded-full animate-[ping_3s_linear_infinite]" />
              <div className="absolute w-[40%] h-[40%] border-[1px] border-primary rounded-full" />
            </div>
            
            {/* Focus Lines */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary" />
              <div className="absolute top-0 left-1/2 w-[1px] h-full bg-primary" />
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary rotate-45" />
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary -rotate-45" />
            </div>
          </div>

          <motion.div 
            animate={{ y: [0, -10, 0], scale: [1, 1.02, 1] }} 
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            {/* SD Necromancer Chibi Character */}
            <img 
              src="/images/character/sd-necromancer.png" 
              alt="Hero Avatar" 
              className="w-[85%] h-auto object-contain [image-rendering:pixelated] drop-shadow-[0_0_20px_rgba(224,141,255,0.4)]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
              }}
            />
            {/* Fallback text if image missing */}
            <span className="absolute text-gray-700 font-bold font-space pointer-events-none -z-10 flex flex-col items-center opacity-30">
              <ImageIcon className="w-12 h-12 mb-1" />
              AVATAR.OS
            </span>
          </motion.div>
        </div>

        <div className="w-full font-space space-y-4">
          <div className="text-center">
            <div className="text-2xl font-black text-white tracking-widest drop-shadow-[0_0_10px_rgba(224,141,255,0.3)]">{player.name}</div>
            <div className="text-[10px] font-bold text-primary tracking-[0.3em] uppercase opacity-80 mt-1">ID: {player.currentJobId.toUpperCase()} // LV.99</div>
          </div>
          
          <div className="bg-black/40 p-4 rounded-2xl border-2 border-white/5 space-y-1">
            <CapsuleStatBar label="Vitality" value={player.stats.hp} max={100} color="blood" />
            <CapsuleStatBar label="Energy" value={player.stats.mp} max={20} color="secondary" />
          </div>
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
        <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'HUB' && (
              <motion.div key="HUB" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 pb-24">
                <EquipmentManager />
              </motion.div>
            )}

            {activeTab === 'LAB' && (
              <motion.div key="LAB" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 pb-24">
                <NecroLab />
              </motion.div>
            )}

            {activeTab === 'MAP' && (
              <motion.div key="MAP" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6 pb-24 h-full">
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
          className="flex-1 w-full h-full flex flex-col relative"
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

      {/* Global Command Buttons (Always visible at the bottom of the central monitor) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-6">
        <motion.button 
          whileHover={isInBattle ? { scale: 1.1, y: -5 } : {}}
          whileTap={isInBattle ? { scale: 0.9, y: 2 } : {}}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          disabled={!isInBattle}
          onClick={() => {
            if (isInBattle) {
              const { setActionTrigger } = useGameStore.getState();
              setActionTrigger({ type: 'PHYSICAL_ATTACK' });
            }
          }}
          className={`relative w-20 h-20 rounded-3xl border-4 border-emerald-800 bg-secondary flex flex-col items-center justify-center text-dark hover:shadow-[0_0_30px_#00ffab] transition-all group focus:outline-none shadow-2xl border-b-8 active:border-b-0 active:translate-y-2
            ${!isInBattle ? 'opacity-30 cursor-not-allowed grayscale border-gray-700' : ''}
          `}
        >
          <Skull size={24} className="mb-1" />
          <span className="text-[10px] font-black font-space uppercase">ATK</span>
        </motion.button>

        {availableSkills.map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          const canUse = isInBattle && isMpEnough;
          return (
            <motion.button 
              key={skill.id}
              whileHover={canUse ? { scale: 1.1, y: -5 } : {}}
              whileTap={canUse ? { scale: 0.9, y: 2 } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              disabled={!canUse}
              onClick={() => {
                if (isInBattle) {
                  const { setActionTrigger } = useGameStore.getState();
                  setActionTrigger({ type: 'MAGIC_SKILL', skillId: skill.id });
                }
              }}
              className={`relative w-20 h-20 rounded-3xl border-4 flex flex-col items-center justify-center transition-all group focus:outline-none shadow-2xl border-b-8 active:border-b-0 active:translate-y-2
                ${isMpEnough ? 'border-purple-800 bg-primary text-dark hover:shadow-[0_0_30px_#e08dff]' : 'border-gray-800 bg-gray-900 text-gray-600 grayscale'}
                ${!isInBattle ? 'opacity-30 cursor-not-allowed grayscale' : ''}
              `}
            >
              <Activity size={20} className="mb-1" />
              <span className="text-[8px] font-black font-space uppercase truncate w-full px-2 text-center leading-none" title={skill.name}>
                {skill.name}
              </span>
              <span className="absolute -top-3 -right-3 bg-black border-2 border-primary text-primary text-[10px] px-2 py-0.5 rounded-full font-black font-space shadow-xl">
                {skill.mpCost}
              </span>
            </motion.button>
          );
        })}
      </div>
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
