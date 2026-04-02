'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { ItemData, EquipmentSlots, BaseStats } from '../../types/game';
import { equipItemAction, unequipItemAction } from '../../app/actions';
import { Shield, Sword, X, ArrowRight, Package } from 'lucide-react';

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
        <div className="flex justify-between items-center py-1 border-b border-gray-800">
          <span className="text-gray-500 uppercase text-xs">{label}</span>
          <span className="font-bold text-white">{currentVal}</span>
        </div>
      );
    }

    const previewVal = previewStats[statKey];
    const diff = previewVal - currentVal;
    
    return (
      <div className="flex justify-between items-center py-1 border-b border-gray-800">
        <span className="text-gray-500 uppercase text-xs">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{currentVal}</span>
          {diff !== 0 && (
            <>
              <ArrowRight size={14} className={diff > 0 ? "text-green-500" : "text-red-500"} />
              <span className={`font-bold ${diff > 0 ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "text-red-500"}`}>
                {previewVal}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  const getAvailableItems = (slot: keyof EquipmentSlots) => {
    // 簡易的にtypeプレフィックスでフィルタリング。ACC1/ACC2はACCを許容等。
    const targetType = slot.toUpperCase().replace(/\d/g, ''); 
    return inventoryItems.filter(item => item.type.includes(targetType));
  };

  if (!player) return null;

  return (
    <div className="bg-dark/90 border-2 border-blood/50 p-6 rounded-xl shadow-2xl font-mono text-gray-300">
      <header className="flex items-center gap-4 mb-6 border-b border-blood/30 pb-4">
        <Sword className="text-blood w-8 h-8" />
        <h2 className="text-2xl font-bold tracking-widest text-blood uppercase">装備 (Equipment)</h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左側：プレビューとステータス */}
        <div className="space-y-6">
          <div className="bg-black/50 border border-gray-800 rounded p-4">
            <h3 className="text-lg font-bold text-white mb-4 border-l-4 border-blood pl-2">STATUS</h3>
            <div className="space-y-1">
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
            <div className="bg-blood/10 border border-blood/50 rounded p-4 animate-in fade-in zoom-in duration-300">
              <h3 className="text-blood font-bold text-sm mb-2 flex items-center justify-between">
                <span>PREVIEW: {previewItem.name}</span>
                <span className="text-[10px] bg-blood text-white px-2 py-0.5 rounded">{previewItem.rarity}</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="flex-1 py-2 border border-gray-700 hover:bg-gray-800 text-xs font-bold rounded transition-colors"
                >
                  CANCEL
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleEquip}
                  className="flex-1 py-2 bg-blood hover:bg-red-700 text-white font-bold text-xs rounded transition-all shadow-[0_0_15px_rgba(136,8,8,0.5)] disabled:opacity-50"
                >
                  EQUIP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右側：8スロット装備枠 */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white border-l-4 border-blood pl-2">EQUIPMENT SLOTS</h3>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(SLOT_LABELS) as (keyof EquipmentSlots)[]).map(slot => {
              const equippedItem = player.equipment[slot];
              const isSelected = selectedSlot === slot;

              return (
                <div key={slot} className="relative">
                  <div className="text-[10px] text-gray-500 uppercase mb-1 font-bold">{SLOT_LABELS[slot]}</div>
                  <button
                    onClick={() => {
                      setSelectedSlot(slot);
                      setPreviewItem(null);
                    }}
                    className={`w-full h-16 flex flex-col items-center justify-center border-2 border-dashed rounded transition-all
                      ${isSelected ? 'border-blood bg-blood/10' : 'border-gray-700 bg-black/40 hover:border-gray-500'}
                    `}
                  >
                    {equippedItem ? (
                      <>
                        <span className={`text-sm font-bold ${equippedItem.rarity === 'UNIQUE' ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]' : 'text-white'}`}>
                          {equippedItem.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600 text-xs uppercase">Empty</span>
                    )}
                  </button>
                  {equippedItem && (
                    <button
                      onClick={() => handleUnequip(slot)}
                      className="absolute top-5 right-1 text-gray-500 hover:text-red-500 transition-colors bg-black rounded-full"
                      title="Unequip"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 選択中のスロットに対応するインベントリリスト */}
          {selectedSlot && (
            <div className="mt-6 border-t border-gray-800 pt-4 animate-in slide-in-from-bottom-4 duration-300">
              <h4 className="text-sm text-gray-400 font-bold mb-3 flex items-center gap-2">
                <Package size={16} /> INVENTORY ({SLOT_LABELS[selectedSlot]})
              </h4>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {getAvailableItems(selectedSlot).length === 0 ? (
                  <div className="text-center py-4 text-gray-600 text-xs italic">
                    装備可能なアイテムを持っていません。
                  </div>
                ) : (
                  getAvailableItems(selectedSlot).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItem(item)}
                      className={`p-2 border rounded flex justify-between items-center transition-colors text-left
                        ${previewItem?.id === item.id ? 'border-blood bg-blood/20' : 'border-gray-800 bg-black/60 hover:border-gray-500'}
                      `}
                    >
                      <div className="font-bold text-sm text-white">{item.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase">
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
    </div>
  );
}
