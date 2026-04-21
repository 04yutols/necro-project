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
      title={<span className="flex items-center gap-2"><Sword size={18} /> EQUIPMENT</span>}
      className="w-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左側：プレビューとステータス */}
        <div className="space-y-6">
          <div className="bg-black/50 border border-gray-800 rounded-md p-4 shadow-inner">
            <h3 className="text-sm font-bold font-cinzel text-gray-400 mb-4 tracking-widest">STATUS PREVIEW</h3>
            <div className="space-y-2">
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
            <div className="bg-fuchsia/10 border border-fuchsia/50 rounded-md p-4 animate-in fade-in zoom-in duration-300">
              <h3 className="text-fuchsia font-bold font-cinzel text-sm mb-3 flex items-center justify-between">
                <span>PREVIEW: {previewItem.name}</span>
                <span className="text-[10px] bg-fuchsia text-white px-2 py-0.5 rounded">{previewItem.rarity}</span>
              </h3>
              <div className="flex gap-4">
                <FuchsiaButton
                  variant="ghost"
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-2 text-xs"
                >
                  CANCEL
                </FuchsiaButton>
                <FuchsiaButton
                  disabled={isProcessing}
                  onClick={handleEquip}
                  className="flex-1 py-2 text-xs"
                >
                  EQUIP
                </FuchsiaButton>
              </div>
            </div>
          )}
        </div>

        {/* 右側：8スロット装備枠 */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold font-cinzel text-gray-400 mb-4 tracking-widest">EQUIPMENT SLOTS</h3>
            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(SLOT_LABELS) as (keyof EquipmentSlots)[]).map(slot => {
                const equippedItem = player.equipment[slot];
                const isSelected = selectedSlot === slot;

                return (
                  <div key={slot} className="relative group">
                    <div className="text-[10px] text-gray-500 uppercase mb-1 font-bold">{SLOT_LABELS[slot]}</div>
                    <button
                      onClick={() => {
                        setSelectedSlot(slot);
                        setPreviewItem(null);
                      }}
                      className={`w-full h-16 flex flex-col items-center justify-center border-2 rounded-md transition-all
                        ${isSelected ? 'border-fuchsia bg-fuchsia/10 shadow-[0_0_10px_rgba(255,0,255,0.3)]' : 'border-gray-800 bg-black/40 hover:border-gray-600'}
                      `}
                    >
                      {equippedItem ? (
                        <>
                          <span className={`text-xs md:text-sm font-bold text-center px-1 ${equippedItem.rarity === 'UNIQUE' ? 'text-cursedGold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]' : 'text-white'}`}>
                            {equippedItem.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-600 text-xs font-cinzel tracking-widest">EMPTY</span>
                      )}
                    </button>
                    {equippedItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnequip(slot);
                        }}
                        className="absolute top-5 right-1 text-gray-500 hover:text-fuchsia transition-colors bg-black rounded-full opacity-0 group-hover:opacity-100"
                        title="Unequip"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 選択中のスロットに対応するインベントリリスト */}
          {selectedSlot && (
            <div className="border-t border-gray-800 pt-4 animate-in slide-in-from-bottom-4 duration-300">
              <h4 className="text-sm text-gray-400 font-bold font-cinzel mb-3 flex items-center gap-2">
                <Package size={16} /> INVENTORY ({SLOT_LABELS[selectedSlot]})
              </h4>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {getAvailableItems(selectedSlot).length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-xs italic bg-black/30 rounded-md border border-dashed border-gray-800">
                    装備可能なアイテムを持っていません。
                  </div>
                ) : (
                  getAvailableItems(selectedSlot).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItem(item)}
                      className={`p-3 border rounded-md flex justify-between items-center transition-colors text-left
                        ${previewItem?.id === item.id ? 'border-fuchsia bg-fuchsia/20' : 'border-gray-800 bg-black/60 hover:border-gray-600'}
                      `}
                    >
                      <div className="font-bold text-sm text-white">{item.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-mono">
                        {item.stats.atk ? `ATK+${item.stats.atk}` : ''} {item.stats.def ? `DEF+${item.stats.def}` : ''}
                      </div>
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
