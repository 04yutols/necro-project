'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

const BattleCanvas = dynamic(() => import('../components/battle/BattleCanvas'), { ssr: false });

import NecroLab from '../components/necro/NecroLab';
import EquipmentManager from '../components/character/EquipmentManager';
import AreaMap from '../components/map/AreaMap';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { DashboardFrame } from '../components/layout/DashboardFrame';
import { CapsuleStatBar } from '../components/ui/CapsuleStatBar';
import { NecroLog } from '../components/ui/NecroLog';
import { ArmySlot } from '../components/ui/ArmySlot';
import { Shield, Skull, Map, Activity, Image as ImageIcon, Sparkles } from 'lucide-react';
import { FuchsiaButton } from '../components/ui/FuchsiaButton';

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
    <div className="flex flex-col h-full">
      {/* Profile Section */}
      <div className="flex items-center gap-4 mb-10 p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group">
        <div className="absolute inset-0 focus-lines opacity-10 group-hover:opacity-20 transition-opacity" />
        <div className="w-12 h-12 rounded-full border-2 border-primary p-0.5 shadow-[0_0_10px_#BC00FB]">
          <div className="w-full h-full rounded-full bg-black/40 overflow-hidden">
            <img 
              src="/images/character/sd-necromancer.png" 
              alt="Avatar" 
              className="w-full h-full object-cover [image-rendering:pixelated]"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="text-xs font-bold text-primary tracking-widest uppercase">{player.currentJobId}</div>
          <div className="text-[10px] text-gray-400 font-bold tracking-widest">LEVEL 99 ABYSS WALKER</div>
        </div>
      </div>

      <div className="text-[10px] font-bold text-gray-500 tracking-[0.3em] uppercase mb-6 px-2">
        Navigation
      </div>
      
      {/* Menu Items */}
      <div className="flex flex-col gap-2 mb-auto">
        {[
          { id: 'HUB', icon: Skull, label: 'CITADEL' },
          { id: 'MAP', icon: Map, label: 'MAP' },
          { id: 'LAB', icon: Activity, label: 'ARMY' }
        ].map((tab) => (
          <motion.button 
            key={tab.id}
            whileHover={{ x: 4 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all relative
              ${activeTab === tab.id 
                ? 'text-white' 
                : 'text-gray-500 hover:text-gray-300'}`}
          >
            {activeTab === tab.id && (
              <motion.div 
                layoutId="active-nav"
                className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent border-l-2 border-primary rounded-r-lg"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <tab.icon size={18} className={`relative z-10 ${activeTab === tab.id ? 'text-primary' : ''}`} />
            <span className="text-[11px] font-bold tracking-[0.2em] relative z-10">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Bottom Sidebar Action */}
      <div className="mt-8">
        <FuchsiaButton className="w-full rounded-full py-4 text-xs tracking-[0.3em] shadow-[0_0_20px_rgba(255,0,255,0.3)]">
          SUMMON MINION
        </FuchsiaButton>
      </div>
    </div>
  );

  const rightSidebarContent = (
    <div className="flex flex-col h-full">
      <div className="text-[10px] font-bold text-gray-500 tracking-[0.3em] uppercase mb-6 px-2">
        Soul Log
      </div>
      
      <NecroLog logs={battleLogs} />

      <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/5">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[9px] font-bold text-fuchsia tracking-widest uppercase">Corruption Level</span>
          <span className="text-[10px] font-bold text-white">78%</span>
        </div>
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-fuchsia shadow-[0_0_10px_#FF00FF]" style={{ width: '78%' }} />
        </div>
      </div>
    </div>
  );

  const mainMonitorContent = (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-[0.1em] uppercase mb-1">
            {activeTab === 'MAP' ? 'ABYSSAL SECTOR 04' : activeTab === 'HUB' ? 'CITADEL HUB' : 'NECRO LABORATORY'}
          </h2>
          <div className="text-xs font-bold text-secondary tracking-widest uppercase opacity-80">
            {activeTab === 'MAP' ? 'Map Synchronization: 94%' : 'System Status: Optimal'}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/30 bg-secondary/5">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-[9px] font-bold text-secondary tracking-widest uppercase">System Online</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!isInBattle ? (
          <div className="w-full h-full overflow-y-auto custom-scrollbar pr-2">
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
                <motion.div key="MAP" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="h-full">
                  <AreaMap onStartStage={(stageId) => {
                    console.log("onStartStage triggered in Home for stage:", stageId);
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
              <FuchsiaButton variant="secondary" onClick={() => setIsInBattle(false)}>RETREAT</FuchsiaButton>
            </div>
          </motion.div>
        )}
      </div>

      {/* Global Bottom Action Bar */}
      <div className="mt-auto pt-6 flex items-center justify-between gap-8 border-t border-white/5 bg-black/20 -mx-8 px-8 pb-4">
        <div className="flex gap-8 flex-1">
          <div className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Active Mana</span>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-primary shadow-[0_0_10px_#BC00FB]" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Essence</span>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-secondary shadow-[0_0_10px_#00FFFF]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <motion.button 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
          >
            <Sparkles size={16} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full border border-secondary/30 bg-secondary/5 flex items-center justify-center text-secondary hover:bg-secondary/20 transition-colors"
          >
            <Shield size={16} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full border border-fuchsia/30 bg-fuchsia/5 flex items-center justify-center text-fuchsia hover:bg-fuchsia/20 transition-colors"
          >
            <Activity size={16} />
          </motion.button>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (activeTab === 'MAP' && !isInBattle) {
              setActiveStageId('1-1');
              setIsInBattle(true);
            }
          }}
          className="flex items-center gap-3 px-8 py-3 bg-secondary text-dark font-black text-[11px] tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:brightness-110 transition-all uppercase"
        >
          <Map size={16} />
          Combat Start
        </motion.button>
      </div>
    </div>
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
