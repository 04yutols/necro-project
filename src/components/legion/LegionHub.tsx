'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Swords, Shield, Gem, Zap, Plus, Sparkles, ChevronRight } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useGothicSound } from '../necro/useGothicSound';
import { CharacterData, MonsterData, ItemData, AbyssalResidueData, SoulShardData, ResidueMatData } from '../../types/game';

/* ──────────────────────────────────────────
   HAPTIC
────────────────────────────────────────── */
function haptic(pattern: VibratePattern) {
  if (typeof navigator !== 'undefined') navigator.vibrate?.(pattern);
}

/* ──────────────────────────────────────────
   THEME / CONF
────────────────────────────────────────── */
type MemberKey = 'PLAYER' | 'MONSTER_0' | 'MONSTER_1' | 'MONSTER_2';
const MEMBER_KEYS: MemberKey[] = ['PLAYER', 'MONSTER_0', 'MONSTER_1', 'MONSTER_2'];

interface Conf { color: string; glow: string; darkBg: string; emoji: string; label: string; particle: string; accent: string }

const TRIBE: Record<string, Conf> = {
  UNDEAD:   { color: '#B09FF8', glow: 'rgba(176,159,248,0.45)', darkBg: 'rgba(12,6,42,0.97)',  emoji: '💀', label: 'UNDEAD',   particle: 'rgba(176,159,248,0.6)', accent: '#c4baff' },
  DEMON:    { color: '#FF7878', glow: 'rgba(255,120,120,0.45)', darkBg: 'rgba(42,8,8,0.97)',   emoji: '😈', label: 'DEMON',    particle: 'rgba(255,120,120,0.6)', accent: '#ffa0a0' },
  BEAST:    { color: '#FBBB30', glow: 'rgba(251,187,48,0.45)',  darkBg: 'rgba(42,28,4,0.97)',  emoji: '🐺', label: 'BEAST',    particle: 'rgba(251,187,48,0.6)',  accent: '#fcd060' },
  HUMANOID: { color: '#78C97C', glow: 'rgba(120,201,124,0.45)', darkBg: 'rgba(4,30,8,0.97)',   emoji: '👹', label: 'HUMANOID', particle: 'rgba(120,201,124,0.6)', accent: '#9adaa0' },
};
const JOB: Record<string, Conf> = {
  warrior:     { color: '#FF9955', glow: 'rgba(255,153,85,0.45)',  darkBg: 'rgba(42,18,4,0.97)',  emoji: '⚔️', label: 'WARRIOR',     particle: 'rgba(255,153,85,0.6)',  accent: '#ffb878' },
  mage:        { color: '#5599FF', glow: 'rgba(85,153,255,0.45)',  darkBg: 'rgba(4,16,52,0.97)',  emoji: '🔮', label: 'MAGE',        particle: 'rgba(85,153,255,0.6)',  accent: '#7db0ff' },
  dark_mage:   { color: '#BB55FF', glow: 'rgba(187,85,255,0.45)',  darkBg: 'rgba(20,4,52,0.97)',  emoji: '🌑', label: 'DARK MAGE',   particle: 'rgba(187,85,255,0.6)',  accent: '#cc80ff' },
  thief:       { color: '#55FFBB', glow: 'rgba(85,255,187,0.45)',  darkBg: 'rgba(4,40,24,0.97)',  emoji: '🗝️', label: 'THIEF',       particle: 'rgba(85,255,187,0.6)',  accent: '#80ffd0' },
  necromancer: { color: '#DD22FF', glow: 'rgba(221,34,255,0.45)',  darkBg: 'rgba(22,0,50,0.97)',  emoji: '💀', label: 'NECROMANCER', particle: 'rgba(221,34,255,0.6)',  accent: '#ee66ff' },
};
const DEFAULT_CONF: Conf = { color: '#CC22FF', glow: 'rgba(204,34,255,0.4)', darkBg: 'rgba(16,0,44,0.97)', emoji: '🌟', label: '???', particle: 'rgba(204,34,255,0.6)', accent: '#dd66ff' };
const VACANT_CONF:  Conf = { color: 'rgba(120,80,200,0.6)', glow: 'rgba(100,50,180,0.15)', darkBg: 'rgba(8,4,18,0.97)', emoji: '+', label: 'VACANT', particle: 'rgba(120,80,200,0.35)', accent: 'rgba(160,110,230,0.6)' };

function getConf(mk: MemberKey, player: CharacterData | null, party: (MonsterData | null)[]): Conf {
  if (mk === 'PLAYER') return JOB[player?.currentJobId ?? ''] ?? DEFAULT_CONF;
  const i = parseInt(mk.replace('MONSTER_', ''));
  const m = party[i];
  return m ? (TRIBE[m.tribe] ?? TRIBE.HUMANOID) : VACANT_CONF;
}

const RARITY_COLOR: Record<string, string> = { COMMON: '#99AABC', RARE: '#55AAFF', EPIC: '#CC22FF', UNIQUE: '#FBBB30' };
const RARITY_GLOW:  Record<string, string> = { COMMON: 'rgba(153,170,188,0.32)', RARE: 'rgba(85,170,255,0.38)', EPIC: 'rgba(204,34,255,0.48)', UNIQUE: 'rgba(251,187,48,0.38)' };

/* ──────────────────────────────────────────
   INLINED FROM NecroLab — stat formatting
────────────────────────────────────────── */
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
   MEMBER INFO
────────────────────────────────────────── */
interface MemberInfo {
  name: string; nameEn: string; sub: string; rank: string;
  lvl: number | null; cost: number | null;
  stats: CharacterData['stats'] | null;
  weapon: ItemData | null; armor: ItemData | null; acc: ItemData | null;
  residues: (AbyssalResidueData | null)[];
  isVacant: boolean; isPlayer: boolean;
}

function getMemberInfo(
  mk: MemberKey, player: CharacterData | null, party: (MonsterData | null)[],
  equippedResidueSlots: (AbyssalResidueData | null)[], soulShards: SoulShardData[],
): MemberInfo {
  if (mk === 'PLAYER') {
    return {
      name: player?.name ?? '—',
      nameEn: (player?.name ?? 'HERO').toUpperCase(),
      sub: (JOB[player?.currentJobId ?? ''] ?? DEFAULT_CONF).label,
      rank: 'SSR',
      lvl: player?.jobs.find(j => j.jobId === player?.currentJobId)?.level ?? 1,
      cost: null,
      stats: player?.stats ?? null,
      weapon: player?.equipment.weapon ?? null,
      armor: player?.equipment.body ?? null,
      acc: player?.equipment.acc1 ?? null,
      residues: equippedResidueSlots,
      isVacant: false, isPlayer: true,
    };
  }
  const i = parseInt(mk.replace('MONSTER_', ''));
  const m = party[i] ?? null;
  if (!m) return { name: 'VACANT', nameEn: 'VACANT', sub: 'EMPTY', rank: '—', lvl: null, cost: null, stats: null, weapon: null, armor: null, acc: null, residues: [null, null, null], isVacant: true, isPlayer: false };
  const fake: AbyssalResidueData | null = (() => {
    if (!m.equippedShardId) return null;
    const s = soulShards.find((x: SoulShardData) => x.id === m.equippedShardId);
    return s ? { id: s.id, name: `${s.originMonsterName}の魂`, itemId: s.id, rarity: 'RARE', mainStat: { type: 'ATK_FLAT', value: s.effect.atkBonus }, subOptions: [{ type: 'MATK_FLAT', value: s.effect.matkBonus }], level: 1, exp: 0, maxExp: 800 } : null;
  })();
  return {
    name: m.name, nameEn: m.name.toUpperCase(), sub: (TRIBE[m.tribe] ?? TRIBE.HUMANOID).label, rank: 'SR',
    lvl: null, cost: m.cost,
    stats: m.stats as CharacterData['stats'],
    weapon: null, armor: null, acc: null,
    residues: [fake, null, null],
    isVacant: false, isPlayer: false,
  };
}

