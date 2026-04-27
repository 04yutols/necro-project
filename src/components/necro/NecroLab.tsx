'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData, SoulShardData } from '../../types/game';
import { soulStoneAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, Home, ChevronDown, ChevronUp, Zap, X } from 'lucide-react';
import { MonsterViewer } from './MonsterViewer';
import { SoulSlotRing } from './SoulSlotRing';
import { useNecroLabPixi } from './useNecroLabPixi';
import { useGothicSound } from './useGothicSound';

/* ─────────────────────────────────
   Stat Row
───────────────────────────────── */
function StatRow({ label, value, max, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-black tracking-[0.15em] w-10 shrink-0" style={{ color: 'rgba(180,160,220,0.6)', fontFamily: 'monospace' }}>
        {label}
      </span>
      {pct !== null ? (
        <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(80,40,120,0.3)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${color}AA, ${color})` }}
          />
        </div>
      ) : null}
      <span className="text-[9px] font-black w-8 text-right shrink-0" style={{ color, fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────
   Confirm Soul Stone Modal
───────────────────────────────── */
function ConfirmModal({ monsterName, onConfirm, onCancel }: { monsterName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="gothic-panel mx-4 p-6 rounded-2xl max-w-xs w-full flex flex-col gap-4"
        style={{ borderColor: 'rgba(255,50,50,0.5)', boxShadow: '0 0 40px rgba(180,0,0,0.4)' }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Skull size={28} style={{ color: '#FF6B6B' }} />
          <span className="text-sm font-black tracking-wider" style={{ color: '#FF8888', fontFamily: "'Cinzel Decorative', serif" }}>
            魂石化
          </span>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(200,180,255,0.7)' }}>
            <strong style={{ color: '#FF8888' }}>{monsterName}</strong> を魂石に変換します。<br />
            この操作は元に戻せません。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all active:scale-95"
            style={{ background: 'rgba(20,10,40,0.8)', border: '1px solid rgba(80,60,100,0.5)', color: '#888' }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all active:scale-95"
            style={{ background: 'rgba(120,0,0,0.4)', border: '1px solid rgba(255,50,50,0.6)', color: '#FF8888', boxShadow: '0 0 12px rgba(180,0,0,0.3)' }}
          >
            EXTRACT
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────
   Shard Picker Drawer
───────────────────────────────── */
interface ShardPickerProps {
  shards: SoulShardData[];
  onPick: (shard: SoulShardData) => void;
  onClose: () => void;
  currentShardId?: string;
}
function ShardPickerDrawer({ shards, onPick, onClose, currentShardId }: ShardPickerProps) {
  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute inset-x-0 bottom-0 z-50 gothic-panel rounded-t-2xl flex flex-col"
      style={{ maxHeight: '55%', borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}
    >
      {/* Handle bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(139,0,255,0.2)' }}>
        <span className="text-[10px] font-black tracking-[0.2em]" style={{ color: 'rgba(139,0,255,0.7)', fontFamily: 'monospace' }}>
          ✦ 魂石を選択
        </span>
        <button onClick={onClose} className="opacity-50 hover:opacity-80 transition-opacity">
          <X size={16} style={{ color: '#888' }} />
        </button>
      </div>

      {/* Shard list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 flex flex-col gap-2">
        {shards.length === 0 ? (
          <div className="text-center py-8 text-[10px] italic" style={{ color: 'rgba(139,0,255,0.4)' }}>
            魂石が存在しない。モンスターを魂石化せよ。
          </div>
        ) : (
          shards.map(shard => (
            <motion.button
              key={shard.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(shard)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
              style={{
                background: shard.id === currentShardId
                  ? 'linear-gradient(135deg, rgba(80,0,180,0.4), rgba(30,0,80,0.6))'
                  : 'rgba(12,6,26,0.7)',
                border: `1px solid ${shard.id === currentShardId ? 'rgba(188,0,251,0.6)' : 'rgba(80,40,120,0.3)'}`,
                boxShadow: shard.id === currentShardId ? '0 0 10px rgba(139,0,255,0.3)' : 'none',
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(139,0,255,0.2)', border: '1px solid rgba(139,0,255,0.4)' }}
              >
                <Sparkles size={14} style={{ color: '#D580FF' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black" style={{ color: '#E8E0FF', fontFamily: 'monospace' }}>
                  {shard.originMonsterName}の欠片
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: 'rgba(188,0,251,0.7)' }}>
                  ATK +{shard.effect.atkBonus}  MATK +{shard.effect.matkBonus}
                </div>
              </div>
              {shard.id === currentShardId && (
                <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,0,255,0.3)', color: '#D580FF', border: '1px solid rgba(188,0,251,0.5)' }}>
                  装備中
                </span>
              )}
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════
   MAIN: NecroLab
═══════════════════════════════════ */
export default function NecroLab() {
  const {
    player, necroStatus, party, inventoryMonsters, soulShards,
    updatePartySlot, removeMonster, addSoulShard, equipShard, setCurrentTab,
  } = useGameStore();

  const sound = useGothicSound();

  // PixiJS backdrop
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const { getHandle } = useNecroLabPixi({ canvasContainer: pixiContainerRef });

  // Monster selection
  const [selectedId, setSelectedId] = useState<string | null>(
    inventoryMonsters[0]?.id || null
  );
  const selectedMonster = inventoryMonsters.find(m => m.id === selectedId) || null;
  const viewerRef = useRef<HTMLDivElement>(null);

  // Soul slot refs for chain animation
  const slotRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ] as const;

  // Active slot for picking shard
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [showShardPicker, setShowShardPicker] = useState(false);

  // Expanded stats panel
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Soul stone confirm
  const [confirmMonster, setConfirmMonster] = useState<MonsterData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalCost = useMemo(() => party.reduce((acc, m) => acc + (m?.cost || 0), 0), [party]);
  const isOverCost = necroStatus ? totalCost > necroStatus.maxCost : false;

  const getEffectiveStats = useCallback((monster: MonsterData) => {
    const shard = soulShards.find(s => s.id === monster.equippedShardId);
    return {
      atk: monster.stats.atk + (shard?.effect.atkBonus || 0),
      matk: monster.stats.matk + (shard?.effect.matkBonus || 0),
    };
  }, [soulShards]);

  // Monster selection with smoke transition
  const selectMonster = (id: string) => {
    if (id === selectedId) return;
    sound.playTap();
    setSelectedId(id);
  };

  // Soul slot tap → open shard picker
  const handleSlotTap = (slotIdx: number) => {
    if (!selectedMonster) return;
    sound.playOpen();
    setActiveSlot(slotIdx);
    setShowShardPicker(true);
  };

  // Equip shard with chain animation
  const handlePickShard = async (shard: SoulShardData) => {
    if (!selectedMonster) return;
    sound.playEquip();
    setShowShardPicker(false);

    // Soul chain animation: from shard picker area (bottom) to the active slot
    const handle = getHandle();
    if (handle && activeSlot !== null && slotRefs[activeSlot].current && viewerRef.current) {
      const slotRect = slotRefs[activeSlot].current!.getBoundingClientRect();
      const containerRect = pixiContainerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const fromX = containerRect.width / 2;
        const fromY = containerRect.height * 0.85;
        const toX = slotRect.left - containerRect.left + slotRect.width / 2;
        const toY = slotRect.top - containerRect.top + slotRect.height / 2;
        handle.spawnSoulChain(fromX, fromY, toX, toY);
      }
    }

    // Actually equip
    try {
      equipShard(selectedMonster.id, shard.id);
    } catch (e) {
      console.error(e);
    }
    setActiveSlot(null);
  };

  // Soul stone extraction
  const handleSoulStone = async () => {
    if (!confirmMonster) return;
    setIsProcessing(true);
    setConfirmMonster(null);
    sound.playTap();
    try {
      const result = await soulStoneAction(confirmMonster.id);
      if (result.success && result.data) {
        removeMonster(confirmMonster.id);
        addSoulShard(result.data as any);
        if (selectedId === confirmMonster.id) {
          setSelectedId(inventoryMonsters.find(m => m.id !== confirmMonster.id)?.id || null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Deploy monster to party
  const handleDeploy = (monster: MonsterData) => {
    if (isOverCost && !party.some(p => p?.id === monster.id)) return;
    sound.playTap();
    const emptyIndex = party.findIndex(p => p === null);
    if (emptyIndex !== -1) updatePartySlot(emptyIndex, monster);
  };

  // Build slot data for ring (just slot 0 = equipped shard, rest null for now)
  const slotData: (SoulShardData | null)[] = useMemo(() => {
    if (!selectedMonster) return [null, null, null];
    const equipped = soulShards.find(s => s.id === selectedMonster.equippedShardId) || null;
    return [equipped, null, null];
  }, [selectedMonster, soulShards]);

  if (!necroStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] font-black tracking-widest animate-pulse" style={{ color: '#FF4444', fontFamily: 'monospace' }}>
          UNAUTHORIZED ACCESS
        </span>
      </div>
    );
  }

  const effectiveStats = selectedMonster ? getEffectiveStats(selectedMonster) : null;

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(180deg, #06030E 0%, #0A0420 50%, #04020C 100%)' }}
    >
      {/* ── PixiJS Backdrop (bubbles + magic circle) ── */}
      <div
        ref={pixiContainerRef}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ opacity: 0.55 }}
      />

      {/* Corner ornaments */}
      <div className="absolute top-0 left-0 w-24 h-24 pointer-events-none z-1"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(139,0,255,0.18) 0%, transparent 70%)' }} />
      <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none z-1"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(139,0,255,0.12) 0%, transparent 70%)' }} />

      {/* ─────────────────────────────
          MAIN SCROLLABLE CONTENT
      ───────────────────────────── */}
      <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar">

        {/* ── Header ── */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5 gothic-panel"
          style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
        >
          <button
            onClick={() => { sound.playTap(); setCurrentTab('HOME'); }}
            className="flex items-center gap-1.5 transition-all active:scale-95"
            style={{ color: 'rgba(139,0,255,0.6)' }}
          >
            <Home size={13} />
            <span className="text-[9px] font-black tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>HUB</span>
          </button>

          <span
            className="text-[11px] font-black tracking-[0.35em] uppercase"
            style={{ color: '#D580FF', fontFamily: "'Cinzel Decorative', serif", textShadow: '0 0 14px rgba(188,0,251,0.5)' }}
          >
            NECRO-LAB
          </span>

          <div
            className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full ${isOverCost ? 'anim-demon' : 'anim-void-pulse'}`}
            style={{
              background: isOverCost ? 'rgba(120,0,0,0.3)' : 'rgba(139,0,255,0.1)',
              border: `1px solid ${isOverCost ? 'rgba(255,50,50,0.6)' : 'rgba(139,0,255,0.4)'}`,
              color: isOverCost ? '#FF6B6B' : 'rgba(188,0,251,0.8)',
              fontFamily: 'monospace',
            }}
          >
            <Ghost size={10} />
            {totalCost}/{necroStatus.maxCost}
          </div>
        </div>

        {/* ── Monster Viewer + Soul Slot Ring ── */}
        <div
          className="shrink-0 gothic-panel mx-3 mt-3 rounded-2xl relative flex flex-col items-center pt-4 pb-3"
          style={{ minHeight: '340px' }}
        >
          {/* Lab rank badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <span className="text-[8px] font-black tracking-[0.2em]" style={{ color: 'rgba(212,175,55,0.7)', fontFamily: 'monospace' }}>
              RANK {necroStatus.rank} · Lv{necroStatus.level}
            </span>
          </div>

          <MonsterViewer
            monster={selectedMonster}
            pixiHandle={getHandle()}
            viewerRef={viewerRef}
          />

          <SoulSlotRing
            slots={slotData}
            onSlotTap={handleSlotTap}
            slotRefs={[slotRefs[0], slotRefs[1], slotRefs[2]]}
            activeSlot={activeSlot}
          />

          {/* Stats (collapsible) */}
          {selectedMonster && (
            <div className="w-full px-4 mt-2">
              <button
                onClick={() => { sound.vibratePulse(); setStatsExpanded(v => !v); }}
                className="w-full flex items-center justify-between py-1.5 transition-all"
                style={{ borderTop: '1px solid rgba(139,0,255,0.15)' }}
              >
                <span className="text-[8px] font-black tracking-[0.2em]" style={{ color: 'rgba(139,0,255,0.55)', fontFamily: 'monospace' }}>
                  SPIRIT PARAMETERS
                </span>
                {statsExpanded ? <ChevronUp size={12} style={{ color: 'rgba(139,0,255,0.5)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(139,0,255,0.5)' }} />}
              </button>
              <AnimatePresence>
                {statsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-1.5 pb-2 pt-1">
                      <StatRow label="HP" value={selectedMonster.stats.hp} max={200} color="#FF5555" />
                      <StatRow label="ATK" value={effectiveStats!.atk} max={100} color="#F9A825" />
                      <StatRow label="DEF" value={selectedMonster.stats.def} max={80} color="#66BB6A" />
                      <StatRow label="MATK" value={effectiveStats!.matk} max={100} color="#888EF7" />
                      <StatRow label="AGI" value={selectedMonster.stats.agi} max={50} color="#00DDFF" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Soul chain picker drawer */}
          <AnimatePresence>
            {showShardPicker && (
              <ShardPickerDrawer
                shards={soulShards}
                onPick={handlePickShard}
                onClose={() => { setShowShardPicker(false); setActiveSlot(null); }}
                currentShardId={selectedMonster?.equippedShardId}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Active Party (3 slots) ── */}
        <div className="gothic-panel mx-3 mt-3 rounded-2xl shrink-0" style={{ padding: '12px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black tracking-[0.2em]" style={{ color: 'rgba(139,0,255,0.6)', fontFamily: 'monospace' }}>
              ⚡ ACTIVE LEGION
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {party.map((m, i) => (
              <button
                key={i}
                onClick={() => { sound.playTap(); updatePartySlot(i, null); }}
                className="h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 relative overflow-hidden transition-all active:scale-95 group"
                style={{
                  background: m
                    ? 'linear-gradient(135deg, rgba(60,0,130,0.4), rgba(20,0,60,0.7))'
                    : 'rgba(8,4,18,0.6)',
                  border: `1px solid ${m ? 'rgba(139,0,255,0.45)' : 'rgba(60,30,90,0.35)'}`,
                  borderStyle: m ? 'solid' : 'dashed',
                  boxShadow: m ? '0 0 10px rgba(139,0,255,0.15)' : 'none',
                }}
              >
                {m ? (
                  <>
                    <span className="text-base leading-none">
                      {m.tribe === 'UNDEAD' ? '💀' : m.tribe === 'DEMON' ? '😈' : m.tribe === 'BEAST' ? '🐺' : '👹'}
                    </span>
                    <span className="text-[7px] font-black truncate max-w-[52px]" style={{ color: '#C8B0FF', fontFamily: 'monospace' }}>
                      {m.name}
                    </span>
                    <div
                      className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(120,0,0,0.75)' }}
                    >
                      <span className="text-[7px] font-black" style={{ color: '#FF8888' }}>DISMISS</span>
                    </div>
                  </>
                ) : (
                  <span className="text-[8px] font-black" style={{ color: 'rgba(80,40,120,0.5)', fontFamily: 'monospace' }}>EMPTY</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Captured Spirits List ── */}
        <div className="gothic-panel mx-3 mt-3 mb-4 rounded-2xl flex-1" style={{ padding: '12px' }}>
          <span className="text-[9px] font-black tracking-[0.2em] block mb-2" style={{ color: 'rgba(139,0,255,0.6)', fontFamily: 'monospace' }}>
            ☠ CAPTURED SPIRITS
          </span>
          <div className="flex flex-col gap-1.5">
            {inventoryMonsters.length === 0 && (
              <div className="text-center py-8 text-[10px] italic" style={{ color: 'rgba(139,0,255,0.3)' }}>
                Void is empty.
              </div>
            )}
            {inventoryMonsters.map(m => {
              const stats = getEffectiveStats(m);
              const isSelected = m.id === selectedId;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(80,0,180,0.35), rgba(30,0,80,0.55))'
                      : 'rgba(8,4,18,0.5)',
                    border: `1px solid ${isSelected ? 'rgba(139,0,255,0.5)' : 'rgba(60,30,90,0.25)'}`,
                    boxShadow: isSelected ? '0 0 12px rgba(139,0,255,0.15)' : 'none',
                  }}
                  onClick={() => selectMonster(m.id)}
                >
                  {/* Sprite mini */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{
                      background: isSelected ? 'rgba(100,0,200,0.3)' : 'rgba(20,10,40,0.5)',
                      border: `1px solid ${isSelected ? 'rgba(188,0,251,0.4)' : 'rgba(60,30,90,0.35)'}`,
                    }}
                  >
                    {m.tribe === 'UNDEAD' ? '💀' : m.tribe === 'DEMON' ? '😈' : m.tribe === 'BEAST' ? '🐺' : '👹'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black truncate" style={{ color: isSelected ? '#E8E0FF' : '#A090C0', fontFamily: 'monospace' }}>
                        {m.name}
                      </span>
                      <span
                        className="text-[7px] font-black px-1 py-0.5 rounded shrink-0"
                        style={{ background: 'rgba(139,0,255,0.15)', border: '1px solid rgba(80,40,120,0.4)', color: 'rgba(188,0,251,0.7)' }}
                      >
                        C{m.cost}
                      </span>
                      {m.equippedShardId && (
                        <Sparkles size={9} style={{ color: '#D580FF', flexShrink: 0 }} />
                      )}
                    </div>
                    <span className="text-[8px]" style={{ color: 'rgba(180,160,220,0.5)', fontFamily: 'monospace' }}>
                      ATK {stats.atk} · DEF {m.stats.def} · HP {m.stats.hp}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); sound.playTap(); handleDeploy(m); }}
                      className="px-2 py-1 rounded-lg text-[7px] font-black transition-all active:scale-90"
                      style={{
                        background: 'rgba(0,60,120,0.4)',
                        border: '1px solid rgba(0,200,255,0.35)',
                        color: '#00DDFF',
                        fontFamily: 'monospace',
                      }}
                    >
                      DEPLOY
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); sound.playTap(); setConfirmMonster(m); }}
                      disabled={isProcessing}
                      className="p-1.5 rounded-lg transition-all active:scale-90 disabled:opacity-30"
                      style={{ background: 'rgba(80,0,0,0.4)', border: '1px solid rgba(180,0,0,0.4)' }}
                    >
                      <Skull size={11} style={{ color: '#FF6B6B' }} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Confirm Soul Stone Modal ── */}
      <AnimatePresence>
        {confirmMonster && (
          <ConfirmModal
            monsterName={confirmMonster.name}
            onConfirm={handleSoulStone}
            onCancel={() => setConfirmMonster(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
