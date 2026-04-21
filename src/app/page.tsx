'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

const BattleCanvas = dynamic(() => import('../components/battle/BattleCanvas').then((mod) => mod.default), { 
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-black text-primary font-space animate-pulse text-xs tracking-widest uppercase">Initializing Digital Soul...</div>
});

import NecroLab from '../components/necro/NecroLab';
import EquipmentManager from '../components/character/EquipmentManager';
import AreaMap from '../components/map/AreaMap';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { ResponsiveFrame } from '../components/layout/ResponsiveFrame';
import { CapsuleStatBar } from '../components/ui/CapsuleStatBar';
import { NecroLog } from '../components/ui/NecroLog';
import { Shield, Skull, Map, Activity, Sparkles, Sword } from 'lucide-react';
import { FuchsiaButton } from '../components/ui/FuchsiaButton';

import { MasterDataService } from '../services/MasterDataService';

export default function Home() {
  const { 
    player, 
    party, 
    equippingMonsterId, 
    inventoryMonsters: allMonsters, 
    setEquippingMonsterId, 
    addClearedStage,
    battleLogs,
    initialize,
    currentTab,
    setCurrentTab
  } = useGameStore();

  const [isInBattle, setIsInBattle] = useState(false);
  const [activeTab, setActiveTab] = useState<'HUB' | 'LAB' | 'MAP'>('HUB');
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  
  const masterData = MasterDataService.getInstance();
  const equippingMonster = equippingMonsterId ? allMonsters.find(m => m.id === equippingMonsterId) : null;

  useEffect(() => {
    if (!player) initialize();
  }, [player, initialize]);

  if (!player) return <div className="p-8 text-center bg-dark min-h-screen font-cinzel text-white">Loading Digital Soul...</div>;

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  const leftSidebarContent = (
    <div className="flex flex-col h-full gap-6">
      {/* Mobile Status Header - Hidden on Desktop */}
      <div className="lg:hidden grid grid-cols-2 gap-3 mb-2">
        <CapsuleStatBar label="Health" value={player.stats.hp} max={100} type="hp" />
        <CapsuleStatBar label="Mana" value={player.stats.mp} max={20} type="mp" />
      </div>

      {/* Profile Section */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-surface/40 border border-white/5 relative overflow-hidden group">
        <div className="w-12 h-12 rounded-full border-2 border-primary p-0.5 shadow-[0_0_10px_#BC00FB]">
          <div className="w-full h-full rounded-full bg-black/40 overflow-hidden">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aldo&backgroundColor=0b0e14" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="text-[10px] font-black text-primary tracking-widest uppercase">{player.currentJobId}</div>
          <div className="text-[8px] text-gray-400 font-bold tracking-widest uppercase">Abyss Walker</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[9px] font-black text-white/30 tracking-[0.3em] uppercase px-4 mb-2">Citadel Core</h3>
        {[
          { id: 'HUB', icon: Skull, label: 'EQUIPMENT' },
          { id: 'MAP', icon: Map, label: 'BATTLE MAP' },
          { id: 'LAB', icon: Activity, label: 'NECRO LAB' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (currentTab !== 'BATTLE') setCurrentTab('BATTLE');
            }} 
            className={`flex items-center gap-4 px-6 py-3 rounded-full transition-all relative group
              ${activeTab === tab.id 
                ? 'text-white' 
                : 'text-gray-500 hover:text-primary'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="nav-active" className="absolute inset-0 bg-primary/10 rounded-full border border-primary/20 shadow-[0_0_15px_rgba(188,0,251,0.1)]" />
            )}
            <tab.icon size={18} className={`relative z-10 ${activeTab === tab.id ? 'text-primary' : ''}`} />
            <span className="text-[10px] font-black tracking-widest relative z-10 uppercase">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <FuchsiaButton className="w-full rounded-full py-4 text-[10px] tracking-widest shadow-[0_0_20px_rgba(255,0,255,0.2)] uppercase">
          Reanimate Soul
        </FuchsiaButton>
      </div>
    </div>
  );

  const rightSidebarContent = (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[9px] font-black text-white/30 tracking-[0.3em] uppercase">Digital Consciousness</h3>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
          <div className="w-1 h-1 rounded-full bg-secondary animate-pulse delay-75" />
        </div>
      </div>
      
      <div className="flex-1 min-h-0 bg-surface/20 rounded-xl border border-white/5 p-2">
        <NecroLog logs={battleLogs} />
      </div>

      <div className="p-4 rounded-xl bg-surface/40 border border-white/5 space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-[8px] font-black text-tertiary tracking-widest uppercase">Soul Corruption</span>
          <span className="text-[10px] font-mono text-white">78%</span>
        </div>
        <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '78%' }}
            className="h-full bg-tertiary shadow-[0_0_10px_rgba(255,107,155,0.5)]" 
          />
        </div>
      </div>
    </div>
  );

  const mainMonitorContent = (
    <div className="flex flex-col h-full relative">
      {!isInBattle && (
        <div className="flex justify-between items-center mb-6 lg:mb-10">
          <div>
            <h2 className="text-xl lg:text-3xl font-black text-white tracking-widest uppercase">
              {activeTab === 'MAP' ? 'WORLD SECTOR' : activeTab === 'HUB' ? 'CITADEL' : 'LABORATORY'}
            </h2>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/30 bg-secondary/5">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[9px] font-bold text-secondary tracking-widest uppercase">Link Stable</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {!isInBattle ? (
          <div className="w-full h-full overflow-y-auto custom-scrollbar lg:pr-2 pb-20 lg:pb-0">
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
                <motion.div key="MAP" variants={tabVariants} initial="hidden" animate="visible" exit="exit" className="h-[500px] lg:h-full">
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
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="flex-1 bg-black rounded-lg lg:rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
              <BattleCanvas onEnd={() => {
                setIsInBattle(false);
                if (activeStageId) addClearedStage(activeStageId);
              }} />
              <button 
                onClick={() => setIsInBattle(false)}
                className="absolute top-4 right-4 z-50 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white/60 hover:text-white transition-colors"
              >
                <Activity size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* PC Only Bottom Bar */}
      <div className="hidden lg:flex mt-auto pt-6 items-center justify-between gap-8 border-t border-white/5 bg-black/20 -mx-8 px-8 pb-4">
        <div className="flex gap-8 flex-1">
          <div className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Active Mana</span>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-primary shadow-[0_0_10px_#BC00FB]" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
            <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Essence</span>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-secondary shadow-[0_0_10px_#00FFFF]" style={{ width: '40%' }} />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {[Sparkles, Shield, Activity].map((Icon, i) => (
            <motion.button 
              key={i}
              whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-full border border-white/5 bg-surface/40 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Icon size={16} />
            </motion.button>
          ))}
        </div>

        <FuchsiaButton
          variant="secondary"
          onClick={() => { if (activeTab === 'MAP' && !isInBattle) { setActiveStageId('1-1'); setIsInBattle(true); } }}
          className="flex items-center gap-3 px-8 py-3 rounded-full text-[10px] tracking-widest uppercase shadow-[0_0_20px_rgba(0,255,171,0.2)]"
        >
          <Sword size={16} /> Deploy Army
        </FuchsiaButton>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background selection:bg-primary/30 overflow-hidden">
      <ResponsiveFrame
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
    </div>
  );
}