/* ──────────────────────────────────────────
   CANVAS BACKGROUND HOOK
────────────────────────────────────────── */
function useCanvasBg(canvasRef: React.RefObject<HTMLCanvasElement | null>, color: string, isDemonMode: boolean) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const c = isDemonMode ? '#CC2222' : color;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 0.4 + 0.1),
      alpha: Math.random() * 0.55 + 0.1,
      life: Math.random(),
      speed: Math.random() * 0.004 + 0.001,
    }));
    const bokeh = Array.from({ length: 12 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 50 + 15,
      alpha: Math.random() * 0.07 + 0.02,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
    }));

    let af: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const grad = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.4, 0, canvas.width * 0.5, canvas.height * 0.4, canvas.height * 0.7);
      grad.addColorStop(0, isDemonMode ? '#1a0205' : '#12082a');
      grad.addColorStop(0.5, isDemonMode ? '#0f0106' : '#0a0515');
      grad.addColorStop(1, '#03020a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      bokeh.forEach(b => {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.x = canvas.width + b.r;
        if (b.x > canvas.width + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = canvas.height + b.r;
        if (b.y > canvas.height + b.r) b.y = -b.r;
        const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        bg.addColorStop(0, c + '40'); bg.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = bg; ctx.globalAlpha = b.alpha; ctx.fill(); ctx.globalAlpha = 1;
      });
      particles.forEach(p => {
        p.life += p.speed;
        if (p.life > 1) { p.life = 0; p.x = Math.random() * canvas.width; p.y = canvas.height + 10; p.alpha = Math.random() * 0.55 + 0.1; }
        p.x += p.vx; p.y += p.vy;
        const a = p.alpha * Math.sin(p.life * Math.PI);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1;
      });
      af = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(af);
  }, [color, isDemonMode]);
}

