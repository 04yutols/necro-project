'use client';

import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Swords, Zap, Plus, Sparkles, ChevronRight, Home, X, Crown, Filter, Recycle, Star } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useGothicSound } from '../necro/useGothicSound';
import { CharacterData, MonsterData, ItemData, AbyssalResidueData, SoulShardData, ResidueMatData, BaseStats, WeaponMaterialData } from '../../types/game';
import { getActiveSynergies, type ActiveSynergy } from '../../logic/TribeSynergySystem';
import {
  calculateCharacterStatProfile,
  ELEMENT_DAMAGE_KEYS,
  ELEMENT_VIEW_META,
  formatOptionValue,
  formatStatValue,
  getOptionLabel,
  STAT_VIEW_META,
  type StatBreakdown,
} from '../../logic/StatSystem';
import {
  calculateResidueScore,
  getResidueScoreGrade,
  getResidueSlotId,
  getResidueSlotMeta,
  isResidueSlotCompatible,
  RESIDUE_SLOT_ORDER,
  type ResidueSlotId,
} from '../../logic/ResidueScore';
import {
  calculateDismantleRewards,
  calculateWeaponAttackBreakdown,
  calculateWeaponBaseAttack,
  collectWeaponAttackBonuses,
  describeWeaponPassive,
  getNextReforgeTargetIlv,
  getRankUpCost,
  getReforgeCost,
  getWeaponArchetype,
  getWeaponEffectiveSubOptions,
  getWeaponIlv,
  getWeaponRank,
  getWeaponRarity,
  getWeaponSortScore,
  hasEnoughWeaponMaterials,
  WEAPON_ARCHETYPE_LABEL,
  WEAPON_RARITY_LABEL,
} from '../../logic/WeaponSystem';

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
  DRAGON:   { color: '#00C896', glow: 'rgba(0,200,150,0.45)',   darkBg: 'rgba(0,24,18,0.97)',  emoji: '🐉', label: 'DRAGON',   particle: 'rgba(0,200,150,0.6)',   accent: '#33e0b8' },
  ORC:      { color: '#5C9E6A', glow: 'rgba(92,158,106,0.45)', darkBg: 'rgba(6,18,8,0.97)',   emoji: '🛡️', label: 'ORC',      particle: 'rgba(92,158,106,0.6)',  accent: '#7dbe8c' },
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

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#99AABC', R: '#99AABC',
  RARE: '#55AAFF', SR: '#55AAFF',
  EPIC: '#CC22FF', SSR: '#CC22FF',
  LEGENDARY: '#FFB84D', UNIQUE: '#FBBB30',
  HIDDEN_UNIQUE: '#FF224D', UR: '#FF224D', LR: '#FFB84D',
};
const RARITY_GLOW:  Record<string, string> = {
  COMMON: 'rgba(153,170,188,0.32)', R: 'rgba(153,170,188,0.32)',
  RARE: 'rgba(85,170,255,0.38)', SR: 'rgba(85,170,255,0.38)',
  EPIC: 'rgba(204,34,255,0.48)', SSR: 'rgba(204,34,255,0.48)',
  LEGENDARY: 'rgba(255,184,77,0.48)', UNIQUE: 'rgba(251,187,48,0.38)',
  HIDDEN_UNIQUE: 'rgba(255,34,77,0.5)', UR: 'rgba(255,34,77,0.55)', LR: 'rgba(255,184,77,0.48)',
};

/* ──────────────────────────────────────────
   INLINED FROM NecroLab — stat formatting
────────────────────────────────────────── */
const STAT_LABEL: Record<string, string> = {
  'ATK%': 'ATK', 'ATK_FLAT': 'ATK', 'DEF%': 'DEF', 'DEF_FLAT': 'DEF',
  'HP%': 'HP', 'HP_FLAT': 'HP', 'SPD%': 'SPD', 'SPD_FLAT': 'SPD',
  'CRIT_RATE': 'CRIT RATE', 'CRIT_DMG': 'CRIT DMG',
  'EFFECT_HIT': 'EFFECT HIT', 'EFFECT_RES': 'EFFECT RES',
  'FIRE_DMG_BOOST': 'FIRE DMG', 'WATER_DMG_BOOST': 'WATER DMG',
  'THUNDER_DMG_BOOST': 'THUNDER DMG', 'EARTH_DMG_BOOST': 'EARTH DMG',
  'WIND_DMG_BOOST': 'WIND DMG', 'ICE_DMG_BOOST': 'ICE DMG',
  'LIGHT_DMG_BOOST': 'LIGHT DMG', 'DARK_DMG_BOOST': 'DARK DMG',
  'VOID_DMG_BOOST': 'ALL DMG',
};
function formatStat(type: string, value: number): string {
  return formatOptionValue(type, value);
}

