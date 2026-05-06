'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { AbyssalResidueData, ResidueMatData } from '../../types/game';
import { Home } from 'lucide-react';
import { useNecroLabPixi } from './useNecroLabPixi';
import { useGothicSound } from './useGothicSound';
import { EquipTab, EnhanceTab } from './ResidueEquipPanel';

/* ══════════════════════════════════════════
   MAIN: NecroLab
══════════════════════════════════════════ */
export default function NecroLab() {
  const {
    necroStatus, abyssalResidues, equippedResidueSlots, residueMaterials,
    equipResidueToSlot, upgradeResidue, setCurrentTab,
  } = useGameStore();

  const sound = useGothicSound();

  const pixiContainerRef = useRef<HTMLDivElement>(null);
  useNecroLabPixi({ canvasContainer: pixiContainerRef });

  const [activeTab, setActiveTab] = useState<'EQUIP' | 'ENHANCE'>('EQUIP');
  const [selectedId, setSelectedId] = useState<string | null>(abyssalResidues[0]?.id ?? null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  if (!necroStatus) return (
    <div className="flex items-center justify-center h-full">
      <span className="text-[12px] font-black tracking-widest animate-pulse"
        style={{ color: '#FF5555', fontFamily: 'monospace' }}>
        UNAUTHORIZED ACCESS
      </span>
    </div>
  );

  const handleSlotTap = (i: number) => {
    setActiveSlot(prev => prev === i ? null : i);
  };

  const handleEquip = () => {
    const residue = abyssalResidues.find(r => r.id === selectedId);
    if (!residue) return;
    let target = activeSlot;
    if (target === null) {
      target = equippedResidueSlots.findIndex(s => s === null);
      if (target === -1) target = 0;
    }
    sound.playEquip();
    equipResidueToSlot(target, residue);
    setActiveSlot(null);
  };

  const handleEnhance = (matIds: string[]) => {
    if (!selectedId) return;
    upgradeResidue(selectedId, matIds);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(180deg, #06020F 0%, #0A0422 55%, #040112 100%)' }}
    >
      {/* PixiJS ambient backdrop */}
      <div
        ref={pixiContainerRef}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ opacity: 0.4 }}
      />
      {/* Corner glows */}
      <div className="absolute top-0 left-0 w-40 h-40 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(160,50,255,0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-0 w-40 h-40 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 100% 100%, rgba(160,50,255,0.12) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <div
        className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3 gothic-panel"
        style={{
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        }}
      >
        <button
          onClick={() => { sound.playTap(); setCurrentTab('EQUIP'); }}
          className="flex items-center gap-2 transition-all active:scale-90 py-1"
          style={{ color: 'rgba(185,110,255,0.88)' }}
        >
          <Home size={15} />
          <span className="text-[12px] font-black tracking-[0.18em]" style={{ fontFamily: 'monospace' }}>LEGION</span>
        </button>

        <span
          className="text-[14px] font-black tracking-[0.3em] uppercase"
          style={{
            color: '#E080FF',
            fontFamily: "'Cinzel Decorative', serif",
            textShadow: '0 0 16px rgba(204,34,255,0.65)',
          }}
        >
          NECRO-LAB
        </span>

        <div
          className="flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full anim-void-pulse"
          style={{
            background: 'rgba(160,0,255,0.15)',
            border: '1px solid rgba(160,0,255,0.45)',
            color: 'rgba(210,90,255,0.9)',
            fontFamily: 'monospace',
          }}
        >
          <span>Rank {necroStatus.rank}</span>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="relative z-10 shrink-0 flex px-3 pt-1 gap-0"
        style={{ borderBottom: '1px solid rgba(160,50,255,0.2)' }}>
        {(['EQUIP', 'ENHANCE'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { sound.playTap(); setActiveTab(tab); }}
            className="flex-1 py-3.5 text-[13px] font-black tracking-[0.22em] relative transition-colors"
            style={{ color: activeTab === tab ? '#E080FF' : 'rgba(195,175,235,0.45)', fontFamily: 'monospace' }}
          >
            {tab === 'EQUIP' ? '装　備' : '強　化'}
            {activeTab === tab && (
              <motion.div
                layoutId="lab-tab-underline"
                className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #CC22FF, transparent)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'EQUIP' ? (
            <EquipTab
              key="equip"
              abyssalResidues={abyssalResidues}
              equippedResidueSlots={equippedResidueSlots}
              selectedId={selectedId}
              activeSlot={activeSlot}
              onSelectResidue={setSelectedId}
              onSlotTap={handleSlotTap}
              onEquip={handleEquip}
              sound={sound}
            />
          ) : (
            <EnhanceTab
              key="enhance"
              abyssalResidues={abyssalResidues}
              residueMaterials={residueMaterials}
              selectedId={selectedId}
              onEnhance={handleEnhance}
              sound={sound}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
