'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import BattleCanvas from '../components/battle/BattleCanvas';
import NecroLab from '../components/necro/NecroLab';
import EquipmentManager from '../components/character/EquipmentManager';
import AreaMap from '../components/map/AreaMap';
import { Skull, Map, Shield, Activity, Sword } from 'lucide-react';
import ShardEquipModal from '../components/necro/ShardEquipModal';
import { GameFrame } from '../components/ui/GameFrame';
import { BloodButton } from '../components/ui/BloodButton';

export default function Home() {
  const { player, setPlayer, setNecroStatus, setInventoryMonsters, setInventoryItems, party, equippingMonsterId, inventoryMonsters: allMonsters, setEquippingMonsterId, addClearedStage } = useGameStore();
  const [isInBattle, setIsInBattle] = useState(false);
  const [activeTab, setActiveTab] = useState<'HUB' | 'LAB' | 'MAP'>('HUB');
  const [activeStageId, setActiveStageId] = useState<string | null>(null);

  const equippingMonster = equippingMonsterId ? allMonsters.find(m => m.id === equippingMonsterId) : null;

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

  if (!player) return <div className="p-8 text-center bg-dark min-h-screen font-cinzel text-white">Loading Hero Data...</div>;

  const tabVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  };

  return (
    <main className="min-h-screen bg-necro-gradient text-white flex flex-col font-noto">
      <nav className="bg-black/80 border-b border-blood/30 p-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1536px] mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold font-cinzel text-blood tracking-widest uppercase drop-shadow-[0_0_8px_rgba(136,8,8,0.8)]">Necromance Brave</h1>
          <div className="flex gap-2 md:gap-4">
            <button onClick={() => setActiveTab('HUB')} className={`flex items-center gap-2 px-3 py-2 font-cinzel font-bold transition-all ${activeTab === 'HUB' ? 'text-white border-b-2 border-blood' : 'text-gray-500 hover:text-white'}`}>
              <Shield size={18} /> <span className="hidden md:inline">HUB</span>
            </button>
            <button onClick={() => setActiveTab('LAB')} className={`flex items-center gap-2 px-3 py-2 font-cinzel font-bold transition-all ${activeTab === 'LAB' ? 'text-white border-b-2 border-blood' : 'text-gray-500 hover:text-white'}`}>
              <Skull size={18} /> <span className="hidden md:inline">LAB</span>
            </button>
            <button onClick={() => setActiveTab('MAP')} className={`flex items-center gap-2 px-3 py-2 font-cinzel font-bold transition-all ${activeTab === 'MAP' ? 'text-white border-b-2 border-blood' : 'text-gray-500 hover:text-white'}`}>
              <Map size={18} /> <span className="hidden md:inline">MAP</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1536px] mx-auto w-full h-full flex flex-col lg:flex-row gap-6">
          
          {!isInBattle && (
            <GameFrame 
              className="lg:w-1/4 flex-shrink-0 self-start sticky top-24" 
              borderColor="gray" 
              title={<span className="flex items-center gap-2"><Activity size={18} /> PROFILE</span>}
            >
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Name</div>
                  <div className="text-2xl font-bold font-cinzel text-white">{player.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Class</div>
                  <div className="text-lg font-bold font-cinzel text-cursedGold">{player.currentJobId}</div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span>HP</span>
                    <span>{player.stats.hp} / 100</span>
                  </div>
                  <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-800">
                    <motion.div 
                      className="bg-red-600 h-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${(player.stats.hp / 100) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span>MP</span>
                    <span>{player.stats.mp} / 20</span>
                  </div>
                  <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden border border-gray-800">
                    <motion.div 
                      className="bg-blue-600 h-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${(player.stats.mp / 20) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Sword size={16}/> Weapon</div>
                  <div className="text-md font-bold text-white bg-black/40 p-2 rounded border border-gray-800">
                    {player.equipment.weapon ? player.equipment.weapon.name : <span className="text-gray-600 italic">None</span>}
                  </div>
                </div>
              </div>
            </GameFrame>
          )}

          <div className="flex-1 min-w-0">
            {!isInBattle ? (
              <AnimatePresence mode="wait">
                {activeTab === 'HUB' && (
                  <motion.div 
                    key="HUB"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <GameFrame title={<span className="flex items-center gap-2"><Skull size={18}/> CURRENT PARTY</span>}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {party.map((m, i) => (
                          <div key={i} className={`p-4 border ${m ? 'border-necro bg-necro/10' : 'border-dashed border-gray-800 bg-black/20'} rounded flex flex-col justify-center items-center h-24`}>
                            {m ? (
                              <>
                                <div className="font-bold text-lg text-white">{m.name}</div>
                                <div className="text-xs text-gray-400 uppercase tracking-tighter">{m.tribe} | COST {m.cost}</div>
                              </>
                            ) : (
                              <div className="text-gray-700 italic text-sm font-bold uppercase">Empty Slot</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </GameFrame>
                    <EquipmentManager />
                  </motion.div>
                )}

                {activeTab === 'LAB' && (
                  <motion.div 
                    key="LAB"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <NecroLab />
                  </motion.div>
                )}

                {activeTab === 'MAP' && (
                  <motion.div 
                    key="MAP"
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <AreaMap onStartStage={(stageId) => {
                      setActiveStageId(stageId);
                      setIsInBattle(true);
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <motion.div 
                className="w-full flex flex-col items-center justify-center h-full"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <BattleCanvas onEnd={() => {
                  setIsInBattle(false);
                  if (activeStageId) {
                    addClearedStage(activeStageId);
                  }
                }} />
                <BloodButton 
                  variant="ghost"
                  className="mt-8"
                  onClick={() => setIsInBattle(false)}
                >
                  撤退 (RETREAT)
                </BloodButton>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {equippingMonster && (
        <ShardEquipModal 
          monster={equippingMonster} 
          onClose={() => setEquippingMonsterId(null)} 
        />
      )}
    </main>
  );
}
