'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { ItemData, EquipmentSlots, BaseStats } from '../../types/game';
import { equipItemAction, unequipItemAction } from '../../app/actions';
import { Shield, Sword, X, ArrowRight, Package } from 'lucide-react';

import { GameFrame } from '../ui/GameFrame';
import { FuchsiaButton } from '../ui/FuchsiaButton';

const SLOT_LABELS: Record<keyof EquipmentSlots, string> = {
  weapon: 'WEAPON',
  sub: 'SUB',
  head: 'HEAD',
  body: 'BODY',
  arms: 'ARMS',
  legs: 'LEGS',
  acc1: 'ACC1',
  acc2: 'ACC2',
};

export default function EquipmentManager() {
  const { player, inventoryItems, equipItem, unequipItem } = useGameStore();
  const [selectedSlot, setSelectedSlot] = useState<keyof EquipmentSlots | null>(null);
  const [previewItem, setPreviewItem] = useState<ItemData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ステータス計算
  const calculateTotalStats = (equipment: EquipmentSlots): BaseStats => {
    if (!player) return {} as BaseStats;
    const base = { ...player.stats };
    const passives = player.passives;
    
    const total: BaseStats = {
      hp: base.hp,
      mp: base.mp,
      atk: base.atk + passives.passiveAtkBonus,
      def: base.def + passives.passiveDefBonus,
      matk: base.matk + passives.passiveMatkBonus,
      mdef: base.mdef + passives.passiveMdefBonus,
      agi: base.agi,
      luck: base.luck,
      tec: base.tec,
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
        if (selectedSlot === slot) {
          setPreviewItem(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStatDiff = (statKey: keyof BaseStats, label: string) => {
    const currentVal = currentStats[statKey];
    if (!previewStats) {
      return (
        <div className="flex justify-between items-center py-1 border-b border-white/5">
          <span className="text-gray-500 uppercase text-xs">{label}</span>
          <span className="font-bold text-white">{currentVal}</span>
        </div>
      );
    }

    const previewVal = previewStats[statKey];
    const diff = previewVal - currentVal;
    
    return (
      <div className="flex justify-between items-center py-1 border-b border-white/5">
        <span className="text-gray-500 uppercase text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{currentVal}</span>
          {diff !== 0 && (
            <>
              <ArrowRight size={14} className={diff > 0 ? "text-green-500" : "text-fuchsia"} />
              <span className={`font-bold ${diff > 0 ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "text-fuchsia"}`}>
                {previewVal}
              </span>
            </>
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
    <GameFrame 
      title={<span className="flex items-center gap-2"><Sword size={18} /> ARMORY</span>}
      className="w-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
        {/* PC: Left / Mobile: Bottom (Status Preview) */}
        <div className="space-y-4 lg:space-y-6 order-2 lg:order-1">
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 shadow-inner">
            <h3 className="text-[10px] lg:text-xs font-black font-headline text-gray-400 mb-4 tracking-widest uppercase opacity-60">Status Analysis</h3>
            <div className="grid grid-cols-1 gap-1 lg:gap-2">
              {renderStatDiff('hp', 'HP')}
              {renderStatDiff('mp', 'MP')}
              {renderStatDiff('atk', 'ATK')}
              {renderStatDiff('def', 'DEF')}
              {renderStatDiff('matk', 'MATK')}
              {renderStatDiff('mdef', 'MDEF')}
              {renderStatDiff('agi', 'AGI')}
              {renderStatDiff('luck', 'LUCK')}
              {renderStatDiff('tec', 'TEC')}
            </div>
          </div>

          {previewItem && selectedSlot && (
            <div className="bg-primary/10 border border-primary/40 rounded-xl p-4 animate-in fade-in zoom-in duration-300">
              <h3 className="text-primary font-black font-headline text-[10px] lg:text-sm mb-3 flex items-center justify-between uppercase">
                <span>PREVIEW: {previewItem.name}</span>
                <span className="text-[8px] border border-primary/40 px-2 py-0.5 rounded">{previewItem.rarity}</span>
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-2 text-[10px] font-black border border-white/10 rounded-lg hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                  ABORT
                </button>
                <FuchsiaButton
                  disabled={isProcessing}
                  onClick={handleEquip}
                  className="flex-1 py-2 text-[10px] rounded-lg border-b-2"
                >
                  EQUIP
                </FuchsiaButton>
              </div>
            </div>
          )}
        </div>

        {/* PC: Right / Mobile: Top (Equipment Slots) */}
        <div className="space-y-6 order-1 lg:order-2">
          <div>
            <h3 className="text-[10px] lg:text-xs font-black font-headline text-gray-400 mb-4 tracking-widest uppercase opacity-60">Neural Interface</h3>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {(Object.keys(SLOT_LABELS) as (keyof EquipmentSlots)[]).map(slot => {
                const equippedItem = player.equipment[slot];
                const isSelected = selectedSlot === slot;

                return (
                  <div key={slot} className="relative group">
                    <div className="text-[8px] text-white/30 uppercase mb-1 font-black tracking-tighter">{SLOT_LABELS[slot]}</div>
                    <button
                      onClick={() => {
                        setSelectedSlot(slot);
                        setPreviewItem(null);
                      }}
                      className={`w-full h-12 lg:h-16 flex flex-col items-center justify-center border-2 rounded-xl transition-all
                        ${isSelected ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(188,0,251,0.2)]' : 'border-white/5 bg-black/20 hover:border-white/20'}
                      `}
                    >
                      {equippedItem ? (
                        <>
                          <span className={`text-[10px] lg:text-xs font-black text-center px-1 uppercase truncate w-full ${equippedItem.rarity === 'UNIQUE' ? 'text-cursedGold' : 'text-white'}`}>
                            {equippedItem.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-white/10 font-black tracking-widest text-[8px] uppercase">EMPTY</span>
                      )}
                    </button>
                    {equippedItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnequip(slot);
                        }}
                        className="absolute top-4 right-1 text-white/40 hover:text-error transition-colors bg-black border border-white/10 rounded-full p-1 lg:opacity-0 group-hover:opacity-100"
                        title="Unequip"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 選択中のスロットに対応するインベントリリスト */}
          {selectedSlot && (
            <div className="border-t border-white/5 pt-4 animate-in slide-in-from-bottom-4 duration-300">
              <h4 className="text-[10px] lg:text-xs text-gray-400 font-black font-headline mb-3 flex items-center gap-2 uppercase opacity-60">
                <Package size={14} /> Available Data ({SLOT_LABELS[selectedSlot]})
              </h4>
              <div className="grid grid-cols-1 gap-2 max-h-48 lg:max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {getAvailableItems(selectedSlot).length === 0 ? (
                  <div className="text-center py-8 text-white/20 text-[10px] font-black font-headline uppercase border border-dashed border-white/5 rounded-xl bg-black/20">
                    No compatible units found.
                  </div>
                ) : (
                  getAvailableItems(selectedSlot).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItem(item)}
                      className={`p-3 border rounded-xl flex justify-between items-center transition-all text-left group
                        ${previewItem?.id === item.id ? 'border-primary bg-primary/20 shadow-[0_0_15px_rgba(188,0,251,0.1)]' : 'border-white/5 bg-black/40 hover:border-white/20'}
                      `}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-black text-[10px] lg:text-xs text-white uppercase group-hover:text-primary transition-colors">{item.name}</div>
                        <div className="text-[8px] text-gray-500 font-mono mt-0.5">
                          {item.stats.atk ? `A+${item.stats.atk}` : ''} {item.stats.def ? `D+${item.stats.def}` : ''}
                        </div>
                      </div>
                      <ArrowRight size={12} className={`transition-transform duration-300 ${previewItem?.id === item.id ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </GameFrame>
  );
}