/* ──────────────────────────────────────────
   MEMBER INFO
────────────────────────────────────────── */
interface MemberInfo {
  name: string; nameEn: string; sub: string; rank: string;
  lvl: number | null; cost: number | null;
  stats: CharacterData['stats'] | null;
  weapon: ItemData | null;
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
      residues: equippedResidueSlots,
      isVacant: false, isPlayer: true,
    };
  }
  const i = parseInt(mk.replace('MONSTER_', ''));
  const m = party[i] ?? null;
  if (!m) return { name: 'VACANT', nameEn: 'VACANT', sub: 'EMPTY', rank: '—', lvl: null, cost: null, stats: null, weapon: null, residues: [null, null, null, null, null], isVacant: true, isPlayer: false };
  const fake: AbyssalResidueData | null = (() => {
    if (!m.equippedShardId) return null;
    const s = soulShards.find((x: SoulShardData) => x.id === m.equippedShardId);
    return s ? { id: s.id, name: `${s.originMonsterName}の魂`, itemId: 'head', rarity: 'RARE', mainStat: { type: 'ATK_FLAT', value: s.effect.atkBonus }, subOptions: [{ type: 'DARK_DMG_BOOST', value: s.effect.elementDmgBoost }], level: 1, exp: 0, maxExp: 800 } : null;
  })();
  return {
    name: m.name, nameEn: m.name.toUpperCase(), sub: (TRIBE[m.tribe] ?? TRIBE.HUMANOID).label, rank: 'SR',
    lvl: null, cost: m.cost,
    stats: m.stats as CharacterData['stats'],
    weapon: null,
    residues: [fake, null, null, null, null],
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
        padding: '8px 10px',
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
          backgroundImage: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', pointerEvents: 'none',
        }} />
      )}
      <div style={{
        width: 34, height: 34, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: slot.filled ? `${color}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${slot.filled ? color + '60' : color + '20'}`,
        borderRadius: 8, fontSize: 14, position: 'relative',
      }}>
        {slot.locked ? '🔒' : slot.filled ? slot.icon : <span style={{ color: color + '50', fontSize: 14 }}>＋</span>}
        {slot.filled && isVoid && !slot.locked && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: `radial-gradient(circle, ${color}28, transparent)`, animation: 'void-pulse 2s ease-in-out infinite' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: slot.filled ? '#e2d8f0' : '#6b5f7a', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slot.locked ? 'LOCKED' : slot.label}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: slot.filled ? '#9b7fc0' : '#4a3a5a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.locked ? '—' : slot.sublabel}
        </div>
      </div>
      {slot.filled && slot.level != null && !slot.locked && (
        <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 600, color, background: `${color}18`, padding: '2px 5px', borderRadius: 4, border: `1px solid ${color}40`, flexShrink: 0 }}>
          Lv.{slot.level}
        </div>
      )}
      {isVoid && !slot.filled && !slot.locked && (
        <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', border: `1px dashed ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: `${color}30` }} />
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

function formatStatBonus(key: keyof BaseStats, value: number): string {
  const prefix = value > 0 ? '+' : '';
  return STAT_VIEW_META[key].percent
    ? `${prefix}${value.toFixed(1)}%`
    : `${prefix}${Math.round(value).toLocaleString()}`;
}

function StatusRow({ statKey, total, profile, color }: {
  statKey: keyof BaseStats;
  total: BaseStats;
  profile: StatBreakdown | null;
  color: string;
}) {
  const meta = STAT_VIEW_META[statKey];
  const sources = profile
    ? [
        { label: '職業', value: profile.job[statKey] },
        { label: '永続', value: profile.passives[statKey] },
        { label: '装備', value: profile.equipment[statKey] },
        { label: '残滓', value: profile.residues[statKey] },
      ]
    : [];

  return (
    <div
      style={{
        padding: '10px 11px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.035)',
        border: `1px solid ${color}22`,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: '#F0EAFF', letterSpacing: '0.08em', fontWeight: 800 }}>
            {meta.label}
          </div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 9, color: '#7f7193', marginTop: 1 }}>
            {meta.labelJa}
          </div>
        </div>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color, fontWeight: 900, textShadow: `0 0 12px ${color}55`, whiteSpace: 'nowrap' }}>
          {formatStatValue(statKey, total[statKey])}
        </div>
      </div>
      {sources.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5, marginTop: 8 }}>
          {sources.map((source) => (
            <div key={source.label} style={{ minWidth: 0, borderRadius: 8, background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.05)', padding: '5px 4px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 7, color: '#615271' }}>{source.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 8, color: source.value > 0 ? '#D7C3FF' : '#4a3a5a', marginTop: 2 }}>
                {formatStatBonus(statKey, source.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ElementBoostGrid({ boosts }: { boosts: StatBreakdown['elementDmgBoosts'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
      {ELEMENT_DAMAGE_KEYS.map((element) => {
        const meta = ELEMENT_VIEW_META[element];
        const value = boosts[element] ?? 0;
        return (
          <div
            key={element}
            style={{
              borderRadius: 11,
              padding: '9px 10px',
              background: value > 0 ? `linear-gradient(135deg, ${meta.color}22, rgba(255,255,255,0.025))` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${value > 0 ? meta.color + '55' : 'rgba(255,255,255,0.06)'}`,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#F0EAFF', letterSpacing: '0.06em' }}>{meta.label}</div>
                <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 9, color: meta.color }}>{meta.labelJa}属性</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: value > 0 ? meta.color : '#51415f', fontWeight: 900, whiteSpace: 'nowrap' }}>
                {value.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusDetailSheet({ open, name, subtitle, stats, profile, currentEnergy, maxEnergy, color, accent, onClose }: {
  open: boolean;
  name: string;
  subtitle: string;
  stats: BaseStats | null;
  profile: StatBreakdown | null;
  currentEnergy?: number;
  maxEnergy?: number;
  color: string;
  accent: string;
  onClose: () => void;
}) {
  if (!open || !stats) return null;
  const primaryKeys: (keyof BaseStats)[] = ['hp', 'atk', 'def', 'spd'];
  const advancedKeys: (keyof BaseStats)[] = ['critRate', 'critDmg', 'effectHit', 'effectRes'];
  const energyPct = maxEnergy ? Math.min(100, Math.max(0, ((currentEnergy ?? 0) / maxEnergy) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(3,1,10,0.94)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="shrink-0"
        style={{
          padding: 'max(12px, env(safe-area-inset-top, 12px)) 14px 10px',
          borderBottom: `1px solid ${color}26`,
          background: `linear-gradient(180deg, ${color}16, rgba(3,1,10,0.72))`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color, letterSpacing: '0.18em', textShadow: `0 0 10px ${color}` }}>
              STATUS ARCHIVE
            </div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: '#F0EAFF', fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b7da8', marginTop: 2 }}>
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: `1px solid ${color}40`,
              background: 'rgba(255,255,255,0.04)',
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={17} />
          </button>
        </div>
        {maxEnergy && (
          <div style={{ marginTop: 10, borderRadius: 999, height: 7, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: `1px solid ${color}20` }}>
            <div style={{ width: `${energyPct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${accent})`, boxShadow: `0 0 10px ${color}` }} />
          </div>
        )}
      </div>

      <div className="safe-scroll custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 12px calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
        <section style={{ borderRadius: 16, padding: 12, background: 'rgba(10,5,26,0.78)', border: `1px solid ${color}30`, boxShadow: `0 0 22px ${color}12` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: '#F0EAFF', fontWeight: 900, letterSpacing: '0.12em' }}>MAIN STATUS</div>
            {maxEnergy && <div style={{ fontFamily: 'monospace', fontSize: 10, color }}>{currentEnergy ?? 0}/{maxEnergy} EN</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {primaryKeys.map((key) => <StatusRow key={key} statKey={key} total={stats} profile={profile} color={color} />)}
          </div>
        </section>

        <section style={{ marginTop: 10, borderRadius: 16, padding: 12, background: 'rgba(10,5,26,0.7)', border: `1px solid ${color}24` }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: '#F0EAFF', fontWeight: 900, letterSpacing: '0.12em', marginBottom: 10 }}>ADVANCED</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {advancedKeys.map((key) => <StatusRow key={key} statKey={key} total={stats} profile={profile} color={color} />)}
          </div>
        </section>

        <section style={{ marginTop: 10, borderRadius: 16, padding: 12, background: 'rgba(10,5,26,0.7)', border: `1px solid ${color}24` }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: '#F0EAFF', fontWeight: 900, letterSpacing: '0.12em', marginBottom: 10 }}>ELEMENT DMG</div>
          <ElementBoostGrid boosts={profile?.elementDmgBoosts ?? {}} />
        </section>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   RESIDUE ICON — inlined from NecroLab
────────────────────────────────────────── */
function ResidueScoreBadge({ residue, compact = false }: { residue: AbyssalResidueData; compact?: boolean }) {
  const score = residue.residueScore ?? calculateResidueScore(residue);
  const grade = getResidueScoreGrade(score);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 5,
        borderRadius: 999,
        padding: compact ? '2px 5px' : '4px 8px',
        background: `linear-gradient(135deg, ${grade.color}24, rgba(0,0,0,0.38))`,
        border: `1px solid ${grade.color}66`,
        boxShadow: score >= 50 ? `0 0 12px ${grade.color}33` : 'none',
        color: grade.color,
        fontFamily: 'monospace',
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      <Star size={compact ? 9 : 11} fill={grade.color} strokeWidth={1.5} />
      <span style={{ fontSize: compact ? 8 : 10 }}>{grade.grade}</span>
      <span style={{ fontSize: compact ? 8 : 10 }}>{score.toFixed(1)}</span>
    </div>
  );
}

function ResidueSlotRail({ slots, activeIndex, onSelect, color }: {
  slots: (AbyssalResidueData | null)[];
  activeIndex: number;
  onSelect: (index: number) => void;
  color: string;
}) {
  return (
    <div className="shrink-0 px-3 pb-2">
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${RESIDUE_SLOT_ORDER.length}, minmax(0, 1fr))`, gap: 7 }}>
        {RESIDUE_SLOT_ORDER.map((slotId, index) => {
          const meta = getResidueSlotMeta(slotId);
          const residue = slots[index] ?? null;
          const active = activeIndex === index;
          const rarityColor = residue ? RARITY_COLOR[residue.rarity] : color;
          return (
            <motion.button
              key={slotId}
              type="button"
              onClick={() => onSelect(index)}
              whileTap={{ scale: 0.92 }}
              style={{
                minHeight: 72,
                borderRadius: 13,
                padding: '7px 5px',
                background: residue
                  ? `linear-gradient(160deg, ${rarityColor}22, rgba(8,3,20,0.86))`
                  : 'rgba(255,255,255,0.028)',
                border: `1.5px solid ${active ? color : residue ? rarityColor + '66' : 'rgba(150,85,220,0.26)'}`,
                boxShadow: active ? `0 0 14px ${color}44` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minWidth: 0,
              }}
            >
              <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: active ? color : rarityColor, fontWeight: 900 }}>{meta.icon}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: active ? '#F0EAFF' : 'rgba(198,184,238,0.62)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {meta.nameJa.replace('の', '')}
              </span>
              {residue ? (
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: rarityColor, fontWeight: 900 }}>Lv.{residue.level}</span>
              ) : (
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(130,90,190,0.45)' }}>EMPTY</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ResidueSubstatList({ residue }: { residue: AbyssalResidueData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
      {residue.subOptions.map((option, index) => {
        const label = STAT_LABEL[option.type] ?? getOptionLabel(option.type);
        const valuable = ['CRIT_RATE', 'CRIT_DMG', 'ATK%', 'HP%'].includes(option.type);
        return (
          <div
            key={`${option.type}-${index}`}
            style={{
              minWidth: 0,
              borderRadius: 10,
              padding: '7px 8px',
              background: valuable ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.032)',
              border: valuable ? '1px solid rgba(212,175,55,0.24)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: valuable ? '#D4AF37' : '#7f7193', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#F0EAFF', fontWeight: 900, marginTop: 2 }}>+{formatStat(option.type, option.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ResidueGrowthTrack({ residue }: { residue: AbyssalResidueData | null }) {
  const events = [4, 8, 12, 16, 20];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
      {events.map((level, index) => {
        const reached = !!residue && residue.level >= level;
        const tier = residue?.tierHistory?.[index];
        const tierColor = tier === 4 ? '#D4AF37' : tier === 3 ? '#CC22FF' : tier === 2 ? '#55AAFF' : '#6f647f';
        return (
          <div
            key={level}
            style={{
              minHeight: 34,
              borderRadius: 9,
              background: reached ? `${tierColor}18` : 'rgba(255,255,255,0.026)',
              border: `1px solid ${reached ? tierColor + '55' : 'rgba(255,255,255,0.055)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: reached ? tierColor : '#51415f', fontWeight: 900 }}>Lv.{level}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: reached ? tierColor : '#443650' }}>{tier ? `T${tier}` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function ResidueDetailPanel({ residue, equipped, color, onEquip, equipDisabled }: {
  residue: AbyssalResidueData | null;
  equipped: AbyssalResidueData | null;
  color: string;
  onEquip: () => void;
  equipDisabled: boolean;
}) {
  if (!residue) {
    return (
      <div className="gothic-panel rounded-2xl flex items-center justify-center opacity-35" style={{ minHeight: 154 }}>
        <span style={{ color: 'rgba(180,100,255,0.72)', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.16em' }}>残滓を選択</span>
      </div>
    );
  }

  const rarityColor = RARITY_COLOR[residue.rarity];
  const slotMeta = getResidueSlotMeta(getResidueSlotId(residue));
  const currentScore = equipped ? calculateResidueScore(equipped) : 0;
  const candidateScore = calculateResidueScore(residue);
  const scoreDiff = candidateScore - currentScore;

  return (
    <div className="gothic-panel rounded-2xl overflow-hidden relative" style={{ minHeight: 154 }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }} />
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 30%, ${rarityColor}32, rgba(0,0,0,0.82))`, border: `1.5px solid ${rarityColor}66`, boxShadow: `0 0 16px ${rarityColor}22` }}>
            <ResidueIcon rarity={residue.rarity} size={34} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ color: '#F0EAFF', fontFamily: "'Cinzel Decorative', serif", fontSize: 12, fontWeight: 900, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{residue.name}</span>
              <span style={{ color: rarityColor, background: `${rarityColor}1A`, border: `1px solid ${rarityColor}44`, borderRadius: 999, padding: '2px 6px', fontFamily: 'monospace', fontSize: 8, fontWeight: 900, flexShrink: 0 }}>{residue.rarity}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span style={{ color: color + 'CC', fontFamily: 'monospace', fontSize: 9 }}>{slotMeta.nameJa}</span>
              <span style={{ color: '#7f7193', fontFamily: 'monospace', fontSize: 9 }}>Lv.{residue.level}/20</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span style={{ color: rarityColor, fontFamily: "'Cinzel', serif", fontSize: 23, fontWeight: 900, lineHeight: 1, textShadow: `0 0 12px ${rarityColor}66` }}>{formatStat(residue.mainStat.type, residue.mainStat.value)}</span>
              <span style={{ color: rarityColor + 'CC', fontFamily: 'monospace', fontSize: 10, fontWeight: 900 }}>{STAT_LABEL[residue.mainStat.type] ?? getOptionLabel(residue.mainStat.type)}</span>
            </div>
          </div>
          <ResidueScoreBadge residue={residue} />
        </div>

        <ResidueSubstatList residue={residue} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
          <div style={{ borderRadius: 11, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.24)', padding: '8px 9px', minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>装備中との差分</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: scoreDiff >= 0 ? '#8DFFBF' : '#FF8888', fontWeight: 900, marginTop: 2 }}>
              {equipped ? `${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)} SCORE` : 'EMPTY SLOT'}
            </div>
          </div>
          <motion.button
            type="button"
            onClick={onEquip}
            whileTap={{ scale: 0.94 }}
            disabled={equipDisabled}
            style={{
              minHeight: 44,
              minWidth: 86,
              borderRadius: 13,
              background: equipDisabled ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${rarityColor}35, rgba(12,5,28,0.9))`,
              border: `1.5px solid ${equipDisabled ? 'rgba(255,255,255,0.08)' : rarityColor + '77'}`,
              color: equipDisabled ? '#5d5368' : rarityColor,
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 12,
              fontWeight: 900,
              boxShadow: equipDisabled ? 'none' : `0 0 12px ${rarityColor}24`,
            }}
          >
            {equipDisabled ? '装備中' : '装備'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function TransmutationPanel({ activeSlotIndex, points, color }: {
  activeSlotIndex: number;
  points: number;
  color: string;
}) {
  const activeSlotId = RESIDUE_SLOT_ORDER[activeSlotIndex];
  const activeMeta = getResidueSlotMeta(activeSlotId);
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden px-3 pt-1 pb-3 gap-2" style={{ width: '100%' }}>
      <div className="gothic-panel rounded-2xl overflow-hidden shrink-0" style={{ borderColor: `${color}44` }}>
        <div className="p-3 flex items-center gap-3">
          <div style={{ width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at 35% 25%, ${color}33, rgba(0,0,0,0.82))`, border: `1px solid ${color}55` }}>
            <Recycle size={22} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 10, color: '#F0EAFF', letterSpacing: '0.12em', fontWeight: 900 }}>SOUL TRANSMUTATION</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color: '#8b7da8', marginTop: 3 }}>不要な残滓を錬成ポイントへ変換し、部位と主効果を指定する救済導線。</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>POINTS</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color, fontWeight: 900, lineHeight: 1 }}>{points.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="gothic-panel rounded-2xl p-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} style={{ color: '#D4AF37' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', fontWeight: 900, letterSpacing: '0.16em' }}>特注残滓製造権</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {RESIDUE_SLOT_ORDER.map((slotId) => {
            const meta = getResidueSlotMeta(slotId);
            const selected = slotId === activeSlotId;
            const affordable = points >= meta.cost;
            return (
              <div
                key={slotId}
                style={{
                  minHeight: 74,
                  borderRadius: 12,
                  padding: '7px 5px',
                  textAlign: 'center',
                  background: selected ? `linear-gradient(160deg, ${color}26, rgba(0,0,0,0.45))` : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${selected ? color + '66' : affordable ? 'rgba(212,175,55,0.26)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: selected ? color : '#bfaee2', fontWeight: 900 }}>{meta.icon}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 7, color: '#8b7da8', marginTop: 3, minHeight: 18 }}>{meta.role}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: affordable ? '#D4AF37' : '#5a4f66', fontWeight: 900 }}>{meta.cost}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="gothic-panel rounded-2xl p-3 flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, color: '#F0EAFF', fontWeight: 900, letterSpacing: '0.08em' }}>{activeMeta.nameEn}</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color }}>{activeMeta.nameJa} / {activeMeta.role}</div>
          </div>
          <div style={{ flexShrink: 0, borderRadius: 999, padding: '5px 9px', background: points >= activeMeta.cost ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${points >= activeMeta.cost ? 'rgba(212,175,55,0.36)' : 'rgba(255,255,255,0.07)'}`, color: points >= activeMeta.cost ? '#D4AF37' : '#6a5f76', fontFamily: 'monospace', fontSize: 10, fontWeight: 900 }}>
            {points >= activeMeta.cost ? '製造可能' : 'ポイント不足'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {[
            ['部位指定', activeMeta.nameJa],
            ['主効果候補', activeSlotId === 'waist' ? '属性DMG / HP% / ATK% / DEF%' : activeSlotId === 'legs' ? '会心率 / 会心DMG / HP% / ATK%' : activeSlotId === 'head' ? 'HP固定' : activeSlotId === 'arms' ? 'ATK固定' : 'HP% / ATK% / DEF%'],
            ['保証サブ', '2種まで指定可能'],
          ].map(([label, value]) => (
            <div key={label} style={{ borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', padding: '9px 10px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>{label}</div>
              <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 11, color: '#F0EAFF', fontWeight: 800, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={points < activeMeta.cost}
          style={{
            marginTop: 'auto',
            minHeight: 46,
            borderRadius: 15,
            background: points >= activeMeta.cost ? 'linear-gradient(135deg, rgba(212,175,55,0.28), rgba(139,0,255,0.18))' : 'rgba(255,255,255,0.035)',
            border: `1.5px solid ${points >= activeMeta.cost ? 'rgba(212,175,55,0.52)' : 'rgba(255,255,255,0.07)'}`,
            color: points >= activeMeta.cost ? '#D4AF37' : '#5f5369',
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.18em',
          }}
        >
          錬成準備
        </button>
      </div>
    </div>
  );
}

function ResidueIcon({ rarity, size = 36 }: { rarity: string; size?: number }) {
  const c = RARITY_COLOR[rarity] ?? RARITY_COLOR.COMMON;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <polygon points="15,3 29,3 41,15 41,29 29,41 15,41 3,29 3,15" fill={`${c}28`} stroke={c} strokeWidth="1.5" />
      {rarity === 'LEGENDARY' && (<><path d="M12 29l4-13 6 8 6-8 4 13H12z" fill={`${c}4D`} stroke={c} strokeWidth="0.8" /><circle cx="22" cy="22" r="3.2" fill={c} opacity="0.95" /></>)}
      {rarity === 'EPIC' && (<><polygon points="22,10 24.5,18 33,18 26.5,23 29,31 22,26 15,31 17.5,23 11,18 19.5,18" fill={`${c}44`} stroke={c} strokeWidth="0.7" /><circle cx="22" cy="22" r="3" fill={c} opacity="0.9" /></>)}
      {rarity === 'RARE' && (<><circle cx="22" cy="22" r="7" fill={`${c}38`} stroke={c} strokeWidth="0.8" /><circle cx="22" cy="22" r="2.5" fill={c} opacity="0.85" /></>)}
      {(rarity === 'COMMON' || rarity === 'UNIQUE') && <circle cx="22" cy="22" r="4" fill={`${c}60`} stroke={c} strokeWidth="0.8" />}
    </svg>
  );
}

/* ──────────────────────────────────────────
   RESIDUE GRID CARD — inlined from NecroLab
────────────────────────────────────────── */
const GRID_ITEM_H = 118;
const GRID_COLS = 3;
const GRID_GAP = 8;
const ROW_H = GRID_ITEM_H + GRID_GAP;

function ResidueGridCard({ residue, isSelected, isEquipped, onSelect }: { residue: AbyssalResidueData; isSelected: boolean; isEquipped: boolean; onSelect: () => void }) {
  const color = RARITY_COLOR[residue.rarity];
  const slotMeta = getResidueSlotMeta(getResidueSlotId(residue));
  return (
    <motion.button onClick={onSelect} whileTap={{ scale: 0.91 }}
      className="rounded-xl flex flex-col items-center gap-1 py-2 px-1.5 relative overflow-hidden"
      style={{ height: GRID_ITEM_H, background: isSelected ? `linear-gradient(160deg, ${RARITY_GLOW[residue.rarity]}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.7)', border: `1.5px solid ${isSelected ? color + 'BB' : 'rgba(130,70,200,0.35)'}`, boxShadow: isSelected ? `0 0 14px ${RARITY_GLOW[residue.rarity]}` : 'none' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)' }} />
      {isEquipped && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#00DD77', boxShadow: '0 0 5px #00DD77' }} />}
      <span className="absolute top-1.5 left-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ color: color + 'EE', border: `1px solid ${color}44`, background: `${color}14`, fontFamily: 'monospace' }}>{slotMeta.icon}</span>
      <ResidueIcon rarity={residue.rarity} size={28} />
      <span className="text-[11px] font-black" style={{ color, fontFamily: 'monospace' }}>{formatStat(residue.mainStat.type, residue.mainStat.value)}</span>
      <span className="text-[9px] truncate max-w-full px-0.5 text-center leading-tight" style={{ color: 'rgba(195,182,238,0.78)', fontFamily: 'monospace' }}>{residue.name}</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px]" style={{ color: 'rgba(195,182,238,0.55)', fontFamily: 'monospace' }}>Lv.{residue.level}</span>
        <ResidueScoreBadge residue={residue} compact />
      </div>
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
  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <div className="gothic-panel rounded-2xl p-4 opacity-45">
          <Filter size={18} style={{ color: '#BC00FB', margin: '0 auto 8px' }} />
          <span style={{ color: 'rgba(195,182,238,0.72)', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.08em' }}>この部位の残滓はありません</span>
        </div>
      </div>
    );
  }
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
   WEAPON UI
────────────────────────────────────────── */
function materialQty(materials: WeaponMaterialData[], type: string): number {
  return materials.find((mat) => mat.type === type)?.quantity ?? 0;
}

function WeaponGridCard({ item, isSelected, isEquipped, onSelect }: { item: ItemData; isSelected: boolean; isEquipped: boolean; onSelect: () => void }) {
  const rarity = getWeaponRarity(item);
  const color = RARITY_COLOR[rarity] ?? RARITY_COLOR.R;
  const baseAtk = calculateWeaponBaseAttack(item);
  return (
    <motion.button onClick={onSelect} whileTap={{ scale: 0.92 }}
      className="rounded-xl flex flex-col items-center gap-1.5 py-2.5 px-2 relative overflow-hidden"
      style={{ minHeight: 126, background: isSelected ? `linear-gradient(160deg, ${RARITY_GLOW[rarity] ?? RARITY_GLOW.R}, rgba(12,5,28,0.94))` : 'rgba(12,6,28,0.72)', border: `1.5px solid ${isSelected ? color + 'BB' : 'rgba(130,70,200,0.35)'}`, boxShadow: isSelected ? `0 0 16px ${RARITY_GLOW[rarity] ?? RARITY_GLOW.R}` : 'none' }}>
      <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.065) 0%, transparent 50%)' }} />
      {isEquipped && <div className="absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,221,119,0.16)', border: '1px solid rgba(0,221,119,0.48)', color: '#8DFFBF', fontFamily: 'monospace' }}>装備中</div>}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `radial-gradient(circle at 35% 25%, ${color}34, rgba(0,0,0,0.82))`, border: `1px solid ${color}55`, boxShadow: `0 0 12px ${color}22` }}>
        <Swords size={18} style={{ color }} />
      </div>
      <span className="text-[10px] font-black text-center leading-tight max-w-full px-1" style={{ color: '#EDE8FF', fontFamily: "'Noto Sans JP', sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 26 }}>{item.name}</span>
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: `${color}22`, border: `1px solid ${color}44`, color, fontFamily: 'monospace' }}>{rarity}</span>
        <span className="text-[9px] font-black" style={{ color: '#8b7da8', fontFamily: 'monospace' }}>R{getWeaponRank(item)}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 w-full">
        <span className="text-[8px] font-black rounded px-1 py-0.5" style={{ color: '#bca8df', background: 'rgba(255,255,255,0.04)', fontFamily: 'monospace' }}>ILv.{getWeaponIlv(item)}</span>
        <span className="text-[8px] font-black rounded px-1 py-0.5 text-right" style={{ color, background: `${color}12`, fontFamily: 'monospace' }}>ATK {baseAtk}</span>
      </div>
    </motion.button>
  );
}

function WeaponPassiveLine({ passive, rank, color }: { passive: ItemData['passiveA']; rank: number; color: string }) {
  if (!passive) return null;
  return (
    <div style={{ borderRadius: 11, border: `1px solid ${color}24`, background: 'rgba(0,0,0,0.24)', padding: '8px 9px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color: '#F0EAFF', fontWeight: 900 }}>{passive.nameJa}</span>
        {passive.systemTag && <span style={{ fontFamily: 'monospace', fontSize: 7, color, border: `1px solid ${color}44`, borderRadius: 999, padding: '1px 5px', flexShrink: 0 }}>{passive.systemTag}</span>}
      </div>
      <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 9, color: 'rgba(202,190,235,0.72)', marginTop: 4, lineHeight: 1.45 }}>{describeWeaponPassive(passive, rank)}</div>
    </div>
  );
}

function WeaponDetailPanel({ weapon, equipped, player, residues, color, onEquip }: {
  weapon: ItemData | null;
  equipped: ItemData | null;
  player: CharacterData | null;
  residues: (AbyssalResidueData | null)[];
  color: string;
  onEquip: (weapon: ItemData) => void;
}) {
  if (!weapon) {
    return (
      <div className="gothic-panel rounded-2xl p-4 shrink-0 flex items-center justify-center opacity-40" style={{ minHeight: 144 }}>
        <span className="text-[11px] tracking-widest font-bold" style={{ color: 'rgba(180,100,255,0.75)', fontFamily: 'monospace' }}>SELECT WEAPON</span>
      </div>
    );
  }

  const rarity = getWeaponRarity(weapon);
  const rarityColor = RARITY_COLOR[rarity] ?? color;
  const rank = getWeaponRank(weapon);
  const baseAtk = calculateWeaponBaseAttack(weapon);
  const residueOptions = residues.flatMap((residue) => residue ? [residue.mainStat, ...residue.subOptions] : []);
  const attackBonuses = collectWeaponAttackBonuses([...getWeaponEffectiveSubOptions(weapon), ...residueOptions]);
  const finalAtk = calculateWeaponAttackBreakdown(player?.stats.atk ?? 0, weapon, attackBonuses);
  const equippedAtk = equipped ? calculateWeaponBaseAttack(equipped) : 0;
  const diff = baseAtk - equippedAtk;
  const isEquipped = equipped?.id === weapon.id;

  return (
    <div className="gothic-panel rounded-2xl overflow-hidden relative shrink-0" style={{ minHeight: 218, borderColor: `${rarityColor}44` }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rarityColor}, transparent)` }} />
      {rarity === 'UR' && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 82% 18%, rgba(255,34,77,0.22), transparent 34%)' }} />}
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <motion.div
            animate={rarity === 'UR' ? { boxShadow: [`0 0 12px ${rarityColor}28`, `0 0 24px ${rarityColor}70`, `0 0 12px ${rarityColor}28`] } : undefined}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="shrink-0 w-[58px] h-[58px] rounded-2xl flex items-center justify-center"
            style={{ background: `radial-gradient(circle at 35% 30%, ${rarityColor}38, rgba(0,0,0,0.86))`, border: `1.5px solid ${rarityColor}66` }}
          >
            <Swords size={30} style={{ color: rarityColor }} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ color: '#F0EAFF', fontFamily: "'Cinzel Decorative', serif", fontSize: 12, fontWeight: 900, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weapon.name}</span>
              <span style={{ color: rarityColor, background: `${rarityColor}1A`, border: `1px solid ${rarityColor}44`, borderRadius: 999, padding: '2px 6px', fontFamily: 'monospace', fontSize: 8, fontWeight: 900, flexShrink: 0 }}>{rarity}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span style={{ color: rarityColor + 'CC', fontFamily: 'monospace', fontSize: 9 }}>{WEAPON_RARITY_LABEL[rarity]}</span>
              <span style={{ color: '#7f7193', fontFamily: 'monospace', fontSize: 9 }}>{WEAPON_ARCHETYPE_LABEL[getWeaponArchetype(weapon)]}</span>
              <span style={{ color: '#7f7193', fontFamily: 'monospace', fontSize: 9 }}>ILv.{getWeaponIlv(weapon)}/90</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span style={{ color: rarityColor, fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 900, lineHeight: 1, textShadow: `0 0 12px ${rarityColor}66` }}>{baseAtk}</span>
              <span style={{ color: rarityColor + 'CC', fontFamily: 'monospace', fontSize: 10, fontWeight: 900 }}>WEAPON ATK</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>共鳴</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, color: rarityColor, fontWeight: 900, lineHeight: 1 }}>R{rank}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
          <div style={{ borderRadius: 11, background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 9px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>FINAL ATK</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, color: '#F0EAFF', fontWeight: 900, marginTop: 2 }}>{finalAtk.finalAtk.toLocaleString()}</div>
          </div>
          <div style={{ borderRadius: 11, background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 9px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>ATK BONUS</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: rarityColor, fontWeight: 900, marginTop: 3 }}>{finalAtk.atkBonusPercent.toFixed(1)}%</div>
          </div>
          <div style={{ borderRadius: 11, background: 'rgba(0,0,0,0.24)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 9px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>差分</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: diff >= 0 ? '#8DFFBF' : '#FF8888', fontWeight: 900, marginTop: 3 }}>{equipped ? `${diff >= 0 ? '+' : ''}${diff}` : 'EMPTY'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <WeaponPassiveLine passive={weapon.passiveA} rank={rank} color={rarityColor} />
          <WeaponPassiveLine passive={weapon.passiveB} rank={rank} color={rarityColor} />
        </div>

        <motion.button
          type="button"
          onClick={() => onEquip(weapon)}
          whileTap={{ scale: 0.96 }}
          disabled={isEquipped}
          style={{
            minHeight: 44,
            borderRadius: 14,
            background: isEquipped ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${rarityColor}34, rgba(12,5,28,0.92))`,
            border: `1.5px solid ${isEquipped ? 'rgba(255,255,255,0.08)' : rarityColor + '77'}`,
            color: isEquipped ? '#5d5368' : rarityColor,
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.18em',
          }}
        >
          {isEquipped ? '装備中' : '装備'}
        </motion.button>
      </div>
    </div>
  );
}

function WeaponEnhancementPanel({ weapon, materials, color, onRankUp, onReforge }: {
  weapon: ItemData | null;
  materials: WeaponMaterialData[];
  color: string;
  onRankUp: (weapon: ItemData) => void;
  onReforge: (weapon: ItemData) => void;
}) {
  if (!weapon) {
    return <div className="flex-1 flex items-center justify-center opacity-40"><span style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace', fontSize: 12 }}>武器を選択</span></div>;
  }
  const rarity = getWeaponRarity(weapon);
  const rarityColor = RARITY_COLOR[rarity] ?? color;
  const rankCost = getRankUpCost(weapon);
  const reforgeCosts = getReforgeCost(weapon);
  const canRankUp = !!rankCost && hasEnoughWeaponMaterials(materials, [rankCost]);
  const canReforge = reforgeCosts.length > 0 && hasEnoughWeaponMaterials(materials, reforgeCosts);
  const targetIlv = getNextReforgeTargetIlv(weapon);

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto custom-scrollbar px-3 pt-1 pb-3 gap-3" style={{ width: '100%' }}>
      <WeaponDetailPanel weapon={weapon} equipped={weapon} player={null} residues={[]} color={color} onEquip={() => {}} />
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div className="gothic-panel rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: rarityColor, fontWeight: 900, letterSpacing: '0.12em' }}>魂の共鳴</span>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: rarityColor, fontWeight: 900 }}>R{getWeaponRank(weapon)}/5</span>
          </div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color: '#bcaee4', lineHeight: 1.5, minHeight: 46 }}>パッシブ効果量をランクVで2倍まで引き上げる。</div>
          <div style={{ borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px', marginTop: 8 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>必要素材</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: rankCost ? rarityColor : '#6a5f76', fontWeight: 900, marginTop: 3 }}>
              {rankCost ? `${rankCost.name} ${materialQty(materials, rankCost.type)}/${rankCost.quantity}` : '最大共鳴'}
            </div>
          </div>
          <button onClick={() => onRankUp(weapon)} disabled={!canRankUp} style={{ width: '100%', minHeight: 40, marginTop: 10, borderRadius: 12, background: canRankUp ? `linear-gradient(135deg, ${rarityColor}30, rgba(20,5,35,0.9))` : 'rgba(255,255,255,0.04)', border: `1px solid ${canRankUp ? rarityColor + '66' : 'rgba(255,255,255,0.08)'}`, color: canRankUp ? rarityColor : '#5d5368', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, fontWeight: 900 }}>共鳴</button>
        </div>

        <div className="gothic-panel rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#D4AF37', fontWeight: 900, letterSpacing: '0.12em' }}>打ち直し</span>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: '#D4AF37', fontWeight: 900 }}>ILv.{getWeaponIlv(weapon)}</span>
          </div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color: '#bcaee4', lineHeight: 1.5, minHeight: 46 }}>基礎ATKだけを現行ダンジョン水準へ引き上げる。</div>
          <div style={{ borderRadius: 10, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px', marginTop: 8 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#7f7193' }}>必要素材</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: targetIlv ? '#D4AF37' : '#6a5f76', fontWeight: 900, marginTop: 3, lineHeight: 1.45 }}>
              {targetIlv ? reforgeCosts.map((cost) => `${cost.name} ${materialQty(materials, cost.type)}/${cost.quantity}`).join(' / ') : '最大ILv'}
            </div>
          </div>
          <button onClick={() => onReforge(weapon)} disabled={!canReforge} style={{ width: '100%', minHeight: 40, marginTop: 10, borderRadius: 12, background: canReforge ? 'linear-gradient(135deg, rgba(212,175,55,0.26), rgba(20,5,35,0.9))' : 'rgba(255,255,255,0.04)', border: `1px solid ${canReforge ? 'rgba(212,175,55,0.62)' : 'rgba(255,255,255,0.08)'}`, color: canReforge ? '#D4AF37' : '#5d5368', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, fontWeight: 900 }}>打ち直し</button>
        </div>
      </div>
    </div>
  );
}

function WeaponDismantlePanel({ weapon, equipped, materials, color, onDismantle }: {
  weapon: ItemData | null;
  equipped: ItemData | null;
  materials: WeaponMaterialData[];
  color: string;
  onDismantle: (weapon: ItemData) => void;
}) {
  if (!weapon) return <div className="flex-1 flex items-center justify-center opacity-40"><span style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace', fontSize: 12 }}>武器を選択</span></div>;
  const rarity = getWeaponRarity(weapon);
  const rarityColor = RARITY_COLOR[rarity] ?? color;
  const rewards = calculateDismantleRewards(weapon);
  const blocked = equipped?.id === weapon.id || rewards.length === 0;

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto custom-scrollbar px-3 pt-1 pb-3 gap-3" style={{ width: '100%' }}>
      <div className="gothic-panel rounded-2xl p-4 shrink-0" style={{ borderColor: `${rarityColor}44` }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle, ${rarityColor}28, rgba(0,0,0,0.8))`, border: `1px solid ${rarityColor}55` }}>
            <Recycle size={24} style={{ color: rarityColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 12, color: '#F0EAFF', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weapon.name}</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, color: '#9b8abc', marginTop: 4 }}>不要な武器を魂のイデアへ変換する。URは怨念が固定化しているため分解不可。</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 12 }}>
          {rewards.length === 0 ? (
            <div style={{ borderRadius: 12, background: 'rgba(255,34,77,0.08)', border: '1px solid rgba(255,34,77,0.22)', padding: 10, color: '#ff8ba1', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 11, fontWeight: 800 }}>この武器は分解できません</div>
          ) : rewards.map((reward) => (
            <div key={reward.type} style={{ borderRadius: 12, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', padding: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#F0EAFF', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 11, fontWeight: 900 }}>{reward.name}</span>
              <span style={{ color: rarityColor, fontFamily: 'monospace', fontSize: 11, fontWeight: 900 }}>{materialQty(materials, reward.type)} → {materialQty(materials, reward.type) + reward.quantity}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onDismantle(weapon)} disabled={blocked} style={{ width: '100%', minHeight: 44, marginTop: 12, borderRadius: 14, background: blocked ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(255,34,77,0.28), rgba(20,5,35,0.92))', border: `1.5px solid ${blocked ? 'rgba(255,255,255,0.08)' : 'rgba(255,34,77,0.58)'}`, color: blocked ? '#5d5368' : '#ff8ba1', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 13, fontWeight: 900, letterSpacing: '0.16em' }}>
          {equipped?.id === weapon.id ? '装備中は分解不可' : rewards.length === 0 ? '分解不可' : '分解'}
        </button>
      </div>
    </div>
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
function PortraitCard({ mk, player, party, equippedResidueSlots, soulShards, demonGauge, isDemonMode, onSelect, onToggleDemon, id }: {
  mk: MemberKey; player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  soulShards: SoulShardData[]; demonGauge: number; isDemonMode: boolean;
  onSelect: () => void; onToggleDemon: () => void; id?: string;
}) {
  const conf = getConf(mk, player, party);
  const info = getMemberInfo(mk, player, party, equippedResidueSlots, soulShards);
  const color = conf.color;
  const isVacant = info.isVacant;

  const slotIcons: { icon: string; item: ItemData | AbyssalResidueData | null; label: string }[] = [
    { icon: '⚔', item: info.weapon, label: 'W' },
    ...RESIDUE_SLOT_ORDER.map((slotId, index) => ({
      icon: getResidueSlotMeta(slotId).icon,
      item: info.residues[index] ?? null,
      label: slotId,
    })),
  ];

  const showDemonBadge = mk === 'PLAYER' && demonGauge >= 100;

  return (
    <motion.button id={id} onClick={isVacant ? undefined : onSelect} whileTap={!isVacant ? { scale: 0.96 } : undefined}
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
          {/* equipment micro-icons */}
          <div className="grid grid-cols-3 gap-1">
            {slotIcons.map((s, idx) => {
              const hasItem = s.item !== null;
              const rc = hasItem && (s.item as any).rarity ? RARITY_COLOR[(s.item as any).rarity] : null;
              return (
                <div key={idx} className="flex items-center justify-center rounded" style={{ height: 20, border: hasItem ? `1px solid ${rc ?? color}66` : '1px dashed rgba(120,70,200,0.3)', background: hasItem ? `${rc ?? color}14` : 'transparent', fontSize: 10 }}>
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
  onOpenGear: (slotType: 'WEAPON' | 'RESIDUE', slotIndex: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setCurrentTab = useGameStore(state => state.setCurrentTab);
  const conf = getConf(selKey, player, party);
  const color = isDemonMode ? '#CC2222' : conf.color;
  const accent = isDemonMode ? '#ff6666' : conf.accent;
  const info = getMemberInfo(selKey, player, party, equippedResidueSlots, soulShards);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  useCanvasBg(canvasRef, conf.color, isDemonMode);

  const statProfile = useMemo(
    () => (info.isPlayer && player ? calculateCharacterStatProfile(player, equippedResidueSlots) : null),
    [info.isPlayer, player, equippedResidueSlots],
  );
  const stats = statProfile?.total ?? info.stats;
  const lvl = info.lvl ?? 1;
  const maxLvl = 80;
  const xpPct = Math.min(100, (lvl / maxLvl) * 100);

  // Build HexSlot data for left column
  const leftSlots: HexSlotData[] = [
    {
      id: 'weapon', icon: '⚔', label: '武器', sublabel: info.weapon ? (info.weapon as any).name : '空',
      filled: !!info.weapon, level: null,
      rarity: info.weapon ? getWeaponRarity(info.weapon) : null,
      locked: !info.isPlayer,
    },
  ];

  // Build HexSlot data for right column (residues)
  const rightSlots: HexSlotData[] = RESIDUE_SLOT_ORDER.map((slotId, i) => {
    const r = info.residues[i] ?? null;
    const meta = getResidueSlotMeta(slotId);
    return {
      id: `residue_${i}`, icon: meta.icon,
      label: r ? r.name : meta.nameJa,
      sublabel: r ? `${formatStat(r.mainStat.type, r.mainStat.value)} / ${getResidueScoreGrade(calculateResidueScore(r)).grade}` : meta.role,
      filled: !!r, level: r?.level ?? null,
      rarity: r?.rarity ?? null,
      locked: !info.isPlayer && i > 0,
    };
  });

  const handleLeftSelect = (id: string | null) => {
    setSelectedSlot(id);
    if (id === 'weapon') { haptic(8); onOpenGear('WEAPON', 0); }
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
      style={{ position: 'absolute', inset: 0 }}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#03010B',
          fontFamily: "'Inter', sans-serif",
        }}
        data-demon={isDemonMode ? 'true' : 'false'}
      >
      {/* Canvas bg */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.7 }} />

      {/* Full-screen ambient */}
      <FloatingOrbs color={color} />
      <ScanLine color={color} />
      {isDemonMode && <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: `radial-gradient(circle at center, ${color}40, transparent 70%)`, pointerEvents: 'none' }} />}

      {/* ── HEADER ── */}
      <div className="shrink-0 relative z-10" style={{ padding: 'max(12px, env(safe-area-inset-top, 12px)) 14px 6px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', animation: 'fadeSlideUp 0.4s ease-out', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            type="button"
            onClick={() => { haptic(5); setCurrentTab('HOME'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              alignSelf: 'flex-start',
              padding: '0 0 6px',
              color: '#8b7da8',
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <Home size={13} />
            <span>ホーム</span>
          </button>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 9, color, letterSpacing: '0.18em', textTransform: 'uppercase', textShadow: `0 0 10px ${color}` }}>統合詳細ハブ</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700, color: '#f5f0ff', letterSpacing: '0.04em', lineHeight: 1.1, textShadow: `0 0 20px ${color}60`, whiteSpace: 'nowrap' }}>
            {info.nameEn}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: accent, border: `1px solid ${accent}50`, padding: '1px 6px', borderRadius: 3, background: `${accent}10`, flexShrink: 0 }}>{info.rank}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', whiteSpace: 'nowrap' }}>{conf.label} · {info.isPlayer ? '主人公' : '軍団員'}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#6b5f7a' }}>LEVEL</div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 700, color, lineHeight: 1, textShadow: `0 0 16px ${color}` }}>{info.lvl ?? info.cost ?? '?'}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#4a3a5a' }}>/ {maxLvl}</div>
          <div style={{ width: 50, height: 3, background: '#1a1228', borderRadius: 2, marginTop: 4, marginLeft: 'auto' }}>
            <div style={{ width: `${xpPct}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${color}, ${accent})`, boxShadow: `0 0 6px ${color}` }} />
          </div>
        </div>
      </div>

      {/* Middle: absolutely-positioned slot columns flanking centered character art */}
      <div className="flex-1 min-h-0 z-10" style={{ position: 'relative' }}>

        {/* CENTER — fills the entire middle area, character centered within */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <AnimatePresence mode="wait">
            <motion.div key={selKey}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ width: 160, height: 255, position: 'relative', flexShrink: 0, marginTop: -10 }}>
              {/* Void ring glow behind character */}
              <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 110, height: 30, background: `radial-gradient(ellipse, ${color}50, transparent 70%)`, animation: 'void-pulse 2s ease-in-out infinite', pointerEvents: 'none' }} />
              {/* Character display */}
              <div style={{ width: '100%', height: '100%', position: 'relative', filter: isDemonMode ? `drop-shadow(0 0 20px ${color}) drop-shadow(0 0 40px ${color})` : `drop-shadow(0 0 8px ${color}60)`, transition: 'filter 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
                <motion.div animate={{ y: [-6, 6, -6] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 120, height: 180, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 88, background: `radial-gradient(circle at 35% 28%, ${color}2C, rgba(0,0,0,0.9))`, border: `2px solid ${color}66`, boxShadow: `0 14px 44px rgba(0,0,0,0.8), 0 0 36px ${color}2C, inset 0 0 24px rgba(0,0,0,0.55)`, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 52%)', borderRadius: 'inherit' }} />
                    <span style={{ filter: `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 4px ${color})`, lineHeight: 1, animation: 'breathe 3.2s ease-in-out infinite', transformOrigin: 'center bottom' }}>{conf.emoji}</span>
                  </div>
                  <motion.div animate={{ scaleX: [1, 1.3, 1], opacity: [0.28, 0.07, 0.28] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 80, height: 10, background: `radial-gradient(ellipse, ${color}77, transparent)`, filter: 'blur(6px)', borderRadius: 999, margin: '6px auto 0' }} />
                </motion.div>
              </div>
              {/* Level ring */}
              <svg style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', opacity: 0.6 }} width="90" height="30" viewBox="0 0 90 30">
                <ellipse cx="45" cy="15" rx="42" ry="10" fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
                  style={{ animation: 'magic-spin 12s linear infinite', transformOrigin: '45px 15px' }} />
              </svg>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* LEFT column — outer div: positioning only (no animation, so translateY(-50%) is never overridden) */}
        <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 112, zIndex: 2 }}>
          {/* Inner div: animation only (translateX won't conflict with parent's translateY) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'slideInLeft 0.5s ease-out 0.2s both' }}>
            {leftSlots.map((slot, i) => (
              <HexSlot key={slot.id} slot={slot} selected={selectedSlot} onSelect={handleLeftSelect} color={color} delay={0.15 + i * 0.06} />
            ))}
            <div
              onClick={() => selectedSlot && handleLeftSelect(selectedSlot)}
              style={{
                marginTop: 2, padding: '6px 8px',
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
        </div>

        {/* RIGHT column — outer div: positioning only (no animation, so translateY(-50%) is never overridden) */}
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 112, zIndex: 2 }}>
          {/* Inner div: animation only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'slideInRight 0.5s ease-out 0.2s both' }}>
            {rightSlots.map((slot, i) => (
              <HexSlot key={slot.id} slot={slot} selected={selectedSlot} onSelect={handleRightSelect} color={color} delay={0.15 + i * 0.06} isVoid />
            ))}
            <div
              onClick={() => {
                const idx = selectedSlot?.startsWith('residue_') ? parseInt(selectedSlot.replace('residue_', '')) : 0;
                haptic([10, 8, 18]); onOpenGear('RESIDUE', Number.isFinite(idx) ? idx : 0);
              }}
              style={{
                marginTop: 2, padding: '6px 8px',
                background: `linear-gradient(135deg, ${color}22, ${color}0C)`,
                border: `1px solid ${color}48`,
                borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600,
                color, letterSpacing: '0.08em',
                boxShadow: `0 0 10px ${color}28`,
                animation: 'glow-pulse 2.5s ease-in-out infinite',
                position: 'relative', overflow: 'hidden',
              }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(90deg, transparent, ${color}14, transparent)`, backgroundSize: '200% 100%', animation: 'shimmer 2s infinite', pointerEvents: 'none' }} />
              強化
            </div>
          </div>
        </div>
      </div>

      {/* Stats panel */}
      <div className="shrink-0 relative z-10" style={{ margin: '0 12px 8px', padding: '12px 8px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: `1px solid ${color}30`, borderRadius: 14, backdropFilter: 'blur(10px)', boxShadow: `0 0 20px ${color}15, inset 0 1px 0 rgba(255,255,255,0.06)`, animation: 'fadeSlideUp 0.5s ease-out 0.4s both' }}>
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
          <StatItem label="SPD" labelJa="速度" value={stats?.spd ?? 0} color={color} delay={0.55} />
          <div style={{ width: 1, background: `${color}18`, alignSelf: 'stretch' }} />
          <StatItem label="HP" labelJa="体力" value={stats?.hp ?? 0} color={color} delay={0.6} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8, marginTop: 9 }}>
          <div style={{ display: 'flex', gap: 6, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b7da8', whiteSpace: 'nowrap' }}>CR {formatStatValue('critRate', stats?.critRate ?? 0)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b7da8', whiteSpace: 'nowrap' }}>CD {formatStatValue('critDmg', stats?.critDmg ?? 0)}</span>
            {statProfile && (
              <span style={{ fontFamily: 'monospace', fontSize: 9, color, whiteSpace: 'nowrap' }}>
                属性 {Math.max(...ELEMENT_DAMAGE_KEYS.map((element) => statProfile.elementDmgBoosts[element] ?? 0)).toFixed(1)}%
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { haptic(5); setShowStatusSheet(true); }}
            style={{
              minHeight: 28,
              borderRadius: 9,
              padding: '0 10px',
              background: `linear-gradient(135deg, ${color}22, rgba(255,255,255,0.04))`,
              border: `1px solid ${color}55`,
              color,
              fontFamily: "'Cinzel', serif",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
              boxShadow: `0 0 10px ${color}22`,
            }}
          >
            詳細
          </button>
        </div>
      </div>

      <AnimatePresence>
        <StatusDetailSheet
          open={showStatusSheet}
          name={info.nameEn}
          subtitle={`${conf.label} / ${info.isPlayer ? '主人公ステータス' : '軍団員ステータス'}`}
          stats={stats}
          profile={statProfile}
          currentEnergy={info.isPlayer ? player?.currentEnergy : undefined}
          maxEnergy={info.isPlayer ? player?.maxEnergy : undefined}
          color={color}
          accent={accent}
          onClose={() => setShowStatusSheet(false)}
        />
      </AnimatePresence>

      {/* Thumb strip + Formation button */}
      <div className="shrink-0 relative z-10" style={{ padding: '8px 12px 12px', background: 'linear-gradient(0deg, rgba(5,2,15,0.98), transparent)', animation: 'fadeSlideUp 0.5s ease-out 0.5s both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}20`, borderRadius: 16, padding: '10px 14px', backdropFilter: 'blur(8px)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
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
          <div onClick={() => { haptic(5); onBack(); }} style={{ padding: '8px 12px', background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `1px solid ${color}60`, borderRadius: 10, cursor: 'pointer', boxShadow: `0 0 12px ${color}30`, flexShrink: 0, transition: 'all 0.2s ease' }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 700, color, letterSpacing: '0.05em', textAlign: 'center' }}>編成</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 7, color: accent + '80', textAlign: 'center', marginTop: 1 }}>Formation</div>
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   GEAR HUB VIEW
────────────────────────────────────────── */
type GearSlotType = 'WEAPON' | 'RESIDUE';
interface GearCtx { mk: MemberKey; slotType: GearSlotType; slotIndex: number }

function GearHubView({ gearCtx, player, party, equippedResidueSlots, abyssalResidues, residueMaterials, weaponMaterials, inventoryItems, transmutationPoints, onBack }: {
  gearCtx: GearCtx; player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  abyssalResidues: AbyssalResidueData[]; residueMaterials: ResidueMatData[];
  weaponMaterials: WeaponMaterialData[];
  inventoryItems: ItemData[]; transmutationPoints: number; onBack: () => void;
}) {
  const { equipResidueToSlot, upgradeResidue, equipItem, rankUpWeapon, reforgeWeapon, dismantleWeapon } = useGameStore();
  const sound = useGothicSound();
  const conf = getConf(gearCtx.mk, player, party);
  const color = conf.color;
  const [tab, setTab] = useState<'EQUIP' | 'ENHANCE' | 'TRANSMUTE' | 'DISMANTLE'>('EQUIP');
  const [activeResidueSlotIndex, setActiveResidueSlotIndex] = useState(gearCtx.slotIndex);
  const [selectedResidueId, setSelectedResidueId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedMatIds, setSelectedMatIds] = useState<Set<string>>(new Set());

  const isResidueSlot = gearCtx.slotType === 'RESIDUE';
  const activeResidueSlotId: ResidueSlotId = RESIDUE_SLOT_ORDER[activeResidueSlotIndex] ?? 'chest';
  const activeResidueSlotMeta = getResidueSlotMeta(activeResidueSlotId);
  const slotLabel = isResidueSlot
    ? activeResidueSlotMeta.nameJa
    : '武器';

  const info = getMemberInfo(gearCtx.mk, player, party, equippedResidueSlots, []);
  const memberName = info.nameEn;

  const equippedIds = useMemo(() => new Set(equippedResidueSlots.filter(Boolean).map(s => s!.id)), [equippedResidueSlots]);

  const selectedResidue = abyssalResidues.find(r => r.id === selectedResidueId) ?? null;
  const filteredResidues = useMemo(
    () => abyssalResidues
      .filter((r) => getResidueSlotId(r) === activeResidueSlotId)
      .sort((a, b) => calculateResidueScore(b) - calculateResidueScore(a)),
    [abyssalResidues, activeResidueSlotId],
  );
  const activeEquippedResidue = equippedResidueSlots[activeResidueSlotIndex] ?? null;
  const totalExpGain = useMemo(() =>
    [...selectedMatIds].reduce((acc, id) => { const mat = residueMaterials.find(m => m.id === id); return acc + (mat ? mat.expValue * mat.quantity : 0); }, 0),
    [selectedMatIds, residueMaterials],
  );

  const filteredItems = useMemo(() => {
    return inventoryItems
      .filter(i => i.type === 'WEAPON')
      .sort((a, b) => getWeaponSortScore(b) - getWeaponSortScore(a));
  }, [inventoryItems]);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? null;

  useEffect(() => {
    if (!isResidueSlot) return;
    if (selectedResidueId && filteredResidues.some((r) => r.id === selectedResidueId)) return;
    setSelectedResidueId(activeEquippedResidue?.id ?? filteredResidues[0]?.id ?? null);
  }, [activeEquippedResidue?.id, filteredResidues, isResidueSlot, selectedResidueId]);

  useEffect(() => {
    if (isResidueSlot) return;
    if (selectedItemId && filteredItems.some((item) => item.id === selectedItemId)) return;
    setSelectedItemId(info.weapon?.id ?? filteredItems[0]?.id ?? null);
  }, [filteredItems, info.weapon?.id, isResidueSlot, selectedItemId]);

  const handleEquipResidue = () => {
    if (!selectedResidue) return;
    sound.playEquip(); haptic([8, 4, 14]);
    equipResidueToSlot(activeResidueSlotIndex, selectedResidue);
  };

  const handleEquipItem = (item: ItemData) => {
    if (!player) return;
    sound.playEquip(); haptic([8, 4, 14]);
    equipItem('weapon', item);
  };

  const handleRankUpWeapon = (item: ItemData) => {
    sound.playEquip(); haptic([8, 4, 18]);
    rankUpWeapon(item.id);
  };

  const handleReforgeWeapon = (item: ItemData) => {
    sound.playEquip(); haptic([10, 6, 20]);
    reforgeWeapon(item.id);
  };

  const handleDismantleWeapon = (item: ItemData) => {
    sound.playEquip(); haptic([15, 8, 28]);
    dismantleWeapon(item.id);
    setSelectedItemId(null);
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
      style={{ position: 'absolute', inset: 0 }}
    >
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #050115 0%, #07021A 100%)',
        width: '100%',
        maxWidth: 430,
        margin: '0 auto',
      }}
    >
      {/* Navbar */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 relative z-10"
        style={{
          minHeight: 44,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          borderBottom: `1px solid ${color}18`,
        }}
      >
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
        {(isResidueSlot ? (['EQUIP', 'ENHANCE', 'TRANSMUTE'] as const) : (['EQUIP', 'ENHANCE', 'DISMANTLE'] as const)).map(t => (
          <button key={t} onClick={() => { haptic(5); setTab(t); }}
            className="flex-1 py-2.5 text-[12px] font-black tracking-[0.12em] relative transition-colors"
            style={{ color: tab === t ? '#F0EAFF' : 'rgba(185,165,230,0.36)', fontFamily: 'monospace', background: tab === t ? `linear-gradient(135deg, ${color}22, ${color}09)` : 'transparent' }}>
            {t === 'EQUIP' ? '装備' : t === 'ENHANCE' ? (isResidueSlot ? '強化' : '共鳴') : t === 'TRANSMUTE' ? '錬成' : '分解'}
            {tab === t && <motion.div layoutId="gear-tab-line" className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative mt-2" style={{ width: '100%', alignSelf: 'stretch' }}>
        <AnimatePresence mode="wait">
          {tab === 'EQUIP' ? (
            <motion.div key="equip" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.16 }} className="absolute inset-0 flex flex-col overflow-hidden" style={{ position: 'absolute', inset: 0, width: '100%' }}>
              {isResidueSlot ? (
                <>
                  <ResidueSlotRail
                    slots={equippedResidueSlots}
                    activeIndex={activeResidueSlotIndex}
                    color={color}
                    onSelect={(index) => { sound.playTap(); setActiveResidueSlotIndex(index); }}
                  />
                  <div className="shrink-0 px-3 pb-2">
                    <ResidueDetailPanel
                      residue={selectedResidue}
                      equipped={activeEquippedResidue}
                      color={color}
                      onEquip={handleEquipResidue}
                      equipDisabled={!selectedResidue || equippedIds.has(selectedResidue.id) || !isResidueSlotCompatible(selectedResidue, activeResidueSlotIndex)}
                    />
                  </div>
                  <div className="shrink-0 px-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: 'rgba(185,110,255,0.9)', fontFamily: 'monospace' }}>
                      {activeResidueSlotMeta.nameJa} — {filteredResidues.length}個
                    </span>
                    <span className="text-[9px] font-black" style={{ color: '#7f7193', fontFamily: 'monospace' }}>SCORE順</span>
                  </div>
                  <VirtualResidueGrid items={filteredResidues} selectedId={selectedResidueId} equippedIds={equippedIds} onSelect={id => { sound.playTap(); setSelectedResidueId(id); }} />
                </>
              ) : (
                <>
                  <div className="shrink-0 px-3 pb-2">
                    <WeaponDetailPanel
                      weapon={selectedItem}
                      equipped={info.weapon}
                      player={player}
                      residues={equippedResidueSlots}
                      color={color}
                      onEquip={handleEquipItem}
                    />
                  </div>
                  <div className="shrink-0 px-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: 'rgba(185,110,255,0.9)', fontFamily: 'monospace' }}>⚔ 武器庫 — {filteredItems.length}本</span>
                    <span className="text-[9px] font-black" style={{ color: '#7f7193', fontFamily: 'monospace' }}>RARITY順</span>
                  </div>
                  {filteredItems.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center opacity-30">
                      <span className="text-[12px]" style={{ color: 'rgba(180,100,255,0.7)', fontFamily: 'monospace' }}>武器なし</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
                      <div className="grid grid-cols-2 gap-3 pb-4 pt-1">
                        {filteredItems.map(item => (
                          <WeaponGridCard key={item.id} item={item} isSelected={selectedItemId === item.id}
                            isEquipped={info.weapon?.id === item.id}
                            onSelect={() => { sound.playTap(); setSelectedItemId(item.id); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : tab === 'TRANSMUTE' ? (
            <TransmutationPanel
              activeSlotIndex={activeResidueSlotIndex}
              points={transmutationPoints}
              color={color}
            />
          ) : tab === 'DISMANTLE' ? (
            <WeaponDismantlePanel
              weapon={selectedItem}
              equipped={info.weapon}
              materials={weaponMaterials}
              color={color}
              onDismantle={handleDismantleWeapon}
            />
          ) : (
            <motion.div key="enhance" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.16 }} className="absolute inset-0 flex flex-col overflow-hidden px-3 pt-1 pb-3 gap-2" style={{ position: 'absolute', inset: 0, width: '100%' }}>
              {isResidueSlot ? (
                <>
                  {/* Residue selector for enhance */}
                  <ResidueSlotRail
                    slots={equippedResidueSlots}
                    activeIndex={activeResidueSlotIndex}
                    color={color}
                    onSelect={(index) => { sound.playTap(); setActiveResidueSlotIndex(index); }}
                  />
                  <div className="shrink-0 flex gap-2 pt-1 overflow-x-auto custom-scrollbar pb-1">
                    {filteredResidues.slice(0, 6).map(r => (
                      <motion.button key={r.id} onClick={() => { sound.playTap(); setSelectedResidueId(r.id); }} whileTap={{ scale: 0.92 }}
                        className="rounded-xl py-1.5 flex flex-col items-center gap-0.5 relative shrink-0"
                        style={{ width: 72, height: 66, background: selectedResidueId === r.id ? `linear-gradient(160deg, ${RARITY_GLOW[r.rarity]}, rgba(12,5,28,0.92))` : 'rgba(12,6,28,0.7)', border: `1.5px solid ${selectedResidueId === r.id ? RARITY_COLOR[r.rarity] + 'BB' : 'rgba(130,70,200,0.35)'}` }}>
                        <ResidueIcon rarity={r.rarity} size={22} />
                        <span className="text-[8px] font-black truncate max-w-full px-0.5" style={{ color: RARITY_COLOR[r.rarity], fontFamily: 'monospace' }}>{formatStat(r.mainStat.type, r.mainStat.value)}</span>
                        <ResidueScoreBadge residue={r} compact />
                      </motion.button>
                    ))}
                  </div>
                  <StatsComparison residue={selectedResidue} expGain={totalExpGain} />
                  <div className="gothic-panel rounded-2xl p-3 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: 'rgba(185,110,255,0.92)', fontFamily: 'monospace' }}>強化TIER履歴</span>
                      {selectedResidue && <ResidueScoreBadge residue={selectedResidue} compact />}
                    </div>
                    <ResidueGrowthTrack residue={selectedResidue} />
                  </div>
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
                <WeaponEnhancementPanel
                  weapon={selectedItem}
                  materials={weaponMaterials}
                  color={color}
                  onRankUp={handleRankUpWeapon}
                  onReforge={handleReforgeWeapon}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   SYNERGY BANNER  (Star Rail style)
────────────────────────────────────────── */
function SynergyNodeRow({ party }: { party: (MonsterData | null)[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8 }}>
      {party.map((m, i) => {
        const conf = m ? (TRIBE[m.tribe] ?? TRIBE.HUMANOID) : VACANT_CONF;
        const nextM = i < party.length - 1 ? party[i + 1] : null;
        const sameAsNext = m && nextM && m.tribe === nextM.tribe;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < party.length - 1 ? 1 : undefined }}>
            {/* 種族ノード */}
            <motion.div
              animate={m ? {
                boxShadow: [
                  `0 0 8px ${conf.color}55, 0 0 16px ${conf.color}22`,
                  `0 0 14px ${conf.color}88, 0 0 26px ${conf.color}44`,
                  `0 0 8px ${conf.color}55, 0 0 16px ${conf.color}22`,
                ],
              } : {}}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: m
                  ? `radial-gradient(circle at 38% 30%, ${conf.color}30, rgba(0,0,0,0.88))`
                  : 'rgba(40,30,60,0.5)',
                border: `1.5px solid ${m ? conf.color + '66' : 'rgba(100,70,160,0.25)'}`,
                position: 'relative',
              }}
            >
              {m && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 52%)',
                }} />
              )}
              <span style={{
                fontSize: 20, lineHeight: 1,
                filter: m ? `drop-shadow(0 0 6px ${conf.color})` : 'none',
                opacity: m ? 1 : 0.25,
              }}>
                {m ? conf.emoji : '+'}
              </span>
              {m && (
                <span style={{
                  fontSize: 7, fontFamily: 'monospace', fontWeight: 900,
                  color: conf.color, letterSpacing: '0.05em', marginTop: 1,
                  textShadow: `0 0 4px ${conf.color}`,
                }}>
                  {conf.label}
                </span>
              )}
            </motion.div>
            {/* 接続線 */}
            {i < party.length - 1 && (
              <motion.div
                animate={sameAsNext ? {
                  opacity: [0.6, 1, 0.6],
                } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  flex: 1, height: 2, margin: '0 4px',
                  background: sameAsNext
                    ? `linear-gradient(90deg, ${conf.color}55, ${conf.color}CC, ${conf.color}55)`
                    : 'rgba(80,60,120,0.2)',
                  boxShadow: sameAsNext ? `0 0 6px ${conf.color}88` : 'none',
                  borderRadius: 1,
                  transition: 'background 0.4s, box-shadow 0.4s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SynergyPanel({ synergy }: { synergy: ActiveSynergy }) {
  const isLayer2 = synergy.layer === 2;
  const isLayer3 = synergy.layer === 3;

  const borderColor = isLayer2
    ? 'rgba(255,210,0,0.55)'
    : isLayer3
      ? 'rgba(180,100,255,0.50)'
      : 'rgba(160,140,220,0.32)';
  const bgGrad = isLayer2
    ? 'linear-gradient(135deg, rgba(255,200,0,0.09) 0%, rgba(0,0,0,0) 60%)'
    : isLayer3
      ? 'linear-gradient(135deg, rgba(160,80,255,0.09) 0%, rgba(0,0,0,0) 60%)'
      : 'linear-gradient(135deg, rgba(120,100,200,0.06) 0%, rgba(0,0,0,0) 60%)';
  const badge = isLayer2 ? '★ FULL' : isLayer3 ? '◆ CROSS' : '◇ PART';
  const badgeColor = isLayer2 ? '#FFD700' : isLayer3 ? '#C080FF' : '#9090C0';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      style={{
        background: bgGrad,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: '7px 10px',
        marginBottom: 5,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景グロー */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 0% 50%, ${synergy.color}12 0%, transparent 55%)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        {/* 種族カラーライン */}
        <div style={{
          width: 3, height: 34, borderRadius: 2, flexShrink: 0,
          background: `linear-gradient(180deg, ${synergy.color}, ${synergy.accentColor})`,
          boxShadow: `0 0 6px ${synergy.color}88`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 12, fontFamily: "'Cinzel Decorative', serif", fontWeight: 900,
              color: synergy.color, textShadow: `0 0 10px ${synergy.color}88`,
              letterSpacing: '0.05em',
            }}>
              {synergy.name}
            </span>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', color: 'rgba(160,140,210,0.55)',
              letterSpacing: '0.1em', whiteSpace: 'nowrap',
            }}>
              {synergy.nameEn}
            </span>
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'monospace',
            color: 'rgba(210,200,240,0.72)',
            marginTop: 2, letterSpacing: '0.04em',
          }}>
            {synergy.effectDesc}
          </div>
        </div>
        {/* バッジ */}
        <motion.span
          animate={{ textShadow: [
            `0 0 5px ${badgeColor}55`,
            `0 0 10px ${badgeColor}99`,
            `0 0 5px ${badgeColor}55`,
          ]}}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: 8, fontWeight: 900, fontFamily: 'monospace',
            color: badgeColor, letterSpacing: '0.15em',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {badge}
        </motion.span>
      </div>
    </motion.div>
  );
}

function SynergyBanner({ party }: { party: (MonsterData | null)[] }) {
  const [expanded, setExpanded] = useState(true);
  const monsters = (party as (MonsterData | null)[]).filter(Boolean) as MonsterData[];
  const synergies = getActiveSynergies(monsters);
  const hasAny = synergies.length > 0;
  const hasLayer2 = synergies.some(s => s.layer === 2);

  const outerBorder = hasLayer2
    ? 'rgba(255,200,0,0.22)'
    : hasAny
      ? 'rgba(140,100,220,0.22)'
      : 'rgba(80,60,120,0.18)';

  return (
    <motion.div
      layout
      style={{
        background: 'rgba(4,2,16,0.72)',
        border: `1px solid ${outerBorder}`,
        borderRadius: 14,
        padding: '8px 10px 6px',
        backdropFilter: 'blur(8px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 上部ヘッダー */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'transparent', border: 0, padding: 0,
          marginBottom: 8, cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasLayer2 && (
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: 9, color: '#FFD700' }}
            >
              ✦
            </motion.span>
          )}
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 900,
            color: hasAny ? 'rgba(200,180,255,0.75)' : 'rgba(100,80,140,0.5)',
            letterSpacing: '0.25em',
          }}>
            SYNERGY FORMATION
          </span>
        </div>
        <span style={{
          fontSize: 9, color: 'rgba(130,100,180,0.5)',
          fontFamily: 'monospace', transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>
          ▾
        </span>
      </button>

      {/* 種族ノード行 */}
      <SynergyNodeRow party={party as (MonsterData | null)[]} />

      {/* シナジーパネル */}
      <AnimatePresence mode="sync">
        {expanded && hasAny && synergies.map(s => (
          <SynergyPanel key={s.key} synergy={s} />
        ))}
        {expanded && !hasAny && (
          <motion.div
            key="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              textAlign: 'center',
              color: 'rgba(100,80,140,0.45)',
              fontSize: 9, fontFamily: 'monospace',
              padding: '4px 0', letterSpacing: '0.15em',
            }}
          >
            SYNERGY: NONE
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   LEGION LIST VIEW
────────────────────────────────────────── */
function LegionListView({ player, party, equippedResidueSlots, soulShards, demonGauge, isDemonMode, onSelect, onToggleDemon, onBack }: {
  player: CharacterData | null; party: (MonsterData | null)[];
  equippedResidueSlots: (AbyssalResidueData | null)[];
  soulShards: SoulShardData[]; demonGauge: number; isDemonMode: boolean;
  onSelect: (k: MemberKey) => void; onToggleDemon: () => void; onBack: () => void;
}) {
  const setCurrentTab = useGameStore(state => state.setCurrentTab);
  const necroStatus = useGameStore(state => state.necroStatus);
  const totalCost = (party as (MonsterData | null)[]).reduce((s, m) => s + (m?.cost ?? 0), 0);
  const maxCost = necroStatus?.maxCost ?? 10;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col"
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #03010B 0%, #060220 60%, #020110 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(188,24,242,0.11) 0%, transparent 68%)' }} />

      {/* Header */}
      <div
        className="shrink-0 px-4 pb-3 relative z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={() => { haptic(5); setCurrentTab('HOME'); }}
              className="flex items-center gap-1 pb-1"
              style={{ color: '#8b7da8', fontFamily: 'monospace', fontSize: 10, background: 'transparent', border: 0 }}
            >
              <Home size={12} />
              <span>ホーム</span>
            </button>
            <div className="text-[22px] font-black tracking-[0.3em] leading-tight" style={{ color: '#E090FF', fontFamily: "'Cinzel Decorative', serif", textShadow: '0 0 18px rgba(196,28,250,0.58)' }}>LEGION</div>
            <div className="text-[11px] font-bold tracking-[0.2em] mt-0.5" style={{ color: 'rgba(182,165,232,0.52)', fontFamily: 'monospace' }}>ARMY FORMATION</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <motion.button onClick={() => { haptic(5); onBack(); }} whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl mb-1"
              style={{ background: 'rgba(10,5,26,0.88)', border: '1px solid rgba(140,60,220,0.36)', color: 'rgba(200,160,255,0.85)' }}>
              <ChevronLeft size={13} />
              <span className="text-[10px] font-black tracking-wider" style={{ fontFamily: 'monospace' }}>DETAIL</span>
            </motion.button>
            <div id="tut-cost-display" className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl" style={{ background: 'rgba(136,0,228,0.14)', border: '1px solid rgba(148,0,238,0.32)' }}>
              <span className="text-[12px] font-black" style={{ color: '#E090FF', fontFamily: 'monospace' }}>COST {totalCost}/{maxCost}</span>
            </div>
            <div className="w-[100px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(136,0,228,0.2)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (totalCost / maxCost) * 100)}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #8B00FF, #DD22FF)' }} />
            </div>
          </div>
        </div>
        <div className="mt-2.5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,28,250,0.32), transparent)' }} />
      </div>

      {/* Synergy Banner */}
      <div id="tut-synergy-banner" className="px-3 pb-2 shrink-0 relative z-10">
        <SynergyBanner party={party as (MonsterData | null)[]} />
      </div>

      {/* 2×2 portrait grid */}
      <div className="flex-1 px-3 pb-3 relative z-10 overflow-hidden min-h-0">
        <div className="grid grid-cols-2 gap-3 h-full">
          {MEMBER_KEYS.map(k => (
            <PortraitCard key={k} id={k === 'MONSTER_0' ? 'tut-party-slot-0' : undefined} mk={k} player={player} party={party as (MonsterData | null)[]}
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
  const { player, party, equippedResidueSlots, soulShards, abyssalResidues, residueMaterials, weaponMaterials, inventoryItems, transmutationPoints, demonGauge, isDemonMode, toggleDemonMode } = useGameStore();
  const activeTutorialPhase = useTutorialStore(s => s.activePhase);
  const sound = useGothicSound();
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'GEAR'>('DETAIL');
  const [selKey, setSelKey] = useState<MemberKey | null>('PLAYER');
  const [gearCtx, setGearCtx] = useState<GearCtx | null>(null);

  const openDetail = useCallback((k: MemberKey) => { sound.playTap(); setSelKey(k); setView('DETAIL'); }, [sound]);
  const goBackToList = useCallback(() => { haptic(5); sound.playTap(); setView('LIST'); }, [sound]);
  const goBackToDetail = useCallback(() => { haptic(5); sound.playTap(); setView('DETAIL'); setGearCtx(null); }, [sound]);
  const goBackFromList = useCallback(() => { haptic(5); sound.playTap(); if (selKey) setView('DETAIL'); }, [sound, selKey]);

  useEffect(() => {
    if (activeTutorialPhase === 'PARTY_FORMATION') {
      setView('LIST');
    }
  }, [activeTutorialPhase]);

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
            onSelect={openDetail} onToggleDemon={() => { haptic([15, 10, 30]); toggleDemonMode(); }}
            onBack={goBackFromList} />
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
            weaponMaterials={weaponMaterials}
            inventoryItems={inventoryItems as ItemData[]}
            transmutationPoints={transmutationPoints}
            onBack={goBackToDetail} />
        )}
      </AnimatePresence>
    </div>
  );
}