/* ──────────────────────────────────────────
   FLOATING ORBS
────────────────────────────────────────── */
function FloatingOrbs({ color }: { color: string }) {
  const orbs = [
    { size: 6, top: '20%', left: '8%', delay: '0s', dur: '3.5s' },
    { size: 4, top: '35%', right: '6%', delay: '1.2s', dur: '4s' },
    { size: 8, top: '58%', left: '5%', delay: '0.6s', dur: '5s' },
    { size: 5, top: '72%', right: '8%', delay: '2s', dur: '3s' },
    { size: 3, top: '15%', right: '16%', delay: '1.8s', dur: '4.5s' },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {orbs.map((o, i) => (
        <div key={i} style={{
          position: 'absolute', top: o.top, left: (o as any).left, right: (o as any).right,
          width: o.size, height: o.size, borderRadius: '50%',
          background: color, boxShadow: `0 0 ${o.size * 3}px ${color}`,
          animation: `orbFloat ${o.dur} ease-in-out infinite`,
          animationDelay: o.delay,
        }} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   SCAN LINE
────────────────────────────────────────── */
function ScanLine({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div style={{
        position: 'absolute', width: '100%', height: 2,
        background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        animation: 'scanLine 6s ease-in-out infinite 2s',
      }} />
    </div>
  );
}

/* ──────────────────────────────────────────
   PARTICLES (for list cards)
────────────────────────────────────────── */
interface Pt { id: number; x: number; y: number; size: number; delay: number; dur: number; dy: number; opacity: number }
function useParticles(n: number): Pt[] {
  return useMemo(() => Array.from({ length: n }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 3.5 + 1.5, delay: Math.random() * 4,
    dur: 3 + Math.random() * 3, dy: -(28 + Math.random() * 45),
    opacity: 0.4 + Math.random() * 0.5,
  })), [n]);
}
function Particles({ color, n = 12 }: { color: string; n?: number }) {
  const pts = useParticles(n);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pts.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: color, filter: 'blur(0.5px)' }}
          animate={{ y: [0, p.dy, 0], opacity: [0, p.opacity, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────
   HEX SLOT — ported from sample
────────────────────────────────────────── */
interface HexSlotData {
  id: string; icon: string; label: string; sublabel: string;
  filled: boolean; level?: number | null; rarity?: string | null; locked?: boolean;
}
function HexSlot({ slot, selected, onSelect, color, delay = 0, isVoid = false }: {
  slot: HexSlotData; selected: string | null; onSelect: (id: string | null) => void;
  color: string; delay?: number; isVoid?: boolean;
}) {
  const isSelected = selected === slot.id;
  return (
    <div
      onClick={() => !slot.locked && onSelect(isSelected ? null : slot.id)}
      style={{
        animation: `slotReveal 0.4s ease-out ${delay}s both`,
        cursor: slot.locked ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 9px',
        background: isSelected
          ? `linear-gradient(135deg, ${color}25, ${color}15)`
          : slot.filled
          ? 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: `1px solid ${isSelected ? color : slot.filled ? color + '55' : color + '28'}`,
        borderRadius: 10,
        boxShadow: isSelected ? `0 0 14px ${color}55, inset 0 0 8px ${color}18` : slot.filled ? `0 0 6px ${color}25` : 'none',
        transition: 'all 0.22s ease',
        backdropFilter: 'blur(8px)',
        position: 'relative', overflow: 'hidden',
        opacity: slot.locked ? 0.35 : 1,
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', pointerEvents: 'none',
        }} />
      )}
      <div style={{
        width: 32, height: 32, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: slot.filled ? `${color}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${slot.filled ? color + '55' : color + '18'}`,
        borderRadius: 8, fontSize: 14, position: 'relative',
      }}>
        {slot.locked ? '🔒' : slot.filled ? slot.icon : <span style={{ color: color + '50', fontSize: 13 }}>＋</span>}
        {slot.filled && isVoid && !slot.locked && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: `radial-gradient(circle, ${color}28, transparent)`, animation: 'void-pulse 2s ease-in-out infinite' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600, color: slot.filled ? '#e2d8f0' : '#5a4f6e', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slot.locked ? 'LOCKED' : slot.label}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: slot.filled ? '#9b7fc0' : '#3a2a4a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.locked ? '—' : slot.sublabel}
        </div>
      </div>
      {slot.filled && slot.level != null && !slot.locked && (
        <div style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color, background: `${color}18`, padding: '2px 5px', borderRadius: 4, border: `1px solid ${color}38`, flexShrink: 0 }}>
          Lv.{slot.level}
        </div>
      )}
      {isVoid && !slot.filled && !slot.locked && (
        <div style={{ width: 20, height: 20, flexShrink: 0, borderRadius: '50%', border: `1px dashed ${color}38`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: `${color}28` }} />
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   STAT ITEM — ported from sample
────────────────────────────────────────── */
function StatItem({ label, labelJa, value, color, delay = 0 }: { label: string; labelJa: string; value: number; color: string; delay?: number }) {
  return (
    <div style={{ animation: `fadeSlideUp 0.5s ease-out ${delay}s both`, textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: '#f5f0ff', textShadow: `0 0 18px ${color}80`, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 400, color: '#8b7da8', marginTop: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 7, color: color + '70', marginTop: 1 }}>
        {labelJa}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   RESIDUE ICON — inlined from NecroLab
────────────────────────────────────────── */
function ResidueIcon({ rarity, size = 36 }: { rarity: string; size?: number }) {
  const c = RARITY_COLOR[rarity] ?? RARITY_COLOR.COMMON;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <polygon points="15,3 29,3 41,15 41,29 29,41 15,41 3,29 3,15" fill={`${c}28`} stroke={c} strokeWidth="1.5" />
      {rarity === 'EPIC' && (<><polygon points="22,10 24.5,18 33,18 26.5,23 29,31 22,26 15,31 17.5,23 11,18 19.5,18" fill={`${c}44`} stroke={c} strokeWidth="0.7" /><circle cx="22" cy="22" r="3" fill={c} opacity="0.9" /></>)}
      {rarity === 'RARE' && (<><circle cx="22" cy="22" r="7" fill={`${c}38`} stroke={c} strokeWidth="0.8" /><circle cx="22" cy="22" r="2.5" fill={c} opacity="0.85" /></>)}
      {(rarity === 'COMMON' || rarity === 'UNIQUE') && <circle cx="22" cy="22" r="4" fill={`${c}60`} stroke={c} strokeWidth="0.8" />}
    </svg>
  );
}

/* ──────────────────────────────────────────
   RESIDUE GRID CARD — inlined from NecroLab
────────────────────────────────────────── */
const GRID_ITEM_H = 100;
const GRID_COLS = 3;
const GRID_GAP = 8;
const ROW_H = GRID_ITEM_H + GRID_GAP;

function ResidueGridCard({ residue, isSelected, isEquipped, onSelect }: { residue: AbyssalResidueData; isSelected: boolean; isEquipped: boolean; onSelect: () => void }) {
  const color = RARITY_COLOR[residue.rarity];
  return (
    <motion.button onClick={onSelect} whileTap={{ scale: 0.91 }}
      className="rounded-xl flex flex-col items-center gap-1 py-2 px-1.5 relative overflow-hidden"
      style={{ height: GRID_ITEM_H, background: isSelected ? `linear-gradient(160deg, ${RARITY_GLOW[residue.rarity]}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.7)', border: `1.5px solid ${isSelected ? color + 'BB' : 'rgba(130,70,200,0.35)'}`, boxShadow: isSelected ? `0 0 14px ${RARITY_GLOW[residue.rarity]}` : 'none' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)' }} />
      {isEquipped && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#00DD77', boxShadow: '0 0 5px #00DD77' }} />}
      <ResidueIcon rarity={residue.rarity} size={28} />
      <span className="text-[11px] font-black" style={{ color, fontFamily: 'monospace' }}>{formatStat(residue.mainStat.type, residue.mainStat.value)}</span>
      <span className="text-[9px] truncate max-w-full px-0.5 text-center leading-tight" style={{ color: 'rgba(195,182,238,0.78)', fontFamily: 'monospace' }}>{residue.name}</span>
      <span className="text-[9px]" style={{ color: 'rgba(195,182,238,0.55)', fontFamily: 'monospace' }}>Lv.{residue.level}</span>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   VIRTUAL RESIDUE GRID — inlined from NecroLab
────────────────────────────────────────── */
function VirtualResidueGrid({ items, selectedId, equippedIds, onSelect }: { items: AbyssalResidueData[]; selectedId: string | null; equippedIds: Set<string>; onSelect: (id: string) => void }) {
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
    <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar" onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetTop, left: GRID_GAP, right: GRID_GAP, display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: GRID_GAP }}>
          {visibleItems.map(r => (
            <ResidueGridCard key={r.id} residue={r} isSelected={r.id === selectedId} isEquipped={equippedIds.has(r.id)} onSelect={() => onSelect(r.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   ITEM GRID (weapon / armor / acc)
────────────────────────────────────────── */
function ItemGridCard({ item, isSelected, isEquipped, onSelect }: { item: ItemData; isSelected: boolean; isEquipped: boolean; onSelect: () => void }) {
  const color = RARITY_COLOR[(item as any).rarity] ?? RARITY_COLOR.COMMON;
  return (
    <motion.button onClick={onSelect} whileTap={{ scale: 0.92 }}
      className="rounded-xl flex flex-col items-center gap-1.5 py-3 px-2 relative overflow-hidden"
      style={{ height: 104, background: isSelected ? `linear-gradient(160deg, ${RARITY_GLOW[(item as any).rarity] ?? RARITY_GLOW.COMMON}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.7)', border: `1.5px solid ${isSelected ? color + 'BB' : 'rgba(130,70,200,0.35)'}`, boxShadow: isSelected ? `0 0 14px ${RARITY_GLOW[(item as any).rarity] ?? RARITY_GLOW.COMMON}` : 'none' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)' }} />
      {isEquipped && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#00DD77', boxShadow: '0 0 5px #00DD77' }} />}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}44` }}>
        <Swords size={16} style={{ color }} />
      </div>
      <span className="text-[10px] font-black text-center leading-tight max-w-full px-1 truncate" style={{ color: '#EDE8FF', fontFamily: 'monospace' }}>{(item as any).name}</span>
      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: `${color}22`, border: `1px solid ${color}44`, color }}>{(item as any).rarity}</span>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   STATS COMPARISON — inlined from NecroLab
────────────────────────────────────────── */
function StatsComparison({ residue, expGain }: { residue: AbyssalResidueData | null; expGain: number }) {
  if (!residue) return (
    <div className="gothic-panel rounded-2xl p-4 shrink-0 flex items-center justify-center opacity-35" style={{ height: 110 }}>
      <span className="text-[11px] tracking-widest font-bold" style={{ color: 'rgba(180,100,255,0.75)', fontFamily: 'monospace' }}>SELECT RESIDUE</span>
    </div>
  );
  let newExp = residue.exp + expGain, newLevel = residue.level, newMaxExp = residue.maxExp, levelledUp = false;
  while (newExp >= newMaxExp && newLevel < 20) { newExp -= newMaxExp; newLevel++; newMaxExp = Math.floor(newMaxExp * 1.5); levelledUp = true; }
  if (newLevel >= 20) newExp = Math.min(newExp, newMaxExp);
  const newMainValue = levelledUp ? +(residue.mainStat.value * (1 + newLevel * 0.04)).toFixed(1) : residue.mainStat.value;
  const color = RARITY_COLOR[residue.rarity];
  return (
    <div className="gothic-panel rounded-2xl p-3.5 shrink-0">
      <span className="text-[10px] font-black tracking-[0.22em] block mb-2.5" style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>STAT PREVIEW</span>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] tracking-widest font-bold" style={{ color: 'rgba(195,182,238,0.65)', fontFamily: 'monospace' }}>BEFORE</span>
          <span className="text-[11px] font-black" style={{ color: 'rgba(160,145,195,0.75)', fontFamily: 'monospace' }}>Lv.{residue.level}</span>
          <span className="text-xl font-black leading-none" style={{ color: 'rgba(160,145,195,0.85)', fontFamily: 'monospace' }}>{formatStat(residue.mainStat.type, residue.mainStat.value)}</span>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          {levelledUp && <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,210,110,0.18)', border: '1px solid rgba(0,210,110,0.45)', color: '#00DD77' }}>LV UP!</motion.span>}
          <ChevronRight size={18} style={{ color: `${color}99` }} />
        </div>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] tracking-widest font-bold" style={{ color: 'rgba(195,182,238,0.65)', fontFamily: 'monospace' }}>AFTER</span>
          <span className="text-[11px] font-black" style={{ color: levelledUp ? '#00DD77' : 'rgba(160,145,195,0.75)', fontFamily: 'monospace' }}>Lv.{newLevel}</span>
          <span className="text-xl font-black leading-none" style={{ color: levelledUp ? color : 'rgba(195,185,240,0.92)', fontFamily: 'monospace', textShadow: levelledUp ? `0 0 12px ${color}99` : 'none' }}>{formatStat(residue.mainStat.type, newMainValue)}</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   ENHANCE GAUGE — inlined from NecroLab
────────────────────────────────────────── */
function EnhanceGauge({ residue, previewExpGain }: { residue: AbyssalResidueData | null; previewExpGain: number }) {
  const current = residue && residue.maxExp > 0 ? residue.exp / residue.maxExp : 0;
  const preview = residue && residue.maxExp > 0 ? Math.min(1, (residue.exp + previewExpGain) / residue.maxExp) : 0;
  const currentPct = `${(current * 100).toFixed(1)}%`;
  const previewPct = `${(preview * 100).toFixed(1)}%`;
  return (
    <div className="gothic-panel rounded-2xl p-3.5 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>✦ SOUL INFUSION</span>
        <span className="text-[10px] font-black" style={{ color: '#E080FF', fontFamily: 'monospace' }}>{residue ? `${residue.exp.toLocaleString()} / ${residue.maxExp.toLocaleString()} EXP` : '—'}</span>
      </div>
      <div style={{ height: 48, width: '100%', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.5)', position: 'relative' }}>
        {/* preview bar (lighter) */}
        <div style={{ position: 'absolute', inset: 0, width: previewPct, background: 'rgba(188,0,251,0.25)', transition: 'width 0.4s ease' }} />
        {/* current bar */}
        <div className="bar-shimmer" style={{ position: 'absolute', inset: 0, width: currentPct, background: 'linear-gradient(90deg, #7000cc, #BC00FB, #E080FF)', boxShadow: '0 0 12px rgba(188,0,251,0.6)', transition: 'width 0.4s ease' }} />
        {/* percentage label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#EDE8FF', fontFamily: 'monospace', textShadow: '0 0 6px rgba(188,0,251,0.8)' }}>{currentPct}</span>
        </div>
      </div>
      {previewExpGain > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-end mt-1 gap-1.5">
          <Sparkles size={10} style={{ color: '#E080FF' }} />
          <span className="text-[10px] font-black" style={{ color: '#E080FF', fontFamily: 'monospace' }}>+{previewExpGain.toLocaleString()} EXP</span>
        </motion.div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   MATERIAL CARD — inlined from NecroLab
────────────────────────────────────────── */
function MaterialCard({ mat, isSelected, onToggle }: { mat: ResidueMatData; isSelected: boolean; onToggle: () => void }) {
  const color = RARITY_COLOR[mat.rarity];
  return (
    <motion.button onClick={onToggle} whileTap={{ scale: 0.9 }}
      className="rounded-xl flex flex-col items-center gap-1 py-2 px-1 relative overflow-hidden"
      style={{ height: 84, background: isSelected ? `linear-gradient(160deg, ${RARITY_GLOW[mat.rarity]}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.68)', border: `1.5px solid ${isSelected ? color + 'AA' : 'rgba(130,70,200,0.32)'}`, boxShadow: isSelected ? `0 0 10px ${RARITY_GLOW[mat.rarity]}` : 'none' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
      {isSelected && <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: color }}><span style={{ fontSize: 8, color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</span></div>}
      <span style={{ fontSize: 18, lineHeight: 1 }}>💎</span>
      <span className="text-[9px] font-black text-center leading-tight max-w-[52px]" style={{ color: isSelected ? '#EDE8FF' : 'rgba(195,182,238,0.72)', fontFamily: 'monospace' }}>{mat.name}</span>
      <span className="text-[9px] font-bold" style={{ color: 'rgba(195,182,238,0.6)', fontFamily: 'monospace' }}>×{mat.quantity}</span>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   PORTRAIT CARD (list view)
────────────────────────────────────────── */
function PortraitCard({ mk, player, party, equippedResidueSlots, soulShards, demonGauge, isDemonMode, onSelect, onToggleDemon }: {
  mk: MemberKey; player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  soulShards: SoulShardData[]; demonGauge: number; isDemonMode: boolean;
  onSelect: () => void; onToggleDemon: () => void;
}) {
  const conf = getConf(mk, player, party);
  const info = getMemberInfo(mk, player, party, equippedResidueSlots, soulShards);
  const color = conf.color;
  const isVacant = info.isVacant;

  const slotIcons: { icon: string; item: ItemData | AbyssalResidueData | null; label: string }[] = [
    { icon: '⚔', item: info.weapon, label: 'W' },
    { icon: '🛡', item: info.armor, label: 'A' },
    { icon: '💍', item: info.acc, label: 'C' },
    { icon: '🌑', item: info.residues[0], label: 'R1' },
    { icon: '🌑', item: info.residues[1], label: 'R2' },
    { icon: '🌑', item: info.residues[2], label: 'R3' },
  ];

  const showDemonBadge = mk === 'PLAYER' && demonGauge >= 100;

  return (
    <motion.button onClick={isVacant ? undefined : onSelect} whileTap={!isVacant ? { scale: 0.96 } : undefined}
      className="relative rounded-[20px] overflow-hidden flex flex-col select-none"
      style={{
        background: isDemonMode && mk === 'PLAYER'
          ? 'linear-gradient(175deg, rgba(42,2,2,0.98), rgba(2,1,8,0.99))'
          : `linear-gradient(175deg, ${conf.darkBg}, rgba(2,1,8,0.99))`,
        border: `1.5px solid ${isVacant ? 'rgba(100,60,180,0.22)' : isDemonMode && mk === 'PLAYER' ? 'rgba(220,30,30,0.5)' : color + '44'}`,
        borderStyle: isVacant ? 'dashed' : 'solid',
        boxShadow: isVacant ? 'none' : isDemonMode && mk === 'PLAYER' ? '0 8px 36px rgba(0,0,0,0.8), 0 0 0 1px rgba(220,30,30,0.18)' : `0 8px 36px rgba(0,0,0,0.8), 0 0 0 1px ${color}16`,
      }}>
      {!isVacant && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 28%, ${isDemonMode && mk === 'PLAYER' ? 'rgba(220,30,30,0.38)' : conf.glow} 0%, transparent 60%)` }} />
          <Particles color={isDemonMode && mk === 'PLAYER' ? 'rgba(220,40,40,0.6)' : conf.particle} n={8} />
        </>
      )}
      <div className="absolute inset-0 pointer-events-none rounded-[20px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.062) 0%, transparent 48%)' }} />

      {/* Sprite */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 py-4">
        {isVacant ? (
          <div className="flex flex-col items-center gap-2 opacity-25">
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed flex items-center justify-center" style={{ borderColor: 'rgba(130,75,210,0.35)' }}>
              <Plus size={24} style={{ color: 'rgba(130,75,210,0.45)' }} strokeWidth={1.5} />
            </div>
            <span className="text-[9px] tracking-[0.25em] font-black" style={{ color: 'rgba(130,75,210,0.45)', fontFamily: 'monospace' }}>VACANT</span>
          </div>
        ) : (
          <motion.div animate={{ y: [-5, 5, -5] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }} className="relative">
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`, transform: 'scale(3)', filter: 'blur(18px)' }} />
            <div className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center relative overflow-hidden" style={{ fontSize: 42, background: `radial-gradient(circle at 38% 30%, ${color}30, rgba(0,0,0,0.88))`, border: `1.5px solid ${color}66`, boxShadow: `0 10px 28px rgba(0,0,0,0.72), 0 0 22px ${color}28, inset 0 0 18px rgba(0,0,0,0.5)` }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 52%)' }} />
              <span style={{ filter: `drop-shadow(0 0 10px ${color})`, lineHeight: 1 }}>{conf.emoji}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Info strip */}
      {!isVacant && (
        <div className="shrink-0 px-2.5 pt-2 pb-2.5 relative" style={{ background: `linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.2) 100%)`, borderTop: `1px solid ${color}1A` }}>
          {mk === 'PLAYER' && <span className="absolute top-2 left-2 text-[7px] font-black px-1.5 py-0.5 rounded" style={{ background: `${color}28`, border: `1px solid ${color}44`, color, fontFamily: 'monospace' }}>MAIN</span>}
          <div className="flex items-center justify-between mt-3 mb-1.5">
            <span className="text-[12px] font-black truncate max-w-[58%] leading-tight" style={{ color: '#F0EAFF', fontFamily: "'Cinzel Decorative', serif", textShadow: `0 0 8px ${color}55` }}>{info.name}</span>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}3A`, color, fontFamily: 'monospace' }}>
              {info.lvl !== null ? `Lv.${info.lvl}` : info.cost !== null ? `C${info.cost}` : '—'}
            </span>
          </div>
          {/* 6 slot micro-icons */}
          <div className="flex gap-1">
            {slotIcons.map((s, idx) => {
              const hasItem = s.item !== null;
              const rc = hasItem && (s.item as any).rarity ? RARITY_COLOR[(s.item as any).rarity] : null;
              return (
                <div key={idx} className="flex-1 flex items-center justify-center rounded" style={{ height: 22, border: hasItem ? `1px solid ${rc ?? color}66` : '1px dashed rgba(120,70,200,0.3)', background: hasItem ? `${rc ?? color}14` : 'transparent', fontSize: 11 }}>
                  <span style={{ filter: hasItem ? `drop-shadow(0 0 4px ${rc ?? color})` : 'none', opacity: hasItem ? 1 : 0.3 }}>{s.icon}</span>
                </div>
              );
            })}
          </div>
          {/* Demon mode badge */}
          {showDemonBadge && (
            <motion.button
              onClick={e => { e.stopPropagation(); haptic([15, 10, 30]); onToggleDemon(); }}
              whileTap={{ scale: 0.9 }}
              animate={{ boxShadow: isDemonMode ? ['0 0 8px rgba(220,30,30,0.4)', '0 0 18px rgba(220,30,30,0.8)', '0 0 8px rgba(220,30,30,0.4)'] : ['0 0 6px rgba(220,80,20,0.3)', '0 0 14px rgba(220,80,20,0.6)', '0 0 6px rgba(220,80,20,0.3)'] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-2 right-2 text-[7px] font-black px-1.5 py-0.5 rounded"
              style={{ background: isDemonMode ? 'rgba(220,30,30,0.4)' : 'rgba(200,60,20,0.3)', border: `1px solid ${isDemonMode ? 'rgba(240,60,60,0.8)' : 'rgba(220,80,20,0.6)'}`, color: isDemonMode ? '#ff8888' : '#ff9955', fontFamily: 'monospace' }}>
              {isDemonMode ? '✦魔神化中' : '魔神化'}
            </motion.button>
          )}
        </div>
      )}
      {!isVacant && (
        <div className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <svg width="5" height="9" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
        </div>
      )}
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   CHAR THUMB — adapted from sample
────────────────────────────────────────── */
function CharThumb({ mk, player, party, active, onSelect }: { mk: MemberKey; player: CharacterData | null; party: (MonsterData | null)[]; active: boolean; onSelect: () => void }) {
  const conf = getConf(mk, player, party);
  const isPlayer2 = mk === 'PLAYER';
  const i = isPlayer2 ? -1 : parseInt(mk.replace('MONSTER_', ''));
  const isVacant = !isPlayer2 && !party[i];
  const color = conf.color;
  const info = getMemberInfo(mk, player, party, [], []);
  return (
    <motion.button
      onClick={isVacant ? undefined : onSelect}
      whileTap={!isVacant ? { scale: 0.88 } : undefined}
      className="flex flex-col items-center gap-1"
      style={{ opacity: isVacant ? 0.28 : 1 }}
    >
      <div style={{
        width: active ? 48 : 40, height: active ? 48 : 40,
        borderRadius: '50%',
        background: active ? `radial-gradient(circle, ${color}30, #0a0515)` : '#0a0515',
        border: `2px solid ${active ? color : color + '40'}`,
        boxShadow: active ? `0 0 14px ${color}80, 0 0 28px ${color}40` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s ease', fontSize: 20, position: 'relative', overflow: 'hidden',
      }}>
        {!isVacant && active && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${color}20, transparent)`, animation: 'glow-pulse 2s ease-in-out infinite' }} />}
        <span style={{ filter: active ? `drop-shadow(0 0 6px ${color})` : 'none', lineHeight: 1 }}>
          {isVacant ? '+' : conf.emoji}
        </span>
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 7, color: active ? color : '#4a3a5a', letterSpacing: '0.06em', transition: 'color 0.3s ease' }}>
        {isVacant ? '—' : info.rank}
      </div>
    </motion.button>
  );
}

/* ──────────────────────────────────────────
   UNIT DETAIL VIEW — sample-based layout
────────────────────────────────────────── */
function UnitDetailView({ selKey, setSelKey, player, party, equippedResidueSlots, soulShards, isDemonMode, onBack, onOpenGear }: {
  selKey: MemberKey; setSelKey: (k: MemberKey) => void;
  player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  soulShards: SoulShardData[]; isDemonMode: boolean;
  onBack: () => void;
  onOpenGear: (slotType: 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'RESIDUE', slotIndex: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const conf = getConf(selKey, player, party);
  const color = isDemonMode ? '#CC2222' : conf.color;
  const accent = isDemonMode ? '#ff6666' : conf.accent;
  const info = getMemberInfo(selKey, player, party, equippedResidueSlots, soulShards);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useCanvasBg(canvasRef, conf.color, isDemonMode);

  const stats = info.stats;
  const lvl = info.lvl ?? 1;
  const maxLvl = 80;
  const xpPct = Math.min(100, (lvl / maxLvl) * 100);

  // Build HexSlot data for left column
  const leftSlots: HexSlotData[] = [
    {
      id: 'weapon', icon: '⚔', label: '武器', sublabel: info.weapon ? (info.weapon as any).name : '空',
      filled: !!info.weapon, level: null,
      rarity: info.weapon ? (info.weapon as any).rarity : null,
      locked: !info.isPlayer,
    },
    {
      id: 'armor', icon: '🛡', label: '鎧', sublabel: info.armor ? (info.armor as any).name : '空',
      filled: !!info.armor, level: null,
      rarity: info.armor ? (info.armor as any).rarity : null,
      locked: !info.isPlayer,
    },
    {
      id: 'acc', icon: '💍', label: '装飾品', sublabel: info.acc ? (info.acc as any).name : '空',
      filled: !!info.acc, level: null,
      rarity: info.acc ? (info.acc as any).rarity : null,
      locked: !info.isPlayer,
    },
  ];

  // Build HexSlot data for right column (residues)
  const rightSlots: HexSlotData[] = info.residues.map((r, i) => ({
    id: `residue_${i}`, icon: '🌑',
    label: r ? r.name : `虚空 ${['I', 'II', 'III'][i]}`,
    sublabel: r ? formatStat(r.mainStat.type, r.mainStat.value) : '空',
    filled: !!r, level: r?.level ?? null,
    rarity: r?.rarity ?? null,
    locked: !info.isPlayer && i > 0,
  }));

  const handleLeftSelect = (id: string | null) => {
    setSelectedSlot(id);
    if (id === 'weapon') { haptic(8); onOpenGear('WEAPON', 0); }
    else if (id === 'armor') { haptic(8); onOpenGear('ARMOR', 0); }
    else if (id === 'acc') { haptic(8); onOpenGear('ACCESSORY', 0); }
  };
  const handleRightSelect = (id: string | null) => {
    setSelectedSlot(id);
    if (id) {
      const idx = parseInt(id.replace('residue_', ''));
      haptic(8); onOpenGear('RESIDUE', idx);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 295, damping: 33 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#03010B', fontFamily: "'Inter', sans-serif" }}
      data-demon={isDemonMode ? 'true' : 'false'}
    >
      {/* Canvas bg */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.7 }} />

      {/* Navbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 relative z-10" style={{ height: 44, borderBottom: `1px solid ${color}16` }}>
        <motion.button onClick={() => { haptic(5); onBack(); }} whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2.5 py-2 rounded-xl"
          style={{ background: 'rgba(10,5,26,0.88)', border: `1px solid ${color}36`, color: `${color}DD`, minHeight: 36 }}>
          <ChevronLeft size={14} />
          <span className="text-[10px] font-black tracking-wider" style={{ fontFamily: 'monospace' }}>LIST</span>
        </motion.button>
        <div className="flex-1 text-center">
          <span className="text-[11px] font-black tracking-[0.16em]" style={{ color: '#F0EAFF', fontFamily: "'Cinzel Decorative', serif", textShadow: `0 0 10px ${color}55` }}>
            UNIT DETAIL
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-xl shrink-0" style={{ background: `${color}1A`, border: `1px solid ${color}30` }}>
          <span className="text-[10px] font-black" style={{ color, fontFamily: 'monospace' }}>
            {info.lvl !== null ? `Lv.${info.lvl}` : info.cost !== null ? `C${info.cost}` : '—'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="shrink-0 flex items-start justify-between px-3.5 py-3 relative z-10" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
        <div className="flex flex-col">
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color, letterSpacing: '0.18em', textShadow: `0 0 10px ${color}` }}>
            {info.sub}
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: '#f5f0ff', letterSpacing: '0.04em', lineHeight: 1.1, textShadow: `0 0 18px ${color}60` }}>
            {info.nameEn}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, color: accent, border: `1px solid ${accent}50`, padding: '1px 6px', borderRadius: 3, background: `${accent}10`, flexShrink: 0 }}>
              {info.rank}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#8b7da8' }}>{info.isPlayer ? `${conf.label} · 主人公` : `${conf.label} · 軍団員`}</div>
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#6b5f7a' }}>LEVEL</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 14px ${color}` }}>
            {info.lvl ?? info.cost ?? '?'}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 7, color: '#4a3a5a' }}>/ {maxLvl}</div>
          <div style={{ width: 50, height: 3, background: '#1a1228', borderRadius: 2, marginTop: 4, marginLeft: 'auto' }}>
            <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${accent})`, boxShadow: `0 0 5px ${color}` }} />
          </div>
        </div>
      </div>

      {/* Middle: LEFT slots | CHARACTER ART | RIGHT slots */}
      <div className="flex-1 min-h-0 relative z-10" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0 4px' }}>
        <FloatingOrbs color={color} />
        <ScanLine color={color} />

        {/* LEFT slots */}
        <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 108, display: 'flex', flexDirection: 'column', gap: 6, animation: 'slideInLeft 0.5s ease-out 0.2s both' }}>
          {leftSlots.map((slot, i) => (
            <HexSlot key={slot.id} slot={slot} selected={selectedSlot} onSelect={handleLeftSelect} color={color} delay={0.2 + i * 0.07} />
          ))}
          <div
            onClick={() => selectedSlot && handleLeftSelect(selectedSlot)}
            style={{
              marginTop: 3, padding: '6px 10px',
              background: selectedSlot ? `linear-gradient(135deg, ${color}28, ${color}14)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selectedSlot ? color : color + '22'}`,
              borderRadius: 8, textAlign: 'center', cursor: 'pointer',
              fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600,
              color: selectedSlot ? color : '#4a3a5a', letterSpacing: '0.08em',
              boxShadow: selectedSlot ? `0 0 9px ${color}38` : 'none',
              transition: 'all 0.22s ease',
            }}>
            装備
          </div>
        </div>

        {/* CENTER character art */}
        <AnimatePresence mode="wait">
          <motion.div key={selKey}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ width: 140, height: 200, position: 'relative', flexShrink: 0, marginTop: -8 }}>
            {/* Void ring glow */}
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 100, height: 24, background: `radial-gradient(ellipse, ${color}45, transparent 70%)`, animation: 'void-pulse 2s ease-in-out infinite', pointerEvents: 'none' }} />
            {/* Character sprite */}
            <div style={{ width: '100%', height: '100%', position: 'relative', filter: isDemonMode ? `drop-shadow(0 0 18px ${color}) drop-shadow(0 0 6px ${color}80)` : `drop-shadow(0 0 8px ${color}60)`, transition: 'filter 0.4s ease' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 24 }}>
                {/* Orbit rings */}
                <div style={{ position: 'relative', width: 0, height: 0 }}>
                  {[{ r: 160, dur: 16, rev: false }, { r: 110, dur: 10, rev: true }, { r: 72, dur: 6.5, rev: false }].map(({ r, dur, rev }, idx) => (
                    <div key={idx} style={{ position: 'absolute', width: r, height: r, left: -r / 2, top: -r / 2, borderRadius: '50%', border: `${idx === 0 ? 1 : 0.8}px solid ${['rgba('+color.slice(1)+'22', color+'18', color+'14'][idx]}`, borderStyle: idx === 1 ? 'dashed' : 'solid', animation: `magic-spin ${dur}s linear infinite ${rev ? 'reverse' : ''}` }} />
                  ))}
                  <div style={{ position: 'absolute', width: 110, height: 110, left: -55, top: -55, background: `radial-gradient(circle, ${color}1C 0%, transparent 70%)`, filter: 'blur(10px)', borderRadius: '50%' }} />
                </div>
                {/* Emoji sprite */}
                <div style={{ position: 'absolute' }}>
                  <motion.div animate={{ y: [-7, 7, -7] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}>
                    <div style={{ width: 90, height: 90, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54, background: `radial-gradient(circle at 35% 28%, ${color}2C, rgba(0,0,0,0.9))`, border: `2px solid ${color}66`, boxShadow: `0 14px 44px rgba(0,0,0,0.8), 0 0 36px ${color}2C, inset 0 0 24px rgba(0,0,0,0.55)`, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 52%)', borderRadius: 'inherit' }} />
                      <span style={{ filter: `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 4px ${color})`, lineHeight: 1, animation: 'breathe 3.2s ease-in-out infinite', transformOrigin: 'center bottom' }}>{conf.emoji}</span>
                    </div>
                    <motion.div animate={{ scaleX: [1, 1.3, 1], opacity: [0.28, 0.07, 0.28] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 72, height: 8, background: `radial-gradient(ellipse, ${color}77, transparent)`, filter: 'blur(6px)', borderRadius: 999, margin: '6px auto 0' }} />
                  </motion.div>
                </div>
              </div>
            </div>
            {/* Level ring SVG */}
            <svg style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', opacity: 0.55 }} width="80" height="26" viewBox="0 0 80 26">
              <ellipse cx="40" cy="13" rx="38" ry="9" fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
                style={{ animation: 'magic-spin 12s linear infinite', transformOrigin: '40px 13px' }} />
            </svg>
          </motion.div>
        </AnimatePresence>

        {/* RIGHT slots (residues) */}
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 108, display: 'flex', flexDirection: 'column', gap: 6, animation: 'slideInRight 0.5s ease-out 0.2s both' }}>
          {rightSlots.map((slot, i) => (
            <HexSlot key={slot.id} slot={slot} selected={selectedSlot} onSelect={handleRightSelect} color={color} delay={0.2 + i * 0.07} isVoid />
          ))}
          <div
            onClick={() => { haptic([10, 8, 18]); onOpenGear('RESIDUE', 0); }}
            style={{
              marginTop: 3, padding: '6px 10px',
              background: `linear-gradient(135deg, ${color}22, ${color}0C)`,
              border: `1px solid ${color}48`,
              borderRadius: 8, textAlign: 'center', cursor: 'pointer',
              fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600,
              color, letterSpacing: '0.08em',
              boxShadow: `0 0 10px ${color}28`,
              animation: 'glow-pulse 2.5s ease-in-out infinite',
              position: 'relative', overflow: 'hidden',
            }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${color}14, transparent)`, backgroundSize: '200% 100%', animation: 'shimmer 2s infinite', pointerEvents: 'none' }} />
            強化
          </div>
        </div>
      </div>

      {/* Stats panel */}
      <div className="shrink-0 relative z-10" style={{ margin: '0 10px 8px', padding: '10px 8px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: `1px solid ${color}28`, borderRadius: 14, backdropFilter: 'blur(10px)', boxShadow: `0 0 18px ${color}14, inset 0 1px 0 rgba(255,255,255,0.05)`, animation: 'fadeSlideUp 0.5s ease-out 0.4s both' }}>
        <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: `linear-gradient(90deg, transparent, ${color}55, transparent)`, borderRadius: '50%' }} />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}28, ${color}0C)` }} />
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 600, color: color + '88', letterSpacing: '0.2em', padding: '0 10px' }}>STATUS</div>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(270deg, ${color}28, ${color}0C)` }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <StatItem label="ATK" labelJa="攻撃力" value={stats?.atk ?? 0} color={color} delay={0.45} />
          <div style={{ width: 1, background: `${color}18`, alignSelf: 'stretch' }} />
          <StatItem label="DEF" labelJa="防御力" value={stats?.def ?? 0} color={color} delay={0.5} />
          <div style={{ width: 1, background: `${color}18`, alignSelf: 'stretch' }} />
          <StatItem label="SPD" labelJa="速度" value={stats?.agi ?? 0} color={color} delay={0.55} />
          <div style={{ width: 1, background: `${color}18`, alignSelf: 'stretch' }} />
          <StatItem label="HP" labelJa="体力" value={stats?.hp ?? 0} color={color} delay={0.6} />
        </div>
      </div>

      {/* Thumb strip + Formation button */}
      <div className="shrink-0 relative z-10" style={{ padding: '8px 10px 12px', background: 'linear-gradient(0deg, rgba(5,2,15,0.98), transparent)', animation: 'fadeSlideUp 0.5s ease-out 0.5s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}18`, borderRadius: 16, padding: '8px 12px', backdropFilter: 'blur(8px)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {MEMBER_KEYS.map(k => {
              const isPlayer2 = k === 'PLAYER';
              const midx = isPlayer2 ? -1 : parseInt(k.replace('MONSTER_', ''));
              const isVacant = !isPlayer2 && !party[midx];
              return (
                <CharThumb key={k} mk={k} player={player} party={party as (MonsterData | null)[]} active={k === selKey}
                  onSelect={() => { haptic([6, 4, 8]); setSelKey(k); }} />
              );
            })}
          </div>
          {/* Formation button */}
          <div style={{ padding: '7px 11px', background: `linear-gradient(135deg, ${color}28, ${color}12)`, border: `1px solid ${color}55`, borderRadius: 10, cursor: 'pointer', boxShadow: `0 0 10px ${color}28`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 700, color, letterSpacing: '0.05em', textAlign: 'center' }}>編成</div>
            <div style={{ fontFamily: 'monospace', fontSize: 6, color: accent + '80', textAlign: 'center', marginTop: 1 }}>Formation</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   GEAR HUB VIEW
────────────────────────────────────────── */
type GearSlotType = 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'RESIDUE';
interface GearCtx { mk: MemberKey; slotType: GearSlotType; slotIndex: number }

function GearHubView({ gearCtx, player, party, equippedResidueSlots, abyssalResidues, residueMaterials, inventoryItems, onBack }: {
  gearCtx: GearCtx; player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  abyssalResidues: AbyssalResidueData[]; residueMaterials: ResidueMatData[];
  inventoryItems: ItemData[]; onBack: () => void;
}) {
  const { equipResidueToSlot, upgradeResidue, equipItem } = useGameStore();
  const sound = useGothicSound();
  const conf = getConf(gearCtx.mk, player, party);
  const color = conf.color;
  const [tab, setTab] = useState<'EQUIP' | 'ENHANCE'>('EQUIP');
  const [selectedResidueId, setSelectedResidueId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMatIds, setSelectedMatIds] = useState<Set<string>>(new Set());

  const isResidueSlot = gearCtx.slotType === 'RESIDUE';
  const slotLabel = { WEAPON: '武器', ARMOR: '鎧', ACCESSORY: '装飾品', RESIDUE: `残滓 ${['I', 'II', 'III'][gearCtx.slotIndex] ?? ''}` }[gearCtx.slotType];

  const info = getMemberInfo(gearCtx.mk, player, party, equippedResidueSlots, []);
  const memberName = info.nameEn;

  const equippedIds = useMemo(() => new Set(equippedResidueSlots.filter(Boolean).map(s => s!.id)), [equippedResidueSlots]);

  const selectedResidue = abyssalResidues.find(r => r.id === selectedResidueId) ?? null;
  const totalExpGain = useMemo(() =>
    [...selectedMatIds].reduce((acc, id) => { const mat = residueMaterials.find(m => m.id === id); return acc + (mat ? mat.expValue * mat.quantity : 0); }, 0),
    [selectedMatIds, residueMaterials],
  );

  const filteredItems = useMemo(() => {
    const typeMap: Record<string, string> = { WEAPON: 'WEAPON', ARMOR: 'BODY', ACCESSORY: 'ACC1' };
    return inventoryItems.filter(i => (i as any).type === typeMap[gearCtx.slotType]);
  }, [inventoryItems, gearCtx.slotType]);

  const handleEquipResidue = () => {
    if (!selectedResidue) return;
    sound.playEquip(); haptic([8, 4, 14]);
    equipResidueToSlot(gearCtx.slotIndex, selectedResidue);
  };

  const handleEquipItem = (item: ItemData) => {
    if (!player) return;
    sound.playEquip(); haptic([8, 4, 14]);
    const slotMap: Record<string, any> = { WEAPON: 'weapon', ARMOR: 'body', ACCESSORY: 'acc1' };
    equipItem(slotMap[gearCtx.slotType], item);
  };

  const handleEnhance = () => {
    if (!selectedResidue || selectedMatIds.size === 0) return;
    sound.playEquip();
    upgradeResidue(selectedResidue.id, [...selectedMatIds]);
    setSelectedMatIds(new Set());
  };

  const handleAutoSelect = () => {
    if (!selectedResidue) return;
    sound.playTap();
    const needed = selectedResidue.maxExp - selectedResidue.exp;
    let remaining = needed;
    const next = new Set<string>();
    const sorted = [...residueMaterials].sort((a, b) => b.expValue * b.quantity - a.expValue * a.quantity);
    for (const mat of sorted) { if (remaining <= 0) break; next.add(mat.id); remaining -= mat.expValue * mat.quantity; }
    setSelectedMatIds(next);
  };

  const toggleMat = (id: string) => {
    sound.playTap();
    setSelectedMatIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 295, damping: 33 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #050115 0%, #07021A 100%)' }}
    >
      {/* Navbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 relative z-10" style={{ height: 44, borderBottom: `1px solid ${color}18` }}>
        <motion.button onClick={() => { haptic(5); sound.playTap(); onBack(); }} whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 px-2.5 py-2 rounded-xl"
          style={{ background: 'rgba(10,5,26,0.88)', border: `1px solid ${color}36`, color: `${color}DD`, minHeight: 36 }}>
          <ChevronLeft size={14} />
          <span className="text-[10px] font-black tracking-wider" style={{ fontFamily: 'monospace' }}>DETAIL</span>
        </motion.button>
        <div className="flex-1 text-center flex flex-col">
          <span className="text-[11px] font-black" style={{ color: '#F0EAFF', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em' }}>{slotLabel}</span>
          <span className="text-[9px]" style={{ color: color + 'AA', fontFamily: 'monospace' }}>{memberName}</span>
        </div>
        <div className="px-2.5 py-1.5 rounded-xl shrink-0" style={{ background: `${color}1A`, border: `1px solid ${color}30` }}>
          <span className="text-[10px] font-black" style={{ color, fontFamily: 'monospace' }}>
            {gearCtx.slotType.slice(0, 3)}
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="shrink-0 flex mx-3 mt-2.5 rounded-xl overflow-hidden" style={{ background: 'rgba(7,3,18,0.88)', border: `1px solid ${color}20` }}>
        {(['EQUIP', 'ENHANCE'] as const).map(t => (
          <button key={t} onClick={() => { haptic(5); setTab(t); }}
            className="flex-1 py-2.5 text-[12px] font-black tracking-[0.12em] relative transition-colors"
            style={{ color: tab === t ? '#F0EAFF' : 'rgba(185,165,230,0.36)', fontFamily: 'monospace', background: tab === t ? `linear-gradient(135deg, ${color}22, ${color}09)` : 'transparent' }}>
            {t === 'EQUIP' ? '⚔ 装備' : '✦ 強化'}
            {tab === t && <motion.div layoutId="gear-tab-line" className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative mt-2">
        <AnimatePresence mode="wait">
          {tab === 'EQUIP' ? (
            <motion.div key="equip" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.16 }} className="absolute inset-0 flex flex-col overflow-hidden">
              {isResidueSlot ? (
                <>
                  {/* Selected residue strip */}
                  <div className="shrink-0 px-3 pb-2">
                    {selectedResidue ? (
                      <div className="gothic-panel rounded-2xl overflow-hidden relative" style={{ height: 76 }}>
                        <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${RARITY_COLOR[selectedResidue.rarity]}, transparent)` }} />
                        <div className="flex items-center gap-3 px-3 h-full">
                          <div className="shrink-0 w-[44px] h-[44px] rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${RARITY_COLOR[selectedResidue.rarity]}28, rgba(0,0,0,0.85))`, border: `1.5px solid ${RARITY_COLOR[selectedResidue.rarity]}66` }}>
                            <ResidueIcon rarity={selectedResidue.rarity} size={28} />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-black truncate" style={{ color: '#EDE8FF', fontFamily: "'Cinzel Decorative', serif" }}>{selectedResidue.name}</span>
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${RARITY_COLOR[selectedResidue.rarity]}22`, border: `1px solid ${RARITY_COLOR[selectedResidue.rarity]}55`, color: RARITY_COLOR[selectedResidue.rarity] }}>{selectedResidue.rarity}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[17px] font-black leading-none" style={{ color: RARITY_COLOR[selectedResidue.rarity], fontFamily: 'monospace' }}>{formatStat(selectedResidue.mainStat.type, selectedResidue.mainStat.value)}</span>
                              <span className="text-[9px] font-bold" style={{ color: RARITY_COLOR[selectedResidue.rarity] + 'BB', fontFamily: 'monospace' }}>{STAT_LABEL[selectedResidue.mainStat.type] ?? selectedResidue.mainStat.type}</span>
                            </div>
                          </div>
                          <motion.button onClick={handleEquipResidue} whileTap={{ scale: 0.92 }}
                            className="shrink-0 rounded-xl text-[11px] font-black"
                            style={{ background: equippedIds.has(selectedResidue.id) ? 'rgba(0,90,48,0.45)' : `linear-gradient(135deg, ${RARITY_COLOR[selectedResidue.rarity]}35, rgba(12,5,28,0.85))`, border: `1.5px solid ${equippedIds.has(selectedResidue.id) ? 'rgba(0,210,110,0.6)' : RARITY_COLOR[selectedResidue.rarity] + '77'}`, color: equippedIds.has(selectedResidue.id) ? '#00DD77' : RARITY_COLOR[selectedResidue.rarity], fontFamily: 'monospace', minWidth: 60, minHeight: 40, padding: '0 8px' }}>
                            {equippedIds.has(selectedResidue.id) ? '✓ 装備中' : '装備する'}
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div className="gothic-panel rounded-2xl flex items-center justify-center gap-2 opacity-30" style={{ height: 76 }}>
                        <span className="text-[10px] tracking-widest font-bold" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>残滓を選択</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 px-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: 'rgba(185,110,255,0.9)', fontFamily: 'monospace' }}>☠ 残滓一覧 — {abyssalResidues.length}個</span>
                  </div>
                  <VirtualResidueGrid items={abyssalResidues} selectedId={selectedResidueId} equippedIds={equippedIds} onSelect={id => { sound.playTap(); setSelectedResidueId(id); }} />
                </>
              ) : (
                <>
                  {/* Weapon/Armor/Acc grid */}
                  <div className="shrink-0 px-4 pb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: 'rgba(185,110,255,0.9)', fontFamily: 'monospace' }}>⚔ {slotLabel}一覧 — {filteredItems.length}個</span>
                  </div>
                  {filteredItems.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center opacity-30">
                      <span className="text-[12px]" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>装備アイテムなし</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
                      <div className="grid grid-cols-2 gap-3 pb-4 pt-1">
                        {filteredItems.map(item => (
                          <ItemGridCard key={item.id} item={item} isSelected={selectedItemId === item.id}
                            isEquipped={info.weapon?.id === item.id || info.armor?.id === item.id || info.acc?.id === item.id}
                            onSelect={() => { sound.playTap(); setSelectedItemId(item.id); handleEquipItem(item); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="enhance" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.16 }} className="absolute inset-0 flex flex-col overflow-hidden px-3 pt-1 pb-3 gap-2">
              {isResidueSlot ? (
                <>
                  {/* Residue selector for enhance */}
                  <div className="shrink-0 flex gap-2 pt-1">
                    {abyssalResidues.slice(0, 4).map(r => (
                      <motion.button key={r.id} onClick={() => { sound.playTap(); setSelectedResidueId(r.id); }} whileTap={{ scale: 0.92 }}
                        className="flex-1 rounded-xl py-1.5 flex flex-col items-center gap-0.5 relative"
                        style={{ height: 60, background: selectedResidueId === r.id ? `linear-gradient(160deg, ${RARITY_GLOW[r.rarity]}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.7)', border: `1.5px solid ${selectedResidueId === r.id ? RARITY_COLOR[r.rarity] + 'BB' : 'rgba(130,70,200,0.35)'}` }}>
                        <ResidueIcon rarity={r.rarity} size={22} />
                        <span className="text-[8px] font-black truncate max-w-full px-0.5" style={{ color: RARITY_COLOR[r.rarity], fontFamily: 'monospace' }}>{formatStat(r.mainStat.type, r.mainStat.value)}</span>
                      </motion.button>
                    ))}
                  </div>
                  <StatsComparison residue={selectedResidue} expGain={totalExpGain} />
                  <EnhanceGauge residue={selectedResidue} previewExpGain={totalExpGain} />
                  <div className="gothic-panel rounded-2xl p-3 flex flex-col flex-1 overflow-hidden gap-2">
                    <div className="flex items-center justify-between shrink-0">
                      <span className="text-[10px] font-black tracking-[0.2em]" style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>✦ 素材を選択</span>
                      <button onClick={handleAutoSelect} disabled={!selectedResidue || residueMaterials.length === 0}
                        className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-lg disabled:opacity-35"
                        style={{ background: 'rgba(160,0,255,0.2)', border: '1px solid rgba(180,60,255,0.5)', color: '#E080FF', fontFamily: 'monospace' }}>
                        <Zap size={10} /> 一括選択
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {residueMaterials.length === 0 ? (
                        <div className="flex items-center justify-center h-full opacity-40"><span className="text-[11px] italic" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>素材がありません</span></div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 content-start">
                          {residueMaterials.map(mat => <MaterialCard key={mat.id} mat={mat} isSelected={selectedMatIds.has(mat.id)} onToggle={() => toggleMat(mat.id)} />)}
                        </div>
                      )}
                    </div>
                  </div>
                  <motion.button onClick={handleEnhance} whileTap={{ scale: 0.95 }} disabled={selectedMatIds.size === 0 || !selectedResidue}
                    className="shrink-0 py-3.5 rounded-2xl text-[13px] font-black tracking-[0.3em] disabled:opacity-35"
                    style={{ background: 'linear-gradient(135deg, rgba(120,0,220,0.5), rgba(50,0,120,0.65))', border: '1.5px solid rgba(160,50,255,0.65)', color: '#E080FF', boxShadow: '0 0 18px rgba(160,0,255,0.3)', fontFamily: 'monospace' }}>
                    強 化
                  </motion.button>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
                  <span style={{ fontSize: 36 }}>🔒</span>
                  <span className="text-[12px] font-black" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>強化不可</span>
                  <span className="text-[10px]" style={{ color: 'rgba(160,100,230,0.5)', fontFamily: 'monospace' }}>残滓スロットのみ強化可能</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   LEGION LIST VIEW
