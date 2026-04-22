'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

const BattleCanvas = dynamic(() => import('../components/battle/BattleCanvas').then((mod) => mod.default), { 
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center bg-[#050505] text-primary font-mono animate-pulse text-[10px] tracking-widest uppercase">Initializing...</div>
});

import NecroLab from '../components/necro/NecroLab';
import EquipmentManager from '../components/character/EquipmentManager';
import AreaMap from '../components/map/AreaMap';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { HomeHero } from '../components/home/HomeHero';
import { ResponsiveFrame } from '../components/layout/ResponsiveFrame';
import { NecroLog } from '../components/ui/NecroLog';
import { Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const { 
    player, party, equippingMonsterId, inventoryMonsters, 
    setEquippingMonsterId, addClearedStage, battleLogs, initialize, 
    currentTab, setCurrentTab
  } = useGameStore();

  const [isInBattle, setIsInBattle] = useState(false);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  
  const equippingMonster = equippingMonsterId ? inventoryMonsters.find(m => m.id === equippingMonsterId) : null;

  useEffect(() => {
    if (!player) initialize();
  }, [player, initialize]);

  if (!player) return <div className="p-8 text-center bg-[#050505] min-h-screen font-serif text-gray-500">Loading...</div>;

  // タブに応じたメインコンテンツのレンダリング
  const renderMainContent = () => {
    if (isInBattle) {
      return (
        <motion.div 
          key="battle-active"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="w-full h-full flex flex-col relative"
        >
          <div className="flex-1 bg-black overflow-hidden border border-[#1A1A1A] relative">
            <BattleCanvas onEnd={() => {
              setIsInBattle(false);
              if (activeStageId) addClearedStage(activeStageId);
              setCurrentTab('MAP'); // 勝利後はマップへ戻る
            }} />
            <button 
              onClick={() => {
                setIsInBattle(false);
                setCurrentTab('MAP');
              }}
              className="absolute top-2 right-2 z-50 px-3 py-1 bg-black/60 backdrop-blur-md border border-red-900 text-red-500 text-[10px] font-bold tracking-widest uppercase hover:bg-red-900/20 transition-colors"
            >
              RETREAT
            </button>
          </div>
        </motion.div>
      );
    }

    switch (currentTab) {
      case 'HOME':
        return <HomeHero key="home" />;
      case 'MAP':
        return (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
            <AreaMap onStartStage={(stageId) => {
              setActiveStageId(stageId);
              setIsInBattle(true);
              setCurrentTab('BATTLE');
            }} />
          </motion.div>
        );
      case 'BATTLE':
        return (
          <motion.div key="no-battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center bg-[#050505] text-[#A5A9B4]">
            <div className="text-center">
              <p className="mb-4 font-mono text-sm tracking-widest uppercase">No Active Battle</p>
              <button 
                onClick={() => setCurrentTab('MAP')}
                className="px-6 py-2 bg-[#1A1A1A] border border-[#2C2C2C] text-secondary hover:bg-[#2C2C2C] transition-colors font-bold tracking-widest text-xs uppercase"
              >
                Deploy to Map
              </button>
            </div>
          </motion.div>
        );
      case 'EQUIP':
        return (
          <motion.div key="equip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
            <EquipmentManager />
          </motion.div>
        );
      case 'LAB':
        return (
          <motion.div key="lab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
            <NecroLab />
          </motion.div>
        );
      case 'LOGS':
        return (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col p-2 pt-4">
            <div className="flex items-center mb-3">
              <button 
                onClick={() => setCurrentTab('HOME')}
                className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-[10px] font-black tracking-widest uppercase bg-black/40 border border-[#1A1A1A] px-3 py-1.5 rounded-md backdrop-blur-sm shadow-md"
              >
                <HomeIcon size={14} />
                <span>RETURN TO HUB</span>
              </button>
            </div>
            <div className="flex-1 border border-[#1A1A1A] bg-[#0D0D0D] overflow-hidden">
              <NecroLog logs={battleLogs} />
            </div>
          </motion.div>
        );
      default:
        return <HomeHero key="home" />;
    }
  };

  // サイドバー用のダミー（ResponsiveFrame用だが、今回はメインモニタに全て集約）
  const emptySidebar = <div className="hidden" />;

  return (
    <div className="h-screen bg-[#050505] selection:bg-secondary/30 overflow-hidden">
      <ResponsiveFrame
        leftSidebar={emptySidebar}
        mainMonitor={
          <div className="w-full h-full relative">
            <AnimatePresence mode="wait">
              {renderMainContent()}
            </AnimatePresence>
          </div>
        }
        rightSidebar={emptySidebar}
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
