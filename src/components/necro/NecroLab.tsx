'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { AbyssalResidueData, ResidueMatData } from '../../types/game';
import { Home, Plus, Sparkles, Zap, ChevronRight } from 'lucide-react';
import { useNecroLabPixi } from './useNecroLabPixi';
import { useResidueEnhancePixi } from './useResidueEnhancePixi';
import { useGothicSound } from './useGothicSound';

/* ──────────────────────────────────────────
   Constants
────────────────────────────────────────── */
const RARITY_COLOR: Record<string, string> = {
  COMMON: '#99AABC',
  RARE: '#55AAFF',
  EPIC: '#CC22FF',
};
const RARITY_GLOW: Record<string, string> = {
  COMMON: 'rgba(153,170,188,0.32)',
  RARE: 'rgba(85,170,255,0.38)',
  EPIC: 'rgba(204,34,255,0.48)',
};
const STAT_LABEL: Record<string, string> = {
  'ATK%': 'ATK', 'ATK_FLAT': 'ATK', 'DEF%': 'DEF', 'DEF_FLAT': 'DEF',
  'HP%': 'HP', 'HP_FLAT': 'HP', 'MATK%': 'MATK', 'MDEF%': 'MDEF',
  'AGI%': 'AGI', 'LUCK%': 'LUCK', 'TEC%': 'TEC', 'MP%': 'MP', 'MP_FLAT': 'MP',
  'CRIT_RATE': 'CRIT RATE', 'CRIT_DMG': 'CRIT DMG',
};

function formatStat(type: string, value: number): string {
  const isFlat = type.endsWith('_FLAT') || type === 'HP_FLAT' || type === 'MP_FLAT';
  return isFlat ? Math.round(value).toString() : `${value.toFixed(1)}%`;
}

/* ──────────────────────────────────────────
   ResidueIcon — geometric SVG per rarity
────────────────────────────────────────── */
function ResidueIcon({ rarity, size = 36 }: { rarity: string; size?: number }) {
  const c = RARITY_COLOR[rarity] ?? RARITY_COLOR.COMMON;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <polygon
        points="15,3 29,3 41,15 41,29 29,41 15,41 3,29 3,15"
        fill={`${c}28`}
        stroke={c}
        strokeWidth="1.5"
      />
      {rarity === 'EPIC' && (
        <>
          <polygon
            points="22,10 24.5,18 33,18 26.5,23 29,31 22,26 15,31 17.5,23 11,18 19.5,18"
            fill={`${c}44`}
            stroke={c}
            strokeWidth="0.7"
          />
          <circle cx="22" cy="22" r="3" fill={c} opacity="0.9" />
        </>
      )}
      {rarity === 'RARE' && (
        <>
          <circle cx="22" cy="22" r="7" fill={`${c}38`} stroke={c} strokeWidth="0.8" />
          <circle cx="22" cy="22" r="2.5" fill={c} opacity="0.85" />
        </>
      )}
      {rarity === 'COMMON' && (
        <circle cx="22" cy="22" r="4" fill={`${c}60`} stroke={c} strokeWidth="0.8" />
      )}
    </svg>
  );
}

