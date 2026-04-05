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
      <div className="flex items-center gap-2 border-b border-primary/30 pb-2 mb-4 font-cinzel font-bold text-primary">
        <Activity size={16} /> PROFILE
      </div>
      
      <div className="flex gap-2 flex-col mb-6">
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

      <div className="flex-1 flex flex-col justify-center items-center">
        <motion.div 
          animate={{ y: [0, -10, 0] }} 
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-full aspect-square border-4 border-primary/50 rounded-lg bg-black/60 shadow-[0_0_20px_rgba(224,141,255,0.3)] relative flex items-center justify-center overflow-hidden mb-4"
        >
          {/* SD Necromancer Chibi Character */}
          <img 
            src="/images/character/sd-necromancer.png" 
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-4">
        <button 
          disabled={!isInBattle}
          onClick={() => {
            if (isInBattle) {
              const { setActionTrigger } = useGameStore.getState();
              setActionTrigger({ type: 'PHYSICAL_ATTACK' });
            }
          }}
          className={`puni-puni relative w-16 h-16 rounded-full border-4 border-secondary bg-black/80 flex flex-col items-center justify-center text-secondary hover:bg-secondary/20 hover:shadow-[0_0_20px_rgba(0,255,171,0.8)] transition-all group focus:outline-none shadow-lg
            ${!isInBattle ? 'opacity-50 cursor-not-allowed grayscale border-gray-700 text-gray-600' : ''}
          `}
        >
          <span className="text-[10px] font-bold font-space mt-1 uppercase">ATK</span>
        </button>

        {availableSkills.map((skill: any) => {
          const isMpEnough = player && player.stats.mp >= skill.mpCost;
          return (
            <button 
              key={skill.id}
              disabled={isInBattle ? (false /* handled by battle canvas */) : true} // Out of battle, disabled for now or trigger action
              onClick={() => {
                if (isInBattle) {
                  const { setActionTrigger } = useGameStore.getState();
                  setActionTrigger({ type: 'MAGIC_SKILL', skillId: skill.id });
                }
              }}
              className={`puni-puni relative w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center transition-all group focus:outline-none shadow-lg
                ${isMpEnough ? 'border-primary bg-black/80 text-primary hover:bg-primary/20 hover:shadow-[0_0_20px_rgba(224,141,255,0.8)]' : 'border-gray-700 bg-gray-900 text-gray-600 grayscale'}
                ${!isInBattle ? 'opacity-50 cursor-not-allowed grayscale' : ''}
              `}
            >
              <span className="text-[8px] font-bold font-space mt-1 uppercase truncate w-full px-1 text-center leading-none" title={skill.name}>
                {skill.name}
              </span>
              <span className="absolute -top-1 -right-1 bg-black border border-primary text-primary text-[8px] px-1 py-0.5 rounded-full font-mono">
                {skill.mpCost}
              </span>
            </button>
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
