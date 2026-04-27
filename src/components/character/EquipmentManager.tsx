'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { ItemData, EquipmentSlots, BaseStats } from '../../types/game';
import { equipItemAction, unequipItemAction } from '../../app/actions';
import { Shield, Sword, X, ArrowRight, Package, Home } from 'lucide-react';

import { GameFrame } from '../ui/GameFrame';

const SLOT_LABELS: Record<keyof EquipmentSlots, string> = {
  weapon: 'WEAP',
  sub: 'SUB',
  head: 'HEAD',
  body: 'BODY',
  arms: 'ARMS',
  legs: 'LEGS',
  acc1: 'ACC1',
  acc2: 'ACC2',
};

export default function EquipmentManager() {
  const { player, inventoryItems, equipItem, unequipItem, setCurrentTab } = useGameStore();
  const [selectedSlot, setSelectedSlot] = useState<keyof EquipmentSlots | null>(null);
  const [previewItem, setPreviewItem] = useState<ItemData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateTotalStats = (equipment: EquipmentSlots): BaseStats => {
    if (!player) return {} as BaseStats;
    const base = { ...player.stats };
    const passives = player.passives;
    
    const total: BaseStats = {
      hp: base.hp, mp: base.mp,
      atk: base.atk + passives.passiveAtkBonus,
      def: base.def + passives.passiveDefBonus,
      matk: base.matk + passives.passiveMatkBonus,
      mdef: base.mdef + passives.passiveMdefBonus,
      agi: base.agi, luck: base.luck, tec: base.tec,
    };

    Object.values(equipment).forEach(item => {
      if (item && item.stats) {
        (Object.keys(item.stats) as (keyof BaseStats)[]).forEach(stat => {
          total[stat] += (item.stats[stat] || 0);
        });
      }
    });

    return total;
  };

  const currentStats = useMemo(() => calculateTotalStats(player?.equipment || {} as EquipmentSlots), [player]);
  
  const previewStats = useMemo(() => {
    if (!player || !selectedSlot || !previewItem) return null;
    const newEquipment = { ...player.equipment, [selectedSlot]: previewItem };
    return calculateTotalStats(newEquipment);
  }, [player, selectedSlot, previewItem]);

  const handleEquip = async () => {
    if (!player || !selectedSlot || !previewItem) return;
    setIsProcessing(true);
    try {
      const result = await equipItemAction(player.id, selectedSlot, previewItem.id);
      if (result.success) {
        equipItem(selectedSlot, previewItem);
        setPreviewItem(null);
        setSelectedSlot(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnequip = async (slot: keyof EquipmentSlots) => {
    if (!player) return;
    setIsProcessing(true);
    try {
      const result = await unequipItemAction(player.id, slot);
      if (result.success) {
        unequipItem(slot);
        if (selectedSlot === slot) setPreviewItem(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatRow = (statKey: keyof BaseStats, label: string) => {
    const currentVal = currentStats[statKey];
    const previewVal = previewStats ? previewStats[statKey] : null;
    const diff = previewVal !== null ? previewVal - currentVal : 0;

    return (
      <div className="flex justify-between items-center text-[10px] py-0.5 border-b border-[#1A1A1A]">
        <span className="text-gray-500 font-bold">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-primary">{currentVal}</span>
          {previewVal !== null && diff !== 0 && (
            <span className={diff > 0 ? "text-green-500" : "text-red-500"}>
              → {previewVal}
            </span>
          )}
        </div>
      </div>
    );
  };

  const getAvailableItems = (slot: keyof EquipmentSlots) => {
    const targetType = slot.toUpperCase().replace(/\d/g, ''); 
    return inventoryItems.filter(item => item.type.includes(targetType));
  };

  if (!player) return null;

  return (
    <div className="flex flex-col gap-2 h-full pt-2 px-2 pb-6">
      {/* Back to Home Button */}
      <div className="flex items-center">
        <button 
          onClick={() => setCurrentTab('HOME')}
          className="flex items-center gap-2 text-gray-400 hover:text-secondary transition-colors text-[10px] font-black tracking-widest uppercase mb-1 bg-black/40 border border-[#1A1A1A] px-3 py-1.5 rounded-md backdrop-blur-sm shadow-md"
        >
          <Home size={14} />
          <span>RETURN TO HUB</span>
        </button>
      </div>

      {/* Upper Grid: Slots and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Status Preview */}
        <GameFrame title="STATUS" borderColor="iron">
          <div className="grid grid-cols-2 gap-x-4">
            {renderStatRow('atk', 'ATK')}
            {renderStatRow('def', 'DEF')}
            {renderStatRow('matk', 'MATK')}
            {renderStatRow('mdef', 'MDEF')}
            {renderStatRow('agi', 'AGI')}
            {renderStatRow('luck', 'LUCK')}
            {renderStatRow('tec', 'TEC')}
          </div>
        </GameFrame>

        {/* Equipment Slots */}
        <GameFrame title="EQUIPMENT" borderColor="iron">
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(SLOT_LABELS) as (keyof EquipmentSlots)[]).map(slot => {
              const equippedItem = player.equipment[slot];
              const isSelected = selectedSlot === slot;

              return (
                <button
                  key={slot}
                  onClick={() => { setSelectedSlot(slot); setPreviewItem(null); }}
                  className={`relative h-10 border flex flex-col items-center justify-center p-0.5 text-[8px] transition-colors
                    ${isSelected ? 'border-secondary bg-secondary/5' : 'border-[#2C2C2C] bg-[#050505] hover:bg-[#121212]'}
                  `}
                >
                  <span className="text-gray-600 font-bold uppercase">{SLOT_LABELS[slot]}</span>
                  <span className={`font-bold truncate w-full text-center ${equippedItem?.rarity === 'UNIQUE' ? 'text-cursedGold' : 'text-primary'}`}>
                    {equippedItem ? equippedItem.name : '----'}
                  </span>
                </button>
              );
            })}
          </div>
        </GameFrame>
      </div>

      {/* Item Selection / Inventory */}
      {selectedSlot && (
        <GameFrame title={`SELECT ${SLOT_LABELS[selectedSlot]}`} borderColor="iron" className="flex-1">
          <div className="flex flex-col gap-1 h-full min-h-[200px]">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              {getAvailableItems(selectedSlot).length === 0 ? (
                <div className="text-center py-4 text-gray-700 text-[10px] italic">No items found.</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {getAvailableItems(selectedSlot).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItem(item)}
                      className={`flex justify-between items-center px-2 py-1 text-[10px] border transition-colors
                        ${previewItem?.id === item.id ? 'border-secondary bg-secondary/5' : 'border-transparent bg-[#0D0D0D] hover:bg-[#151515]'}
                      `}
                    >
                      <span className={item.rarity === 'UNIQUE' ? 'text-cursedGold' : 'text-primary'}>{item.name}</span>
                      <div className="flex gap-2 font-mono text-[8px] text-gray-500">
                        {item.stats.atk ? `A+${item.stats.atk}` : ''}
                        {item.stats.def ? `D+${item.stats.def}` : ''}
                        {item.stats.agi ? `S+${item.stats.agi}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            {previewItem && (
              <div className="border-t border-[#2C2C2C] pt-2 mt-1 flex gap-2">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-1 text-[10px] font-bold border border-[#2C2C2C] hover:bg-red-900/10 hover:text-red-500 transition-colors uppercase"
                >
                  CANCEL
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleEquip}
                  className="flex-1 py-1 text-[10px] font-bold bg-[#8A6D1F]/20 text-secondary border border-[#8A6D1F] hover:bg-[#8A6D1F]/40 transition-colors uppercase"
                >
                  EQUIP
                </button>
              </div>
            )}

            {!previewItem && player.equipment[selectedSlot] && (
              <div className="border-t border-[#2C2C2C] pt-2 mt-1 flex gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleUnequip(selectedSlot)}
                  className="flex-1 py-1 text-[10px] font-bold border border-[#4A0000] text-red-500 bg-[#4A0000]/10 hover:bg-[#4A0000]/20 transition-colors uppercase"
                >
                  UNEQUIP
                </button>
              </div>
            )}
          </div>
        </GameFrame>
      )}
    </div>
  );
}