/* ──────────────────────────────────────────
   ResidueSlotCard — top 3 equipment slots
────────────────────────────────────────── */
interface SlotProps {
  slot: AbyssalResidueData | null;
  slotIndex: number;
  isActive: boolean;
  onTap: () => void;
}
function ResidueSlotCard({ slot, slotIndex, isActive, onTap }: SlotProps) {
  const color = slot ? RARITY_COLOR[slot.rarity] : 'rgba(160,100,220,0.6)';
  return (
    <motion.button
      onClick={onTap}
      whileTap={{ scale: 0.92 }}
      className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-1 relative overflow-hidden"
      style={{
        height: 82,
        background: slot
          ? `linear-gradient(160deg, ${RARITY_GLOW[slot.rarity]}, rgba(12,5,28,0.88))`
          : 'rgba(10,5,24,0.65)',
        border: `1.5px solid ${isActive ? 'rgba(240,180,255,0.95)' : slot ? color + '88' : 'rgba(130,70,200,0.38)'}`,
        borderStyle: slot ? 'solid' : 'dashed',
        boxShadow: isActive
          ? `0 0 22px rgba(204,34,255,0.75), inset 0 0 14px rgba(0,0,0,0.4)`
          : slot
          ? `0 0 12px ${RARITY_GLOW[slot.rarity]}, inset 0 0 14px rgba(0,0,0,0.5)`
          : 'inset 0 0 12px rgba(0,0,0,0.5)',
      }}
    >
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          style={{ border: '1.5px solid rgba(240,150,255,0.75)' }}
        />
      )}
      <div className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }} />

      {slot ? (
        <>
          <ResidueIcon rarity={slot.rarity} size={22} />
          <span className="text-[11px] font-black truncate max-w-[72px] text-center leading-tight"
            style={{ color: RARITY_COLOR[slot.rarity], fontFamily: 'monospace' }}>
            {slot.name}
          </span>
          <span className="text-[12px] font-black" style={{ color: '#FBBB30', fontFamily: 'monospace' }}>
            {formatStat(slot.mainStat.type, slot.mainStat.value)}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(195,180,235,0.65)', fontFamily: 'monospace' }}>
            Lv.{slot.level}
          </span>
        </>
      ) : (
        <>
          <Plus size={16} style={{ color: 'rgba(180,100,255,0.55)' }} strokeWidth={2} />
          <span className="text-[11px] font-bold" style={{ color: 'rgba(160,110,230,0.7)', fontFamily: 'monospace' }}>
            SLOT {slotIndex + 1}
          </span>
        </>
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   ResidueDetailStrip — compact selected detail (EQUIP)
────────────────────────────────────────── */
interface StripProps {
  residue: AbyssalResidueData | null;
  isEquipped: boolean;
  onEquip: () => void;
}
function ResidueDetailStrip({ residue, isEquipped, onEquip }: StripProps) {
  if (!residue) {
    return (
      <div className="gothic-panel rounded-2xl flex items-center justify-center gap-2.5 opacity-30"
        style={{ height: 80 }}>
        <div className="text-2xl">？</div>
        <span className="text-[11px] tracking-widest font-bold" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>
          残滓を選択
        </span>
      </div>
    );
  }

  const color = RARITY_COLOR[residue.rarity];
  const statLabel = STAT_LABEL[residue.mainStat.type] ?? residue.mainStat.type;
  const statValue = formatStat(residue.mainStat.type, residue.mainStat.value);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={residue.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
        className="gothic-panel rounded-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

        <div className="flex items-center gap-3 px-3" style={{ height: 80 }}>
          {/* Icon */}
          <div className="shrink-0 w-[48px] h-[48px] rounded-xl flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 35% 30%, ${color}28, rgba(0,0,0,0.85))`,
              border: `1.5px solid ${color}66`,
              boxShadow: `0 0 12px ${color}22`,
            }}>
            <ResidueIcon rarity={residue.rarity} size={30} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-black truncate leading-tight"
                style={{ color: '#EDE8FF', fontFamily: "'Cinzel Decorative', serif" }}>
                {residue.name}
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>
                {residue.rarity}
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-black leading-none"
                style={{ color, fontFamily: 'monospace', textShadow: `0 0 10px ${color}77` }}>
                {statValue}
              </span>
              <span className="text-[10px] font-bold" style={{ color: color + 'BB', fontFamily: 'monospace' }}>
                {statLabel}
              </span>
              <span className="text-[10px] ml-1" style={{ color: 'rgba(195,182,238,0.5)', fontFamily: 'monospace' }}>
                Lv.{residue.level}
              </span>
            </div>

            {residue.subOptions.length > 0 && (
              <div className="flex items-center gap-2">
                {residue.subOptions.slice(0, 2).map((opt, i) => (
                  <span key={i} className="text-[10px]"
                    style={{ color: 'rgba(195,180,238,0.6)', fontFamily: 'monospace' }}>
                    {STAT_LABEL[opt.type] ?? opt.type} +{formatStat(opt.type, opt.value)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Equip button */}
          <motion.button
            onClick={onEquip}
            whileTap={{ scale: 0.92 }}
            className="shrink-0 rounded-xl text-[12px] font-black tracking-[0.1em]"
            style={{
              background: isEquipped ? 'rgba(0,90,48,0.45)' : `linear-gradient(135deg, ${color}38, rgba(12,5,28,0.85))`,
              border: `1.5px solid ${isEquipped ? 'rgba(0,210,110,0.6)' : color + '77'}`,
              color: isEquipped ? '#00DD77' : color,
              boxShadow: isEquipped ? '0 0 10px rgba(0,210,110,0.2)' : `0 0 10px ${RARITY_GLOW[residue.rarity]}`,
              fontFamily: 'monospace',
              minWidth: 64,
              minHeight: 44,
              padding: '0 10px',
            }}
          >
            {isEquipped ? '✓ 装備中' : '装備する'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ──────────────────────────────────────────
   ResidueGridCard — inventory grid item
────────────────────────────────────────── */
interface GridCardProps {
  residue: AbyssalResidueData;
  isSelected: boolean;
  isEquipped: boolean;
  onSelect: () => void;
}
const GRID_ITEM_H = 104;

function ResidueGridCard({ residue, isSelected, isEquipped, onSelect }: GridCardProps) {
  const color = RARITY_COLOR[residue.rarity];
  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.91 }}
      className="rounded-xl flex flex-col items-center gap-1 py-2.5 px-1.5 relative overflow-hidden"
      style={{
        height: GRID_ITEM_H,
        background: isSelected
          ? `linear-gradient(160deg, ${RARITY_GLOW[residue.rarity]}, rgba(12,5,28,0.92))`
          : 'rgba(12,6,28,0.7)',
        border: `1.5px solid ${isSelected ? color + 'BB' : 'rgba(130,70,200,0.35)'}`,
        boxShadow: isSelected ? `0 0 16px ${RARITY_GLOW[residue.rarity]}` : 'none',
      }}
    >
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)' }} />
      {isEquipped && (
        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
          style={{ background: '#00DD77', boxShadow: '0 0 6px #00DD77' }} />
      )}
      <div className="w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 5px ${color}` }} />

      <ResidueIcon rarity={residue.rarity} size={32} />

      <span className="text-[12px] font-black" style={{ color, fontFamily: 'monospace' }}>
        {formatStat(residue.mainStat.type, residue.mainStat.value)}
      </span>
      <span className="text-[10px] truncate max-w-full px-0.5 text-center leading-tight"
        style={{ color: 'rgba(195,182,238,0.78)', fontFamily: 'monospace' }}>
        {residue.name}
      </span>
      <span className="text-[10px]" style={{ color: 'rgba(195,182,238,0.58)', fontFamily: 'monospace' }}>
        Lv.{residue.level}
      </span>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   VirtualResidueGrid — 3-col virtual scroll
────────────────────────────────────────── */
const GRID_COLS = 3;
const GRID_GAP = 8;
const ROW_H = GRID_ITEM_H + GRID_GAP;

interface VirtualGridProps {
  items: AbyssalResidueData[];
  selectedId: string | null;
  equippedIds: Set<string>;
  onSelect: (id: string) => void;
}
function VirtualResidueGrid({ items, selectedId, equippedIds, onSelect }: VirtualGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerH(el.clientHeight);
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalRows = Math.ceil(items.length / GRID_COLS);
  const totalH = totalRows * ROW_H + GRID_GAP;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - 1);
  const visibleRows = Math.ceil(containerH / ROW_H) + 2;
  const endRow = Math.min(totalRows, startRow + visibleRows);
  const offsetTop = startRow * ROW_H + GRID_GAP;
  const visibleItems = items.slice(startRow * GRID_COLS, endRow * GRID_COLS);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto custom-scrollbar"
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalH, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetTop,
            left: GRID_GAP,
            right: GRID_GAP,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gap: GRID_GAP,
          }}
        >
          {visibleItems.map(r => (
            <ResidueGridCard
              key={r.id}
              residue={r}
              isSelected={r.id === selectedId}
              isEquipped={equippedIds.has(r.id)}
              onSelect={() => onSelect(r.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   EquipTab
────────────────────────────────────────── */
interface EquipTabProps {
  abyssalResidues: AbyssalResidueData[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  selectedId: string | null;
  activeSlot: number | null;
  onSelectResidue: (id: string) => void;
  onSlotTap: (i: number) => void;
  onEquip: () => void;
  sound: ReturnType<typeof useGothicSound>;
}
function EquipTab({
  abyssalResidues, equippedResidueSlots, selectedId, activeSlot,
  onSelectResidue, onSlotTap, onEquip, sound,
}: EquipTabProps) {
  const selectedResidue = abyssalResidues.find(r => r.id === selectedId) ?? null;
  const equippedIds = useMemo(
    () => new Set(equippedResidueSlots.filter(Boolean).map(s => s!.id)),
    [equippedResidueSlots],
  );
  const isEquipped = selectedResidue ? equippedIds.has(selectedResidue.id) : false;

  return (
    <motion.div
      key="equip"
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 18 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col flex-1 overflow-hidden"
    >
      {/* 3 residue slots */}
      <div className="shrink-0 flex gap-2 px-3 pt-2.5 pb-1.5">
        {equippedResidueSlots.map((slot, i) => (
          <ResidueSlotCard
            key={i}
            slot={slot}
            slotIndex={i}
            isActive={activeSlot === i}
            onTap={() => { sound.playTap(); onSlotTap(i); }}
          />
        ))}
      </div>

      {/* Compact detail strip */}
      <div className="shrink-0 px-3 pb-2">
        <ResidueDetailStrip
          residue={selectedResidue}
          isEquipped={isEquipped}
          onEquip={onEquip}
        />
      </div>

      {/* Inventory label */}
      <div className="shrink-0 flex items-center justify-between px-4 pb-1.5">
        <span className="text-[11px] font-black tracking-[0.18em]"
          style={{ color: 'rgba(185,110,255,0.9)', fontFamily: 'monospace' }}>
          ☠ 残滓一覧 — {abyssalResidues.length}個
        </span>
        {selectedResidue && (
          <span className="text-[10px] font-bold" style={{ color: 'rgba(195,182,238,0.6)', fontFamily: 'monospace' }}>
            スロットをタップ → 装備
          </span>
        )}
      </div>

      {/* Virtual grid */}
      <VirtualResidueGrid
        items={abyssalResidues}
        selectedId={selectedId}
        equippedIds={equippedIds}
        onSelect={id => { sound.playTap(); onSelectResidue(id); }}
      />
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   StatsComparison (ENHANCE tab)
────────────────────────────────────────── */
function StatsComparison({ residue, expGain }: { residue: AbyssalResidueData | null; expGain: number }) {
  if (!residue) return (
    <div className="gothic-panel rounded-2xl p-4 shrink-0 flex items-center justify-center opacity-35" style={{ height: 120 }}>
      <span className="text-[12px] tracking-widest font-bold" style={{ color: 'rgba(180,100,255,0.75)', fontFamily: 'monospace' }}>SELECT RESIDUE</span>
    </div>
  );

  let newExp = residue.exp + expGain;
  let newLevel = residue.level;
  let newMaxExp = residue.maxExp;
  let levelledUp = false;

  while (newExp >= newMaxExp && newLevel < 20) {
    newExp -= newMaxExp;
    newLevel++;
    newMaxExp = Math.floor(newMaxExp * 1.5);
    levelledUp = true;
  }
  if (newLevel >= 20) newExp = Math.min(newExp, newMaxExp);

  const newMainValue = levelledUp
    ? +(residue.mainStat.value * (1 + newLevel * 0.04)).toFixed(1)
    : residue.mainStat.value;
  const color = RARITY_COLOR[residue.rarity];

  return (
    <div className="gothic-panel rounded-2xl p-4 shrink-0">
      <span className="text-[11px] font-black tracking-[0.22em] block mb-3"
        style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>
        STAT PREVIEW
      </span>
      <div className="flex items-center justify-between gap-2">
        {/* Before */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[11px] tracking-widest font-bold" style={{ color: 'rgba(195,182,238,0.65)', fontFamily: 'monospace' }}>BEFORE</span>
          <span className="text-[12px] font-black" style={{ color: 'rgba(160,145,195,0.75)', fontFamily: 'monospace' }}>Lv.{residue.level}</span>
          <span className="text-2xl font-black leading-none" style={{ color: 'rgba(160,145,195,0.85)', fontFamily: 'monospace' }}>
            {formatStat(residue.mainStat.type, residue.mainStat.value)}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(195,182,238,0.55)', fontFamily: 'monospace' }}>
            {STAT_LABEL[residue.mainStat.type] ?? residue.mainStat.type}
          </span>
        </div>

        {/* Arrow + level-up badge */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          {levelledUp && (
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,210,110,0.18)', border: '1px solid rgba(0,210,110,0.45)', color: '#00DD77' }}
            >
              LV UP!
            </motion.span>
          )}
          <ChevronRight size={20} style={{ color: `${color}99` }} />
        </div>

        {/* After */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[11px] tracking-widest font-bold" style={{ color: 'rgba(195,182,238,0.65)', fontFamily: 'monospace' }}>AFTER</span>
          <span className="text-[12px] font-black" style={{ color: levelledUp ? '#00DD77' : 'rgba(160,145,195,0.75)', fontFamily: 'monospace' }}>Lv.{newLevel}</span>
          <span
            className="text-2xl font-black leading-none"
            style={{
              color: levelledUp ? color : 'rgba(195,185,240,0.92)',
              fontFamily: 'monospace',
              textShadow: levelledUp ? `0 0 14px ${color}99` : 'none',
            }}
          >
            {formatStat(residue.mainStat.type, newMainValue)}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(195,182,238,0.55)', fontFamily: 'monospace' }}>
            {STAT_LABEL[residue.mainStat.type] ?? residue.mainStat.type}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   EnhanceGauge — PixiJS liquid EXP bar
────────────────────────────────────────── */
function EnhanceGauge({ residue, previewExpGain }: { residue: AbyssalResidueData | null; previewExpGain: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getHandle } = useResidueEnhancePixi({ containerRef });

  useEffect(() => {
    const handle = getHandle();
    if (!handle || !residue) return;
    const current = residue.maxExp > 0 ? residue.exp / residue.maxExp : 0;
    const preview = residue.maxExp > 0 ? Math.min(1, (residue.exp + previewExpGain) / residue.maxExp) : 0;
    handle.setFill(current, preview);
  }, [residue?.exp, residue?.maxExp, previewExpGain, getHandle]);

  return (
    <div className="gothic-panel rounded-2xl p-4 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-black tracking-[0.22em]"
          style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>
          ✦ SOUL INFUSION
        </span>
        <span className="text-[11px] font-black" style={{ color: '#E080FF', fontFamily: 'monospace' }}>
          {residue ? `${residue.exp.toLocaleString()} / ${residue.maxExp.toLocaleString()} EXP` : '—'}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{ height: 56, width: '100%', borderRadius: 10, overflow: 'hidden' }}
      />
      {previewExpGain > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-end mt-1.5 gap-1.5"
        >
          <Sparkles size={10} style={{ color: '#E080FF' }} />
          <span className="text-[11px] font-black" style={{ color: '#E080FF', fontFamily: 'monospace' }}>
            +{previewExpGain.toLocaleString()} EXP
          </span>
        </motion.div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   MaterialCard
────────────────────────────────────────── */
function MaterialCard({ mat, isSelected, onToggle }: { mat: ResidueMatData; isSelected: boolean; onToggle: () => void }) {
  const color = RARITY_COLOR[mat.rarity];
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      className="rounded-xl flex flex-col items-center gap-1 py-2.5 px-1 relative overflow-hidden"
      style={{
        height: 88,
        background: isSelected
          ? `linear-gradient(160deg, ${RARITY_GLOW[mat.rarity]}, rgba(12,5,28,0.92))`
          : 'rgba(12,6,28,0.68)',
        border: `1.5px solid ${isSelected ? color + 'AA' : 'rgba(130,70,200,0.32)'}`,
        boxShadow: isSelected ? `0 0 12px ${RARITY_GLOW[mat.rarity]}` : 'none',
      }}
    >
      <div className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}>
          <span style={{ fontSize: 9, color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</span>
        </div>
      )}
      <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
      <span style={{ fontSize: 20, lineHeight: 1 }}>💎</span>
      <span className="text-[10px] font-black text-center leading-tight max-w-[56px]"
        style={{ color: isSelected ? '#EDE8FF' : 'rgba(195,182,238,0.72)', fontFamily: 'monospace' }}>
        {mat.name}
      </span>
      <span className="text-[10px] font-bold" style={{ color: 'rgba(195,182,238,0.6)', fontFamily: 'monospace' }}>
        ×{mat.quantity}
      </span>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   EnhanceTab
────────────────────────────────────────── */
interface EnhanceTabProps {
  abyssalResidues: AbyssalResidueData[];
  residueMaterials: ResidueMatData[];
  selectedId: string | null;
  onEnhance: (matIds: string[]) => void;
  sound: ReturnType<typeof useGothicSound>;
}
function EnhanceTab({ abyssalResidues, residueMaterials, selectedId, onEnhance, sound }: EnhanceTabProps) {
  const [selectedMatIds, setSelectedMatIds] = useState<Set<string>>(new Set());
  const selectedResidue = abyssalResidues.find(r => r.id === selectedId) ?? null;

  const totalExpGain = useMemo(() =>
    [...selectedMatIds].reduce((acc, id) => {
      const mat = residueMaterials.find(m => m.id === id);
      return acc + (mat ? mat.expValue * mat.quantity : 0);
    }, 0),
    [selectedMatIds, residueMaterials],
  );

  const handleAutoSelect = useCallback(() => {
    if (!selectedResidue) return;
    sound.playTap();
    const needed = selectedResidue.maxExp - selectedResidue.exp;
    let remaining = needed;
    const next = new Set<string>();
    const sorted = [...residueMaterials].sort((a, b) => b.expValue * b.quantity - a.expValue * a.quantity);
    for (const mat of sorted) {
      if (remaining <= 0) break;
      next.add(mat.id);
      remaining -= mat.expValue * mat.quantity;
    }
    setSelectedMatIds(next);
  }, [selectedResidue, residueMaterials, sound]);

  const handleEnhance = () => {
    if (!selectedResidue || selectedMatIds.size === 0) return;
    sound.playEquip();
    onEnhance([...selectedMatIds]);
    setSelectedMatIds(new Set());
  };

  const toggleMat = (id: string) => {
    sound.playTap();
    setSelectedMatIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      key="enhance"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col flex-1 overflow-hidden px-3 pt-2 pb-3 gap-2.5"
    >
      <StatsComparison residue={selectedResidue} expGain={totalExpGain} />

      <EnhanceGauge residue={selectedResidue} previewExpGain={totalExpGain} />

      {/* Materials panel */}
      <div className="gothic-panel rounded-2xl p-3.5 flex flex-col flex-1 overflow-hidden gap-2.5">
        <div className="flex items-center justify-between shrink-0">
          <span className="text-[11px] font-black tracking-[0.22em]"
            style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>
            ✦ 素材を選択
          </span>
          <button
            onClick={handleAutoSelect}
            disabled={!selectedResidue || residueMaterials.length === 0}
            className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-35"
            style={{
              background: 'rgba(160,0,255,0.2)',
              border: '1px solid rgba(180,60,255,0.5)',
              color: '#E080FF',
              fontFamily: 'monospace',
            }}
          >
            <Zap size={11} />
            一括選択
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {residueMaterials.length === 0 ? (
            <div className="flex items-center justify-center h-full opacity-40">
              <span className="text-[12px] italic" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>
                素材がありません
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 content-start">
              {residueMaterials.map(mat => (
                <MaterialCard
                  key={mat.id}
                  mat={mat}
                  isSelected={selectedMatIds.has(mat.id)}
                  onToggle={() => toggleMat(mat.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enhance button */}
      <motion.button
        onClick={handleEnhance}
        whileTap={{ scale: 0.95 }}
        disabled={selectedMatIds.size === 0 || !selectedResidue}
        className="shrink-0 py-4 rounded-2xl text-[14px] font-black tracking-[0.3em] transition-all disabled:opacity-35"
        style={{
          background: 'linear-gradient(135deg, rgba(120,0,220,0.5), rgba(50,0,120,0.65))',
          border: '1.5px solid rgba(160,50,255,0.65)',
          color: '#E080FF',
          boxShadow: '0 0 20px rgba(160,0,255,0.3)',
          fontFamily: 'monospace',
        }}
      >
        強 化
      </motion.button>
    </motion.div>
  );
}

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
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
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