────────────────────────────────────────── */
function LegionListView({ player, party, equippedResidueSlots, soulShards, demonGauge, isDemonMode, onSelect, onToggleDemon }: {
  player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  soulShards: SoulShardData[]; demonGauge: number; isDemonMode: boolean;
  onSelect: (k: MemberKey) => void; onToggleDemon: () => void;
}) {
  const totalCost = (party as (MonsterData | null)[]).reduce((s, m) => s + (m?.cost ?? 0), 0);
  const maxCost = 12;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #03010B 0%, #060220 60%, #020110 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(188,24,242,0.11) 0%, transparent 68%)' }} />

      {/* Header */}
      <div className="shrink-0 px-4 pt-3.5 pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[22px] font-black tracking-[0.3em] leading-tight" style={{ color: '#E090FF', fontFamily: "'Cinzel Decorative', serif", textShadow: '0 0 18px rgba(196,28,250,0.58)' }}>LEGION</div>
            <div className="text-[11px] font-bold tracking-[0.2em] mt-0.5" style={{ color: 'rgba(182,165,232,0.52)', fontFamily: 'monospace' }}>ARMY FORMATION</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl" style={{ background: 'rgba(136,0,228,0.14)', border: '1px solid rgba(148,0,238,0.32)' }}>
              <span className="text-[12px] font-black" style={{ color: '#E090FF', fontFamily: 'monospace' }}>COST {totalCost}/{maxCost}</span>
            </div>
            <div className="w-[100px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(136,0,228,0.2)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (totalCost / maxCost) * 100)}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #8B00FF, #DD22FF)' }} />
            </div>
          </div>
        </div>
        <div className="mt-2.5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,28,250,0.32), transparent)' }} />
      </div>

      {/* 2×2 portrait grid */}
      <div className="flex-1 px-3 pb-3 relative z-10 overflow-hidden min-h-0">
        <div className="grid grid-cols-2 gap-3 h-full">
          {MEMBER_KEYS.map(k => (
            <PortraitCard key={k} mk={k} player={player} party={party as (MonsterData | null)[]}
              equippedResidueSlots={equippedResidueSlots} soulShards={soulShards}
              demonGauge={demonGauge} isDemonMode={isDemonMode}
              onSelect={() => {
                const isMon = k.startsWith('MONSTER_');
                const idx = isMon ? parseInt(k.replace('MONSTER_', '')) : -1;
                if (isMon && !party[idx]) return;
                haptic(8);
                onSelect(k);
              }}
              onToggleDemon={onToggleDemon}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   ROOT
────────────────────────────────────────── */
export default function LegionHub() {
  const { player, party, equippedResidueSlots, soulShards, abyssalResidues, residueMaterials, inventoryItems, demonGauge, isDemonMode, toggleDemonMode } = useGameStore();
  const sound = useGothicSound();
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'GEAR'>('LIST');
  const [selKey, setSelKey] = useState<MemberKey | null>(null);
  const [gearCtx, setGearCtx] = useState<GearCtx | null>(null);

  const openDetail = useCallback((k: MemberKey) => { sound.playTap(); setSelKey(k); setView('DETAIL'); }, [sound]);
  const goBackToList = useCallback(() => { haptic(5); sound.playTap(); setView('LIST'); setSelKey(null); }, [sound]);
  const goBackToDetail = useCallback(() => { haptic(5); sound.playTap(); setView('DETAIL'); setGearCtx(null); }, [sound]);

  const openGear = useCallback((slotType: GearSlotType, slotIndex: number) => {
    if (!selKey) return;
    sound.playTap();
    setGearCtx({ mk: selKey, slotType, slotIndex });
    setView('GEAR');
  }, [selKey, sound]);

  const switchMember = useCallback((k: MemberKey) => { sound.playTap(); setSelKey(k); }, [sound]);

  return (
    <div className="relative w-full h-full overflow-hidden" data-demon={isDemonMode ? 'true' : 'false'}>
      <AnimatePresence mode="sync">
        {view === 'LIST' && (
          <LegionListView key="list"
            player={player} party={party as (MonsterData | null)[]}
            equippedResidueSlots={equippedResidueSlots} soulShards={soulShards}
            demonGauge={demonGauge} isDemonMode={isDemonMode}
            onSelect={openDetail} onToggleDemon={() => { haptic([15, 10, 30]); toggleDemonMode(); }} />
        )}
        {view === 'DETAIL' && selKey && (
          <UnitDetailView key="detail"
            selKey={selKey} setSelKey={switchMember}
            player={player} party={party as (MonsterData | null)[]}
            equippedResidueSlots={equippedResidueSlots} soulShards={soulShards}
            isDemonMode={isDemonMode}
            onBack={goBackToList} onOpenGear={openGear} />
        )}
        {view === 'GEAR' && gearCtx && (
          <GearHubView key="gear"
            gearCtx={gearCtx}
            player={player} party={party as (MonsterData | null)[]}
            equippedResidueSlots={equippedResidueSlots}
            abyssalResidues={abyssalResidues} residueMaterials={residueMaterials}
            inventoryItems={inventoryItems as ItemData[]}
            onBack={goBackToDetail} />
        )}
      </AnimatePresence>
    </div>
  );
}
