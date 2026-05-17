'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useGameStore } from '../../store/useGameStore';
import ResultScreen from './ResultScreen';
import jobsData from '../../data/master/jobs.json';
import skillsData from '../../data/master/skills.json';
import stagesData from '../../data/master/stages.json';
import enemiesData from '../../data/master/enemies.json';
import itemsData from '../../data/master/items.json';
import demonFormsData from '../../data/master/demonForms.json';
import { getJobLevel, resolveUnlockedJobSkills } from '../../logic/JobSystem';
import { startTutorialBattlePhase } from '../../hooks/useTutorialTrigger';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { RewardService, type StageDropResult } from '../../services/RewardService';
import { calculateCharacterStatProfile } from '../../logic/StatSystem';
import {
  DEMON_ACTION_LIMIT,
  canActivateDemonMode,
  getDemonActionHitCount,
  getDemonDamageMultiplier,
  getDemonIncomingDamageMultiplier,
  getDemonRiskLabel,
  shouldBypassDefense,
} from '../../logic/DemonizationSystem';
import {
  AILMENT_UI,
  applyStatusEffect,
  clearStatusEffectsByDemonize,
  getAilmentAttackMultiplier,
  getSkillAilment,
  processStatusEffects,
  tryApplyAilment,
} from '../../logic/StatusAilmentSystem';
import type { AilmentType, BossGimmick, DemonFormData, DropEntry, ElementType, EnemyData, EnemyTier, JobData, SkillAttackType, SkillData, StageData, StatusEffect } from '../../types/game';

interface BattleCanvasProps {
  stageId?: string;
  onEnd: () => void;
}

type BattleSkill = {
  id: string;
  name: string;
  mp?: number;
  cost?: string;
  power: number;
  icon: string;
  aoe: boolean;
  element: ElementType;
  attackType: SkillAttackType;
  ailmentType?: AilmentType;
  ailmentBaseRate?: number;
};

interface ActiveSkillEffect {
  id: number;
  name: string;
  element: ElementType;
  attackType: SkillAttackType;
  targetIds: number[];
  aoe: boolean;
}

interface DemonBurstState {
  id: number;
  form: DemonFormData;
}

interface FormationBadgeMeta {
  icon: string;
  label: string;
  color: string;
  short: string;
}

// ── ENEMY STATE ───────────────────────────────────────────────────────────────
interface EnemyState {
  id: number; sourceId?: string; name: string; nameEn: string;
  hp: number; maxHp: number; atk: number; color: string;
  effectHit?: number; effectRes?: number;
  pos: 'left' | 'center' | 'right'; size: number;
  tier?: EnemyTier; weaknesses?: ElementType[];
  shieldHp?: number; maxShieldHp?: number; shieldBroken?: boolean;
  statusEffects?: StatusEffect[];
  statusPulse?: AilmentType;
  sprite?: 'WRAITH' | 'GIANT' | 'WYRM';
  gimmicks?: BossGimmick[];
  targeted: boolean; hit?: boolean;
}

type BattleWave = {
  title: string;
  label: string;
  role?: 'WARMUP' | 'SHIELD' | 'BOSS';
  intent?: string;
  isBoss?: boolean;
  rewards: { exp: number; gold: number };
  enemies: EnemyState[];
};

const INIT_ENEMIES: EnemyState[] = [
  { id: 0, name: '霊体騎士', nameEn: 'WRAITH KNIGHT', hp: 340, maxHp: 340, atk: 85,  color: '#06b6d4', pos: 'left',   size: 0.78, targeted: false },
  { id: 1, name: '骨巨人',   nameEn: 'BONE GIANT',    hp: 580, maxHp: 580, atk: 120, color: '#8A2BE2', pos: 'center', size: 0.88, targeted: true  },
  { id: 2, name: '死骨竜',   nameEn: 'UNDEAD WYRM',   hp: 420, maxHp: 420, atk: 100, color: '#ef4444', pos: 'right',  size: 0.80, targeted: false },
];

const BATTLE_WAVES = [
  {
    title: '骸骨山脈',
    label: 'WAVE 1',
    rewards: { exp: 520, gold: 1200 },
    enemies: [
      { ...INIT_ENEMIES[0], hp: 260, maxHp: 260, targeted: true },
      { ...INIT_ENEMIES[1], hp: 320, maxHp: 320, targeted: false, size: 0.78 },
    ],
  },
  {
    title: '骸骨山脈',
    label: 'WAVE 2',
    rewards: { exp: 760, gold: 1800 },
    enemies: [
      { ...INIT_ENEMIES[0], hp: 360, maxHp: 360, targeted: false },
      { ...INIT_ENEMIES[1], hp: 520, maxHp: 520, targeted: true },
      { ...INIT_ENEMIES[2], hp: 380, maxHp: 380, targeted: false, size: 0.72 },
    ],
  },
  {
    title: '骸骨山脈',
    label: 'BOSS',
    isBoss: true,
    rewards: { exp: 1320, gold: 3600 },
    enemies: [
      { ...INIT_ENEMIES[2], id: 2, name: '死骨竜王', nameEn: 'BONE WYRM LORD', hp: 720, maxHp: 720, atk: 148, targeted: true, pos: 'center' as const, size: 0.98 },
    ],
  },
] satisfies BattleWave[];

// ── SKILLS / ITEMS ─────────────────────────────────────────────────────────────
const SKILLS: BattleSkill[] = [
  { id: 'mock_fire',    name: '火葬弾',   mp: 12, power: 260, icon: '🔥', aoe: false, element: 'FIRE',    attackType: 'MAGIC' },
  { id: 'mock_water',   name: '水葬渦',   mp: 14, power: 210, icon: '💧', aoe: true,  element: 'WATER',   attackType: 'MAGIC' },
  { id: 'mock_thunder', name: '雷鳴斬り', mp: 10, power: 300, icon: '⚡', aoe: false, element: 'THUNDER', attackType: 'SLASH' },
  { id: 'mock_earth',   name: '岩崩し',   mp: 11, power: 230, icon: '◆',  aoe: true,  element: 'EARTH',   attackType: 'STRIKE' },
  { id: 'mock_wind',    name: '鎌鼬',     mp: 8,  power: 190, icon: '✦',  aoe: true,  element: 'WIND',    attackType: 'SLASH' },
];
const ITEMS = [
  { id: 0, name: '冥界薬',   desc: 'HP+200 回復', count: 3, icon: '🧪', effect: 'heal',   value: 200 },
  { id: 1, name: 'エーテル', desc: 'EN全回復',     count: 2, icon: '💎', effect: 'mpHeal', value: 100 },
];

const ELEMENT_VFX: Record<ElementType, { label: string; color: string; glow: string; soft: string; aura: string }> = {
  FIRE:    { label: '炎', color: '#ff5a1f', glow: 'rgba(255,90,31,0.72)',  soft: 'rgba(255,90,31,0.18)',  aura: 'radial-gradient(circle, rgba(255,90,31,0.38), transparent 64%)' },
  WATER:   { label: '水', color: '#38bdf8', glow: 'rgba(56,189,248,0.72)', soft: 'rgba(56,189,248,0.18)', aura: 'radial-gradient(circle, rgba(56,189,248,0.32), transparent 64%)' },
  THUNDER: { label: '雷', color: '#fde047', glow: 'rgba(253,224,71,0.78)', soft: 'rgba(253,224,71,0.18)', aura: 'radial-gradient(circle, rgba(253,224,71,0.36), transparent 64%)' },
  EARTH:   { label: '土', color: '#a16207', glow: 'rgba(161,98,7,0.70)',   soft: 'rgba(161,98,7,0.20)',   aura: 'radial-gradient(circle, rgba(161,98,7,0.34), transparent 64%)' },
  WIND:    { label: '風', color: '#7dd3fc', glow: 'rgba(125,211,252,0.70)', soft: 'rgba(125,211,252,0.16)', aura: 'radial-gradient(circle, rgba(125,211,252,0.28), transparent 64%)' },
  ICE:     { label: '氷', color: '#93c5fd', glow: 'rgba(147,197,253,0.72)', soft: 'rgba(147,197,253,0.18)', aura: 'radial-gradient(circle, rgba(147,197,253,0.30), transparent 64%)' },
  LIGHT:   { label: '光', color: '#fef3c7', glow: 'rgba(254,243,199,0.72)', soft: 'rgba(254,243,199,0.16)', aura: 'radial-gradient(circle, rgba(254,243,199,0.28), transparent 64%)' },
  DARK:    { label: '闇', color: '#a855f7', glow: 'rgba(168,85,247,0.72)',  soft: 'rgba(168,85,247,0.20)',  aura: 'radial-gradient(circle, rgba(168,85,247,0.36), transparent 64%)' },
  NONE:    { label: '無', color: '#f0ebff', glow: 'rgba(240,235,255,0.54)', soft: 'rgba(240,235,255,0.10)', aura: 'radial-gradient(circle, rgba(240,235,255,0.20), transparent 64%)' },
};

const JOBS = jobsData as Record<string, JobData>;
const MASTER_SKILLS = skillsData as Record<string, SkillData>;
const STAGES = stagesData as Record<string, StageData>;
const ENEMIES = enemiesData as Record<string, EnemyData>;
const DEMON_FORMS = demonFormsData as Record<string, DemonFormData>;
const REWARD_SERVICE = new RewardService();
const ITEMS_MASTER = itemsData as Record<string, { name?: string; rarity?: string; type?: string; subOptions?: Array<{ type: string; value: number }>; specialEffect?: string }>;

const ELEMENT_ICON: Record<ElementType, string> = {
  FIRE: '🔥',
  WATER: '💧',
  THUNDER: '⚡',
  EARTH: '◆',
  WIND: '✦',
  ICE: '❄',
  LIGHT: '✚',
  DARK: '☾',
  NONE: '◇',
};

const ATTACK_TYPE_LABEL: Record<SkillAttackType, string> = {
  SLASH: '斬撃',
  STRIKE: '衝撃',
  PROJECTILE: '射出',
  MAGIC: '魔法',
  SUMMON: '召喚',
  HEAL: '回復',
};

function toBattleSkill(skill: SkillData): BattleSkill {
  const element = skill.element ?? 'NONE';
  const attackType = skill.attackType ?? (skill.type === 'MAGICAL' ? 'MAGIC' : 'SLASH');
  const basePower = skill.type === 'MAGICAL' ? 180 : 190;
  return {
    id: skill.id,
    name: skill.name,
    mp: skill.mpCost,
    power: Math.round(basePower * skill.power),
    icon: ELEMENT_ICON[element],
    aoe: skill.targetType === 'ALL_ENEMIES',
    element,
    attackType,
    ailmentType: skill.ailmentType,
    ailmentBaseRate: skill.ailmentBaseRate,
  };
}

function toDemonUltimateSkill(form: DemonFormData): BattleSkill {
  const element = form.ultimateSkill.damage.element;
  return {
    id: `demon_ultimate_${form.jobId}`,
    name: form.ultimateSkill.nameJa,
    cost: '1 USE',
    power: Math.round(430 * form.ultimateSkill.damage.power),
    icon: form.visual?.icon ?? ELEMENT_ICON[element],
    aoe: form.ultimateSkill.damage.targetType === 'ALL',
    element,
    attackType: form.ultimateSkill.damage.attackType ?? 'MAGIC',
  };
}

const POSITIONS_BY_COUNT: Record<number, EnemyState['pos'][]> = {
  1: ['center'],
  2: ['left', 'right'],
  3: ['left', 'center', 'right'],
};

const WAVE_REWARD_WEIGHTS = [0.25, 0.32, 0.43];

const FORMATION_BADGES: FormationBadgeMeta[] = [
  { icon: '⚔', label: '前衛', short: 'FRONT', color: '#f97316' },
  { icon: '◈', label: '中衛', short: 'MID',   color: '#38bdf8' },
  { icon: '✦', label: '後衛', short: 'BACK',  color: '#a78bfa' },
];

function getStageOrFallback(stageId?: string): StageData | null {
  if (stageId && STAGES[stageId]) return STAGES[stageId];
  return STAGES.area1_node1 ?? null;
}

function toEnemyState(enemy: EnemyData, index: number, count: number): EnemyState {
  const positions = POSITIONS_BY_COUNT[Math.min(3, Math.max(1, count))] ?? POSITIONS_BY_COUNT[3];
  const hp = Math.max(1, enemy.stats.hp);
  const shieldHp = enemy.shieldHp ?? 0;
  return {
    id: index,
    sourceId: enemy.id,
    name: enemy.nameJa,
    nameEn: enemy.nameEn,
    hp,
    maxHp: hp,
    atk: enemy.stats.atk,
    effectHit: enemy.stats.effectHit,
    effectRes: enemy.stats.effectRes,
    color: enemy.battle?.color ?? (enemy.tier === 'BOSS' ? '#ef4444' : '#8A2BE2'),
    pos: positions[index] ?? 'center',
    size: enemy.battle?.size ?? (enemy.tier === 'BOSS' ? 0.98 : enemy.tier === 'ELITE' ? 0.88 : 0.74),
    tier: enemy.tier,
    weaknesses: enemy.weaknesses,
    shieldHp,
    maxShieldHp: shieldHp,
    shieldBroken: shieldHp <= 0,
    sprite: enemy.battle?.sprite,
    gimmicks: enemy.gimmicks,
    targeted: index === 0,
  };
}

function buildBattleWaves(stageId?: string): BattleWave[] {
  const stage = getStageOrFallback(stageId);
  if (!stage || stage.nodeType === 'SAFE' || stage.waves.length === 0) {
    return BATTLE_WAVES.map(wave => ({
      ...wave,
      enemies: wave.enemies.map(enemy => ({ ...enemy })),
    }));
  }

  const waves = stage.waves.map((wave, waveIndex) => {
    const enemyMasters = wave.enemyIds.map(enemyId => ENEMIES[enemyId]).filter(Boolean);
    const enemies = enemyMasters.map((enemy, index) => toEnemyState(enemy, index, enemyMasters.length));
    const weight = WAVE_REWARD_WEIGHTS[waveIndex] ?? 1 / stage.waves.length;
    return {
      title: stage.nameJa,
      label: wave.label,
      role: wave.role,
      intent: wave.intent,
      isBoss: wave.role === 'BOSS',
      rewards: {
        exp: Math.max(0, Math.round(stage.rewards.baseExp * weight)),
        gold: Math.max(0, Math.round(stage.rewards.baseGold * weight)),
      },
      enemies,
    };
  }).filter(wave => wave.enemies.length > 0);

  return waves.length > 0 ? waves : BATTLE_WAVES.map(wave => ({ ...wave, enemies: wave.enemies.map(enemy => ({ ...enemy })) }));
}

function cloneEnemies(enemies: EnemyState[]): EnemyState[] {
  return enemies.map(enemy => ({
    ...enemy,
    weaknesses: enemy.weaknesses ? [...enemy.weaknesses] : undefined,
    gimmicks: enemy.gimmicks ? [...enemy.gimmicks] : undefined,
    statusEffects: enemy.statusEffects?.map(effect => ({
      ...effect,
      stacks: effect.stacks?.map(stack => ({ ...stack })),
    })),
    statusPulse: undefined,
  }));
}

function collectStageDrops(stageId?: string): DropEntry[] {
  const stage = getStageOrFallback(stageId);
  if (!stage) return [];
  const byKey = new Map<string, DropEntry>();
  const addDrop = (drop: DropEntry) => {
    const key = `${drop.type ?? 'UNKNOWN'}:${drop.itemId ?? drop.monsterId ?? drop.rarity ?? 'ANY'}:${drop.isHidden ? 'H' : 'V'}`;
    const current = byKey.get(key);
    if (!current || drop.rate > current.rate) byKey.set(key, drop);
  };
  stage.rewards.dropTable.forEach(addDrop);
  stage.waves.flatMap(wave => wave.enemyIds).forEach(enemyId => {
    ENEMIES[enemyId]?.dropTable.forEach(addDrop);
  });
  return [...byKey.values()];
}

function normalizeResultRarity(rarity?: string): 'COMMON' | 'RARE' | 'SR' | 'SSR' | 'LR' | 'UR' {
  if (rarity === 'UR') return 'UR';
  if (rarity === 'LR') return 'LR';
  if (rarity === 'SSR') return 'SSR';
  if (rarity === 'SR') return 'SR';
  if (rarity === 'R' || rarity === 'RARE') return 'RARE';
  return 'COMMON';
}

function dropToResultItem(drop: DropEntry, playerName?: string) {
  const master = drop.itemId ? ITEMS_MASTER[drop.itemId] : undefined;
  const rarity = normalizeResultRarity(drop.rarity ?? master?.rarity);
  const isUnique = rarity === 'UR' || Boolean(drop.isHidden);
  const subStat = master?.subOptions?.[0];
  return {
    id: drop.itemId ?? `${drop.type ?? 'drop'}-${drop.rarity ?? 'common'}`,
    name: drop.type === 'RESIDUE'
      ? `${drop.rarity ?? 'RARE'} 深淵の残滓`
      : master?.name ?? drop.itemId ?? '未知の戦利品',
    type: drop.type === 'RESIDUE' ? undefined : 'WEAPON',
    rarity: isUnique ? 'UR' : rarity,
    icon: drop.type === 'RESIDUE' ? '◆' : isUnique ? '☠' : '⚔',
    stats: subStat?.type.includes('CRIT')
      ? { critRate: Math.round(subStat.value) }
      : subStat?.type.includes('ATK')
        ? { atk: Math.max(8, Math.round(subStat.value * 2)) }
        : { atk: rarity === 'SSR' ? 46 : rarity === 'SR' ? 32 : 18 },
    isUnique,
    discovererName: isUnique ? (playerName ?? 'アルド') : undefined,
    serialNo: isUnique ? 1 : undefined,
    passive: isUnique
      ? '魔神化中、怨念を燃料に与ダメージが上昇する。霊魂砕き発生時、魂ゲージを追加回復する。'
      : master?.specialEffect ? '特殊効果を持つ武器。装備画面で詳細確認できる。' : undefined,
    flavor: isUnique
      ? '討たれた魔物たちの怨念が刃の奥で逆流している。握る者の魂に黒い脈動を刻み、勝利のたびに遠い哭き声を増やす異質な呪装。'
      : undefined,
  };
}

function buildResultDrops(stageId?: string, playerName?: string) {
  const drops = collectStageDrops(stageId);
  const hiddenDrops = drops.filter(drop => drop.isHidden);
  const visibleDrops = drops
    .filter(drop => !drop.isHidden && (drop.type === 'WEAPON' || drop.type === 'RESIDUE'))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, 4);

  return [
    { id: 'bone-chip', name: '骨の欠片', rarity: 'COMMON', icon: '▣', isUnique: false, quantity: 4 },
    ...visibleDrops.map(drop => dropToResultItem(drop, playerName)),
    ...hiddenDrops.slice(0, 1).map(drop => dropToResultItem(drop, playerName)),
  ];
}

function convertDropToResultItems(drop: StageDropResult, playerName?: string) {
  const weapons = drop.weapons.map(w => ({
    id:       w.id,
    name:     w.name,
    type:     w.type as any,
    rarity:   normalizeResultRarity(w.rarity) as any,
    icon:     '⚔',
    isUnique: w.isUnique,
    flavor:   w.flavor,
  }));
  const residues = drop.residues.map(r => ({
    id:       r.id,
    name:     r.name,
    rarity:   (r.rarity === 'EPIC' ? 'SSR' : r.rarity === 'RARE' ? 'SR' : 'COMMON') as any,
    icon:     '◆',
    isUnique: false,
  }));
  const materials = drop.materials.map(m => ({
    id:       m.id,
    name:     m.name,
    rarity:   'COMMON' as any,
    icon:     '▣',
    isUnique: false,
    quantity: m.quantity,
  }));
  return [...weapons, ...residues, ...materials];
}

function processStageResultLocal(stageId?: string) {
  const stage = stageId ? STAGES[stageId] : undefined;
  const dropResult = REWARD_SERVICE.processDropTable(stage?.rewards.dropTable ?? []);
  return Promise.resolve({
    dropResult,
    expGain: stage?.rewards.baseExp ?? 0,
    goldGain: stage?.rewards.baseGold ?? 0,
  });
}

// ── SVG ENEMIES ───────────────────────────────────────────────────────────────
function WraithKnightSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 80 130" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 3.5s ease-in-out infinite',
      filter: targeted ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 18px ${color}90)` : `drop-shadow(0 0 3px ${color}50)`,
      transition: 'filter 0.3s ease',
    }}>
      <defs><radialGradient id="wkGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></radialGradient></defs>
      <ellipse cx="45" cy="115" rx="28" ry="6" fill={color} opacity="0.2"/>
      <ellipse cx="45" cy="60" rx="35" ry="55" fill="url(#wkGlow)"/>
      <path d="M22 55 Q15 85 18 115 L72 115 Q75 85 68 55 Z" fill="#0a0420" opacity="0.9"/>
      <path d="M22 52 Q10 45 12 60 Q14 72 24 68 L32 58Z" fill="#150828" stroke={color} strokeWidth="0.7" strokeOpacity="0.6"/>
      <path d="M68 52 Q80 45 78 60 Q76 72 66 68 L58 58Z" fill="#150828" stroke={color} strokeWidth="0.7" strokeOpacity="0.6"/>
      <path d="M30 52 Q45 46 60 52 L58 88 Q45 94 32 88Z" fill="#100520" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <circle cx="45" cy="68" r="10" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.7"/>
      <path d="M45 59 L47 65 L45 77 L43 65Z" fill={color} opacity="0.8"/>
      <path d="M36 68 L42 66 L54 68 L42 70Z" fill={color} opacity="0.8"/>
      <path d="M30 58 Q15 70 12 90 L22 92 Q28 74 36 64Z" fill="#0d0520" opacity="0.7"/>
      <path d="M60 58 Q75 70 78 90 L68 92 Q62 74 54 64Z" fill="#0d0520" opacity="0.7"/>
      <rect x="6" y="30" width="3" height="75" rx="1.5" fill="#1a0a2e"/>
      <rect x="7" y="30" width="1.5" height="75" rx="0.5" fill={color} opacity="0.6"/>
      <path d="M9 32 Q22 25 26 38 Q22 42 9 42Z" fill={color} opacity="0.8"/>
      <ellipse cx="40" cy="126" rx="24" ry="5" fill={color} opacity="0.25"/>
      <polygon points="8,54 4,42 14,52" fill={color} opacity="0.9"/>
      <polygon points="72,54 76,42 66,52" fill={color} opacity="0.9"/>
      <rect x="34" y="48" width="12" height="14" rx="3" fill="#0d0420"/>
      <ellipse cx="40" cy="36" rx="20" ry="18" fill="#ddd6c8"/>
      <path d="M20 30 Q20 14 40 12 Q60 14 60 30 L57 40 Q48 34 40 34 Q32 34 23 40Z" fill="#160830" stroke={color} strokeWidth="1.2" strokeOpacity="0.9"/>
      <polygon points="28,22 24,8 32,20" fill={color} opacity="0.95"/>
      <polygon points="40,18 40,4 44,18" fill={color} opacity="0.95"/>
      <polygon points="52,22 56,8 48,20" fill={color} opacity="0.95"/>
      <ellipse cx="27" cy="38" rx="6" ry="5" fill="#ddd6c8"/>
      <ellipse cx="53" cy="38" rx="6" ry="5" fill="#ddd6c8"/>
      <ellipse cx="33" cy="34" rx="7" ry="7" fill="#050210"/>
      <ellipse cx="47" cy="34" rx="7" ry="7" fill="#050210"/>
      <ellipse cx="33" cy="34" rx="5" ry="5" fill={color} opacity="0.95"/>
      <ellipse cx="47" cy="34" rx="5" ry="5" fill={color} opacity="0.95"/>
      <ellipse cx="33" cy="34" rx="2.5" ry="2.5" fill="#fff"/>
      <ellipse cx="47" cy="34" rx="2.5" ry="2.5" fill="#fff"/>
      <ellipse cx="33" cy="34" rx="7" ry="7" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8"/>
      <ellipse cx="47" cy="34" rx="7" ry="7" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8"/>
      <path d="M37 42 L40 47 L43 42Z" fill="#050210"/>
      <path d="M26 50 Q40 60 54 50 L54 54 Q40 64 26 54Z" fill="#c8c0b0"/>
      {[30,35,40,45,50].map((x,i) => <polygon key={i} points={`${x},53 ${x-2.5},60 ${x+2.5},60`} fill="#ddd6c8"/>)}
    </svg>
  );
}

function BoneGiantSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 120 150" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 4s ease-in-out infinite',
      filter: targeted ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 22px ${color}60)` : 'none',
      transition: 'filter 0.3s ease',
    }}>
      <defs><radialGradient id="bgGlow" cx="50%" cy="60%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></radialGradient></defs>
      <ellipse cx="60" cy="145" rx="40" ry="8" fill={color} opacity="0.2"/>
      <ellipse cx="60" cy="75" rx="55" ry="72" fill="url(#bgGlow)"/>
      <path d="M42 112 Q36 130 38 145 L52 145 Q52 130 54 112Z" fill="#c8bfb0"/>
      <path d="M78 112 Q72 130 68 145 L82 145 Q84 130 84 112Z" fill="#c8bfb0"/>
      <ellipse cx="45" cy="125" rx="9" ry="7" fill="#e0d8c8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>
      <ellipse cx="75" cy="125" rx="9" ry="7" fill="#e0d8c8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>
      <path d="M32 65 Q32 110 36 115 L84 115 Q88 110 88 65 Q88 50 60 46 Q32 50 32 65Z" fill="#d4ccbc"/>
      <path d="M32 65 Q32 110 36 115 L84 115 Q88 110 88 65 Q88 50 60 46 Q32 50 32 65Z" fill={color} fillOpacity="0.08"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <path d={`M46 ${68+i*10} Q40 ${73+i*10} 42 ${78+i*10} L46 ${76+i*10}`} stroke={color} strokeWidth="1.2" strokeOpacity="0.5" fill="none"/>
          <path d={`M74 ${68+i*10} Q80 ${73+i*10} 78 ${78+i*10} L74 ${76+i*10}`} stroke={color} strokeWidth="1.2" strokeOpacity="0.5" fill="none"/>
          <line x1="46" y1={68+i*10} x2="74" y2={68+i*10} stroke={color} strokeWidth="0.8" strokeOpacity="0.3"/>
        </g>
      ))}
      {[0,1,2,3,4,5].map(i => <ellipse key={i} cx="60" cy={65+i*9} rx="4" ry="3.5" fill="#bfb8a8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>)}
      <ellipse cx="30" cy="62" rx="14" ry="12" fill="#d4ccbc" stroke={color} strokeWidth="0.6" strokeOpacity="0.4"/>
      <ellipse cx="90" cy="62" rx="14" ry="12" fill="#d4ccbc" stroke={color} strokeWidth="0.6" strokeOpacity="0.4"/>
      <path d="M16 62 Q4 90 8 118 L18 118 Q20 92 30 66Z" fill="#c8bfb0"/>
      <path d="M104 62 Q116 90 112 118 L102 118 Q100 92 90 66Z" fill="#c8bfb0"/>
      <ellipse cx="13" cy="122" rx="9" ry="7" fill="#bfb8a8" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <ellipse cx="107" cy="122" rx="9" ry="7" fill="#bfb8a8" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <rect x="52" y="36" width="16" height="14" rx="4" fill="#bfb8a8"/>
      <ellipse cx="60" cy="22" rx="26" ry="24" fill="#e8e0d0"/>
      <path d="M58 4 L56 14 L60 18 L62 28" stroke={color} strokeWidth="0.8" strokeOpacity="0.6" fill="none"/>
      <path d="M38 16 L50 20" stroke="#4a3a3a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M82 16 L70 20" stroke="#4a3a3a" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="48" cy="23" rx="8" ry="7" fill="#03020a"/>
      <ellipse cx="72" cy="23" rx="8" ry="7" fill="#03020a"/>
      <ellipse cx="48" cy="23" rx="5" ry="4.5" fill={color} opacity="0.9"/>
      <ellipse cx="72" cy="23" rx="5" ry="4.5" fill={color} opacity="0.9"/>
      <ellipse cx="48" cy="23" rx="2.5" ry="2.5" fill="#fff" opacity="0.95"/>
      <ellipse cx="72" cy="23" rx="2.5" ry="2.5" fill="#fff" opacity="0.95"/>
      <path d="M57 30 L60 36 L63 30Z" fill="#03020a"/>
      <path d="M38 40 Q60 52 82 40" stroke="#d0c8b8" strokeWidth="2" fill="none"/>
      {[42,50,58,66,74].map((x,i) => <path key={i} d={`M${x} 42 L${x} 49`} stroke="#e8e0d0" strokeWidth="2.2" strokeLinecap="round"/>)}
      <path d="M38 6 Q28 -8 34 -14 Q42 -2 46 8Z" fill="#8a8278" opacity="0.9"/>
      <path d="M82 6 Q92 -8 86 -14 Q78 -2 74 8Z" fill="#8a8278" opacity="0.9"/>
    </svg>
  );
}

function BoneDragonSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 140 110" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 3s ease-in-out infinite 0.8s',
      filter: targeted ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 20px ${color}60)` : `drop-shadow(0 0 3px ${color}50)`,
      transition: 'filter 0.3s ease',
    }}>
      <ellipse cx="80" cy="108" rx="42" ry="5" fill={color} opacity="0.2"/>
      <path d="M118 80 Q132 65 136 50 Q138 36 130 30 Q122 26 118 38 Q114 52 108 66Z" fill="#c8bfb0"/>
      <path d="M130 30 L138 22 L128 28Z" fill="#bfb8a8"/>
      <path d="M38 70 Q60 60 90 62 Q112 64 128 72 Q130 80 126 86 Q108 88 88 86 Q62 84 42 80Z" fill="#d4ccbc"/>
      <path d="M38 70 Q60 60 90 62 Q112 64 128 72 Q130 80 126 86 Q108 88 88 86 Q62 84 42 80Z" fill={color} fillOpacity="0.07"/>
      {[[50,63],[62,60],[74,60],[86,61],[98,64],[110,68],[120,73]].map(([x,y],i) => (
        <polygon key={i} points={`${x},${y} ${x-3},${y-8} ${x+3},${y-8}`} fill="#bfb8a8" stroke={color} strokeWidth="0.5" strokeOpacity="0.5"/>
      ))}
      <path d="M72 65 Q40 35 12 8 Q38 28 65 58Z" fill="#100420" stroke={color} strokeWidth="1" strokeOpacity="0.7"/>
      <path d="M80 62 Q68 25 72 4 Q88 24 90 58Z" fill="#150530" stroke={color} strokeWidth="0.9" strokeOpacity="0.6"/>
      <path d="M72 64 Q44 38 16 12" stroke={color} strokeWidth="0.8" strokeOpacity="0.6" fill="none"/>
      <path d="M75 62 Q66 36 70 10" stroke={color} strokeWidth="0.6" strokeOpacity="0.4" fill="none"/>
      <path d="M40 72 Q28 62 18 50 Q14 42 18 36 Q24 30 32 36 Q40 42 46 60 L42 78Z" fill="#c8bfb0"/>
      <polygon points="24,48 20,40 28,40" fill="#bfb8a8"/>
      <polygon points="30,42 27,34 34,34" fill="#bfb8a8"/>
      <path d="M8 36 Q6 28 10 22 Q16 16 24 20 Q30 24 34 32 Q32 40 24 44 Q14 46 8 36Z" fill="#d4ccbc"/>
      <path d="M8 32 Q0 28 -4 26 Q0 24 6 28Z" fill="#c8bfb0"/>
      <path d="M8 38 Q2 44 -2 48 Q4 50 10 44Z" fill="#bfb8a8"/>
      {[[-2,28],[2,26],[6,27]].map(([x,y],i) => <polygon key={i} points={`${x},${y} ${x-2},${y+7} ${x+2},${y+7}`} fill="#e8e0d0"/>)}
      {[[0,44],[4,46]].map(([x,y],i) => <polygon key={i} points={`${x},${y} ${x-2},${y-6} ${x+2},${y-6}`} fill="#ddd6c8"/>)}
      <path d="M16 20 Q12 8 16 2 Q22 8 22 20Z" fill="#8a8278"/>
      <path d="M22 19 Q22 8 28 4 Q32 10 28 20Z" fill="#8a8278"/>
      <ellipse cx="22" cy="30" rx="5" ry="5" fill="#050210"/>
      <ellipse cx="22" cy="30" rx="3.5" ry="3.5" fill={color} opacity="0.95"/>
      <ellipse cx="23" cy="29" rx="1.5" ry="1.5" fill="#fff"/>
      <circle cx="22" cy="30" r="5" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.9"/>
      <path d="M-4 30 Q-14 26 -18 22" stroke={color} strokeWidth="4" strokeOpacity="0.8" fill="none" strokeLinecap="round"/>
      <path d="M-4 34 Q-16 34 -20 32" stroke={color} strokeWidth="2.5" strokeOpacity="0.55" fill="none" strokeLinecap="round"/>
      <path d="M-2 38 Q-12 42 -14 46" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" fill="none" strokeLinecap="round"/>
      <path d="M52 84 Q48 94 44 102 L52 102 Q54 94 60 88Z" fill="#c8bfb0"/>
      <path d="M78 86 Q76 96 74 102 L82 102 Q82 94 86 90Z" fill="#c8bfb0"/>
      {[42,46,50].map((x,i) => <polygon key={i} points={`${x},102 ${x-2},110 ${x+2},110`} fill="#bfb8a8"/>)}
      {[72,76,80].map((x,i) => <polygon key={i} points={`${x},102 ${x-2},110 ${x+2},110`} fill="#bfb8a8"/>)}
    </svg>
  );
}

// ── DAMAGE FLOAT ──────────────────────────────────────────────────────────────
interface FloatDmg { id: number; x: string; y: string; value: number; crit?: boolean; heal?: boolean; color?: string }
let floatId = 0;

function DamageFloat({ floats }: { floats: FloatDmg[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {floats.map(f => (
        <div key={f.id} style={{
          position: 'absolute', left: f.x, top: f.y,
          fontFamily: "'Cinzel', serif",
          fontSize: f.crit ? 26 : 20, fontWeight: 900,
          color: f.color || (f.heal ? '#4ade80' : '#fff'),
          textShadow: `0 0 10px ${f.color || '#fff'}, 0 2px 4px rgba(0,0,0,0.8)`,
          animation: 'floatDmg 1.1s ease-out forwards',
          whiteSpace: 'nowrap', letterSpacing: f.crit ? '0.05em' : '0.02em',
          pointerEvents: 'none',
        }}>
          {f.heal ? '+' : ''}{f.value}
          {f.crit && <span style={{ fontSize: 12, marginLeft: 4, color: '#fbbf24' }}>CRIT</span>}
        </div>
      ))}
    </div>
  );
}

function getEffectAnchor(targetIds: number[], aoe: boolean) {
  if (aoe || targetIds.length > 1) return { x: 50, y: 34 };
  const positions: Record<number, { x: number; y: number }> = {
    0: { x: 23, y: 34 },
    1: { x: 50, y: 32 },
    2: { x: 73, y: 34 },
  };
  return positions[targetIds[0]] ?? { x: 50, y: 34 };
}

function SkillEffectOverlay({ effect }: { effect: ActiveSkillEffect | null }) {
  if (!effect) return null;

  const style = ELEMENT_VFX[effect.element];
  const anchor = getEffectAnchor(effect.targetIds, effect.aoe);
  const isSlash = effect.attackType === 'SLASH';
  const isStrike = effect.attackType === 'STRIKE';
  const isProjectile = effect.attackType === 'PROJECTILE';
  const isMagic = effect.attackType === 'MAGIC' || isProjectile;

  return (
    <div
      key={effect.id}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 32, overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at ${anchor.x}% ${anchor.y}%, ${style.soft}, transparent 42%)`,
          animation: 'skillScreenBloom 0.82s ease-out both',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: `${anchor.x}%`,
          top: `${anchor.y}%`,
          width: effect.aoe ? 280 : 190,
          height: effect.aoe ? 280 : 190,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {isMagic && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: effect.aoe ? 18 : 34,
                borderRadius: '50%',
                border: `1px solid ${style.color}80`,
                boxShadow: `0 0 28px ${style.glow}, inset 0 0 22px ${style.soft}`,
                background: style.aura,
                animation: 'skillMagicCircle 0.88s ease-out both',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: effect.aoe ? 190 : 132,
                height: effect.aoe ? 190 : 132,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: `1px dashed ${style.color}90`,
                animation: 'skillRuneSpin 1.1s linear both',
              }}
            />
          </>
        )}

        {isSlash && Array.from({ length: effect.aoe ? 5 : 3 }, (_, i) => (
          <div
            key={`slash-${i}`}
            style={{
              position: 'absolute',
              left: `${-10 + i * 9}%`,
              top: `${38 + i * 4}%`,
              width: effect.aoe ? 290 : 220,
              height: effect.element === 'THUNDER' ? 5 : 4,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${style.color}, #fff, ${style.color}, transparent)`,
              boxShadow: `0 0 16px ${style.glow}`,
              transform: `rotate(${-24 + i * 9}deg)`,
              '--slash-rotate': `${-24 + i * 9}deg`,
              animation: `skillElementSlash ${0.64 + i * 0.05}s cubic-bezier(0.18,0.9,0.26,1) ${i * 0.045}s both`,
            } as CSSProperties & { '--slash-rotate': string }}
          />
        ))}

        {effect.element === 'THUNDER' && (
          <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: `drop-shadow(0 0 10px ${style.color})`, animation: 'thunderVfxFlicker 0.78s steps(3,end) both' }}>
            <polyline points="105,0 78,56 112,50 74,126 126,75 102,84 138,10" fill="none" stroke={style.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="72,28 52,78 82,70 48,146 104,88" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
          </svg>
        )}

        {effect.element === 'FIRE' && Array.from({ length: 10 }, (_, i) => (
          <div
            key={`fire-${i}`}
            style={{
              position: 'absolute',
              left: `${22 + ((i * 17) % 58)}%`,
              top: `${24 + ((i * 23) % 56)}%`,
              width: 10 + (i % 4) * 5,
              height: 28 + (i % 3) * 9,
              borderRadius: '50% 50% 46% 46%',
              background: `linear-gradient(180deg, #fff7ad, ${style.color}, transparent)`,
              boxShadow: `0 0 20px ${style.glow}`,
              transformOrigin: 'center bottom',
              animation: `fireVfxRise ${0.75 + i * 0.03}s ease-out ${i * 0.035}s both`,
            }}
          />
        ))}

        {effect.element === 'WATER' && Array.from({ length: 3 }, (_, i) => (
          <div
            key={`water-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 84 + i * 46,
              height: 84 + i * 46,
              borderRadius: '50%',
              border: `2px solid ${style.color}80`,
              transform: 'translate(-50%, -50%)',
              animation: `waterVfxRing 0.86s ease-out ${i * 0.11}s both`,
            }}
          />
        ))}

        {effect.element === 'EARTH' && Array.from({ length: effect.aoe ? 12 : 7 }, (_, i) => (
          <div
            key={`earth-${i}`}
            style={{
              position: 'absolute',
              left: `${15 + ((i * 13) % 72)}%`,
              bottom: `${12 + (i % 4) * 5}%`,
              width: 12 + (i % 3) * 7,
              height: 24 + (i % 4) * 9,
              clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
              background: `linear-gradient(180deg, #f7d59a, ${style.color})`,
              boxShadow: `0 0 14px ${style.glow}`,
              animation: `earthVfxSpike ${0.68 + i * 0.02}s cubic-bezier(0.2,1.2,0.28,1) ${i * 0.03}s both`,
            }}
          />
        ))}

        {effect.element === 'WIND' && Array.from({ length: effect.aoe ? 5 : 3 }, (_, i) => (
          <div
            key={`wind-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 106 + i * 36,
              height: 58 + i * 18,
              borderTop: `3px solid ${style.color}`,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%) rotate(-22deg)',
              boxShadow: `0 -8px 18px ${style.soft}`,
              animation: `windVfxArc ${0.72 + i * 0.05}s ease-out ${i * 0.05}s both`,
            }}
          />
        ))}

        {isStrike && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '56%',
              width: effect.aoe ? 220 : 150,
              height: effect.aoe ? 92 : 70,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `2px solid ${style.color}90`,
              boxShadow: `0 0 24px ${style.glow}`,
              animation: 'strikeShockwave 0.72s ease-out both',
            }}
          />
        )}

        {Array.from({ length: effect.aoe ? 24 : 14 }, (_, i) => (
          <div
            key={`particle-${i}`}
            style={{
              position: 'absolute',
              left: `${48 + (((i * 19) % 38) - 19)}%`,
              top: `${48 + (((i * 31) % 38) - 19)}%`,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: '50%',
              background: i % 4 === 0 ? '#fff' : style.color,
              boxShadow: `0 0 10px ${style.glow}`,
              animation: `skillVfxParticle ${0.72 + (i % 5) * 0.08}s ease-out ${i * 0.018}s both`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: `${anchor.x}%`,
          top: `calc(${anchor.y}% - 108px)`,
          transform: 'translateX(-50%)',
          padding: '4px 11px',
          borderRadius: 999,
          background: `${style.soft}`,
          border: `1px solid ${style.color}80`,
          color: style.color,
          fontFamily: "'Cinzel', serif",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.12em',
          textShadow: `0 0 10px ${style.glow}`,
          animation: 'skillNameFlash 0.86s ease-out both',
        }}
      >
        {style.label} × {ATTACK_TYPE_LABEL[effect.attackType]}
      </div>
    </div>
  );
}

function DemonizeBurstOverlay({ burst }: { burst: DemonBurstState | null }) {
  if (!burst) return null;
  const color = burst.form.visual?.color ?? '#dc2626';
  const soft = burst.form.visual?.soft ?? 'rgba(220,38,38,0.24)';
  const particleCount = 34;

  return (
    <div
      key={burst.id}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 64,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: `radial-gradient(ellipse at 50% 54%, ${soft}, rgba(4,0,8,0.34) 38%, transparent 72%)`,
        animation: 'demonVfxFade 1.62s ease-out both',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `conic-gradient(from 0deg at 50% 54%, transparent 0deg, ${color}44 48deg, transparent 90deg, rgba(255,255,255,0.18) 124deg, transparent 170deg, ${color}33 235deg, transparent 360deg)`,
        mixBlendMode: 'screen',
        animation: 'demonVfxConic 1.42s ease-out both',
      }} />
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '52%',
        width: 'min(82vw, 360px)',
        aspectRatio: '1',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        border: `1px solid ${color}88`,
        boxShadow: `0 0 44px ${color}66, inset 0 0 28px ${color}33`,
        animation: 'demonConvergeRing 0.74s cubic-bezier(0.14,0.9,0.2,1) both',
      }} />
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '53%',
        width: 'min(56vw, 248px)',
        aspectRatio: '1',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        border: `2px dashed ${color}`,
        opacity: 0.82,
        filter: `drop-shadow(0 0 12px ${color})`,
        animation: 'demonSigilBloom 1.08s ease-out both',
      }}>
        <div style={{
          position: 'absolute',
          inset: '19%',
          clipPath: 'polygon(50% 0%, 63% 36%, 100% 36%, 69% 58%, 82% 100%, 50% 74%, 18% 100%, 31% 58%, 0 36%, 37% 36%)',
          background: `linear-gradient(180deg, ${color}, rgba(255,255,255,0.92), ${color})`,
          opacity: 0.48,
        }} />
      </div>
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: '-10%',
        width: 'min(42vw, 172px)',
        height: '86%',
        transform: 'translateX(-50%)',
        background: `linear-gradient(180deg, transparent, ${color}22 12%, rgba(255,255,255,0.86) 42%, ${color}88 62%, transparent)`,
        filter: `blur(9px) drop-shadow(0 0 28px ${color})`,
        mixBlendMode: 'screen',
        animation: 'demonPillarRise 1.28s cubic-bezier(0.18,0.9,0.22,1) both',
      }} />
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={`crack-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '54%',
            width: 'min(44vw, 178px)',
            height: 3,
            borderRadius: 999,
            transformOrigin: 'left center',
            background: `linear-gradient(90deg, ${color}, transparent)`,
            boxShadow: `0 0 12px ${color}`,
            '--crack-rotate': `${-154 + i * 51}deg`,
            animation: `demonVoidCrack 0.74s ease-out ${0.08 + i * 0.035}s both`,
          } as CSSProperties & { '--crack-rotate': string }}
        />
      ))}
      {Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 76 + (i % 6) * 19;
        return (
          <div
            key={`demon-particle-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '54%',
              width: 4 + (i % 4),
              height: 4 + (i % 4),
              borderRadius: i % 5 === 0 ? 2 : '50%',
              background: i % 6 === 0 ? '#fff' : color,
              boxShadow: `0 0 14px ${color}`,
              '--particle-x': `${Math.cos(angle) * distance}px`,
              '--particle-y': `${Math.sin(angle) * distance}px`,
              animation: `demonParticleBurst ${0.82 + (i % 4) * 0.06}s cubic-bezier(0.16,0.86,0.28,1) ${0.15 + i * 0.01}s both`,
            } as CSSProperties & { '--particle-x': string; '--particle-y': string }}
          />
        );
      })}
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(18% + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        width: 'min(84vw, 420px)',
        textAlign: 'center',
        color: '#f8e7ff',
        textShadow: `0 0 18px ${color}, 0 0 34px rgba(255,255,255,0.36)`,
        animation: 'demonTitleReveal 1.18s ease-out 0.42s both',
      }}>
        <div style={{ fontFamily: "'Cinzel Decorative', 'Noto Sans JP', serif", fontSize: 'clamp(18px, 6vw, 28px)', fontWeight: 900 }}>
          {burst.form.visual?.icon ?? '☠'} 魔神化
        </div>
        <div style={{ marginTop: 5, fontFamily: "'Noto Sans JP', sans-serif", fontSize: 'clamp(12px, 3.5vw, 15px)', fontWeight: 900, color }}>
          {burst.form.formName}
        </div>
      </div>
    </div>
  );
}

// ── TURN ORDER STRIP ──────────────────────────────────────────────────────────
function TurnOrderStrip() {
  const items = [
    { id: 'p0', name: '骸骨騎士', icon: '💀', color: '#8A2BE2', isPlayer: true },
    { id: 'p1', name: '腐乱兵',   icon: '🧟', color: '#22c55e', isPlayer: true },
    { id: 'e1', name: '骨巨人',   icon: '💀', color: '#8A2BE2', isPlayer: false },
    { id: 'p2', name: 'リッチ',   icon: '🧙', color: '#06b6d4', isPlayer: true },
    { id: 'e0', name: '霊体騎士', icon: '⚔',  color: '#06b6d4', isPlayer: false },
    { id: 'e2', name: '死骨竜',   icon: '🐉', color: '#ef4444', isPlayer: false },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 14px', overflowX: 'auto' }}>
      {items.map((item, i) => (
        <div key={item.id} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          animation: `turnChipIn 0.3s ease-out ${i * 0.04}s both`, flexShrink: 0,
        }}>
          <div style={{
            width: i === 0 ? 38 : 28, height: i === 0 ? 38 : 28, borderRadius: '50%',
            background: item.isPlayer ? `radial-gradient(circle, ${item.color}30, #0a0515)` : 'rgba(200,50,50,0.12)',
            border: `${i === 0 ? 2.5 : 1.5}px solid ${i === 0 ? item.color : (item.isPlayer ? item.color + '80' : '#ef444460')}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: i === 0 ? 18 : 13,
            boxShadow: i === 0 ? `0 0 12px ${item.color}80` : 'none',
            transition: 'all 0.3s ease',
          }}>{item.icon}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 7, color: i === 0 ? item.color : '#4a3a5a', letterSpacing: '0.04em' }}>
            {i === 0 ? '▶' : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BATTLE ARENA ──────────────────────────────────────────────────────────────
// Positions keep visual edges (container_center ± width*scale/2) within 0–100%
// at max responsiveMult=1.20 and each enemy's base size.
const POSITIONS: Record<string, React.CSSProperties> = {
  left:   { left: '4%',  width: '32%', alignSelf: 'flex-end', paddingBottom: 12 },
  center: { left: '28%', width: '40%', alignSelf: 'flex-end', paddingBottom: 4  },
  right:  { left: '60%', width: '34%', alignSelf: 'flex-end', paddingBottom: 16 },
};

function StatusBadgeList({ effects, pulse }: { effects?: StatusEffect[]; pulse?: AilmentType }) {
  if (!effects || effects.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 3,
      minHeight: 18,
      marginBottom: 3,
      flexWrap: 'wrap',
    }}>
      {effects.map(effect => {
        const ui = AILMENT_UI[effect.type];
        return (
          <div key={effect.type} title={ui.label} style={{
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${ui.soft}, rgba(5,1,12,0.82))`,
            border: `1px solid ${ui.color}88`,
            boxShadow: pulse === effect.type ? `0 0 12px ${ui.color}` : `0 0 7px ${ui.color}44`,
            color: '#fff',
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 8,
            fontWeight: 900,
            lineHeight: 1,
            animation: pulse === effect.type ? 'demonPulse 0.8s ease-out both' : 'none',
          }}>
            <span>{ui.icon}</span>
            {effect.stackCount > 1 && <span style={{ color: ui.color, fontFamily: 'monospace', fontSize: 8 }}>×{effect.stackCount}</span>}
          </div>
        );
      })}
    </div>
  );
}

function BattleArena({ enemies, onTargetEnemy, demonized, flashColor, screenShake, demonColor }: {
  enemies: EnemyState[];
  onTargetEnemy: (id: number) => void;
  demonized: boolean;
  flashColor: string | null;
  screenShake: boolean;
  demonColor: string;
}) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const [arenaH, setArenaH] = useState(260);

  useEffect(() => {
    const el = arenaRef.current;
    if (!el) return;
    const sync = () => setArenaH(el.clientHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scale enemies relative to arena height.
  // Cap at 1.0: never upscale beyond base sizes to prevent top-edge clipping.
  // containerHeight(≈183px) × size × mult must always be < arenaH.
  const responsiveMult = Math.min(1.0, Math.max(0.65, arenaH / 280));

  return (
    <div ref={arenaRef} style={{
      position: 'relative', flex: 1, minHeight: 0,
      background: demonized
        ? `linear-gradient(180deg, ${demonColor}22 0%, #0d0108 100%)`
        : 'linear-gradient(180deg, #0d0420 0%, #07021a 100%)',
      overflow: 'hidden',
      animation: screenShake ? 'shake 0.4s ease-out' : 'none',
      transition: 'background 0.8s ease',
    }}>
      {/* SVG terrain background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 393 260" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="arenaGlow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor={demonized ? demonColor : '#1a0838'} stopOpacity={demonized ? '0.32' : '0.9'}/>
            <stop offset="100%" stopColor={demonized ? '#0d0208' : '#05021a'} stopOpacity="1"/>
          </radialGradient>
        </defs>
        <rect width="393" height="260" fill="url(#arenaGlow)"/>
        <path d="M0 200 Q100 185 200 195 Q300 205 393 190 L393 260 L0 260Z" fill="#0a0520" opacity="0.8"/>
        <path d="M0 210 Q100 198 200 205 Q300 212 393 200 L393 260 L0 260Z" fill="#07031a" opacity="0.9"/>
        <path d="M80 212 Q120 208 160 210 Q200 212 240 208 Q280 205 320 210"
          stroke={demonized ? demonColor : '#8A2BE2'} strokeWidth="1" strokeOpacity="0.3" fill="none"/>
        {[[30,180],[90,160],[150,175],[230,155],[300,165],[360,172]].map(([x,y],i) => (
          <polygon key={i} points={`${x},${y} ${x-35},210 ${x+35},210`} fill="#0d0520" opacity={0.6+i*0.05}/>
        ))}
        {[...Array(20)].map((_,i) => (
          <circle key={i} cx={(i*47+13)%393} cy={(i*31+5)%120} r={0.8+((i*7)%10)/8} fill="#fff" opacity={0.2+((i*3)%8)/20}/>
        ))}
        {demonized && (
          <ellipse cx="196" cy="260" rx="180" ry="60" fill={demonColor} opacity="0.10"/>
        )}
        {[...Array(10)].map((_,i) => (
          <circle key={i} cx={30+i*38} cy={205+Math.sin(i)*5} r={1.5} fill={demonized ? demonColor : '#8A2BE2'} opacity="0.5"/>
        ))}
      </svg>

      {/* Demonize overlay */}
      {demonized && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center bottom, ${demonColor}26, transparent 70%)`,
          pointerEvents: 'none',
        }}/>
      )}

      {/* Flash overlay */}
      {flashColor && (
        <div style={{
          position: 'absolute', inset: 0, background: flashColor,
          animation: 'screenFlash 0.5s ease-out forwards', pointerEvents: 'none', zIndex: 25,
        }}/>
      )}

      {/* Enemy sprites */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
        {enemies.filter(e => e.hp > 0).map(enemy => (
          <div key={enemy.id} onClick={() => onTargetEnemy(enemy.id)}
            style={{
              position: 'absolute', ...POSITIONS[enemy.pos],
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              transform: `scale(${enemy.size * responsiveMult})`, transformOrigin: 'bottom center',
            }}>
            <StatusBadgeList effects={enemy.statusEffects} pulse={enemy.statusPulse}/>
            {/* HP bar */}
            <div style={{ width: '100%', height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
              <div style={{
                width: `${(enemy.hp / enemy.maxHp) * 100}%`, height: '100%',
                background: enemy.hp / enemy.maxHp > 0.5
                  ? 'linear-gradient(90deg,#22c55e,#4ade80)'
                  : enemy.hp / enemy.maxHp > 0.25
                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(90deg,#ef4444,#f87171)',
                borderRadius: 3, boxShadow: '0 0 6px rgba(255,255,255,0.3)', transition: 'width 0.5s ease',
              }}/>
            </div>
            {enemy.maxShieldHp ? (
              <div style={{ width: '100%', height: 4, background: 'rgba(56,189,248,0.10)', borderRadius: 3, border: '1px solid rgba(56,189,248,0.22)', marginTop: -2, marginBottom: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(0, ((enemy.shieldHp ?? 0) / enemy.maxShieldHp) * 100)}%`,
                  height: '100%',
                  background: enemy.shieldBroken ? 'rgba(148,163,184,0.28)' : 'linear-gradient(90deg,#0ea5e9,#67e8f9,#f0fdff)',
                  boxShadow: enemy.shieldBroken ? 'none' : '0 0 8px rgba(56,189,248,0.55)',
                  transition: 'width 0.35s ease',
                }} />
              </div>
            ) : null}
            {/* Enemy name */}
            <div style={{
              textAlign: 'center', fontFamily: "'Cinzel', serif", fontSize: 8.5, fontWeight: 600,
              color: enemy.targeted ? enemy.color : '#6b5f7a',
              letterSpacing: '0.06em',
              textShadow: enemy.targeted ? `0 0 8px ${enemy.color}` : 'none',
              transition: 'color 0.2s',
            }}>{enemy.name}</div>
            {(enemy.tier === 'ELITE' || enemy.tier === 'BOSS') && (
              <div style={{
                textAlign: 'center',
                fontFamily: 'monospace',
                fontSize: 7,
                color: enemy.shieldBroken ? '#64748b' : '#67e8f9',
                letterSpacing: '0.04em',
                textShadow: enemy.shieldBroken ? 'none' : '0 0 7px rgba(56,189,248,0.72)',
                marginTop: -2,
              }}>
                {enemy.shieldBroken ? 'SOUL BROKEN' : `SHIELD ${enemy.shieldHp ?? 0}`}
              </div>
            )}
            {/* Target marker */}
            {enemy.targeted && (
              <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 14, animation: 'breathe 1s ease-in-out infinite' }}>▼</div>
            )}
            {/* SVG sprite */}
            <div style={{ width: '100%', aspectRatio: '1/1.15' }}>
              {(enemy.sprite ?? (enemy.id === 2 ? 'WYRM' : enemy.id === 1 ? 'GIANT' : 'WRAITH')) === 'WRAITH' && <WraithKnightSVG hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
              {(enemy.sprite ?? (enemy.id === 2 ? 'WYRM' : enemy.id === 1 ? 'GIANT' : 'WRAITH')) === 'GIANT' && <BoneGiantSVG hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
              {(enemy.sprite ?? (enemy.id === 2 ? 'WYRM' : enemy.id === 1 ? 'GIANT' : 'WRAITH')) === 'WYRM' && <BoneDragonSVG hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BATTLE LOG ────────────────────────────────────────────────────────────────
function BattleLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{
      padding: '6px 14px', height: 58,
      background: 'linear-gradient(180deg,rgba(3,1,12,0.6),rgba(5,2,16,0.85))',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2,
    }}>
      {lines.slice(-3).map((line, i) => (
        <div key={i} style={{
          fontFamily: "'Inter', sans-serif", fontSize: 10, lineHeight: 1.4,
          color: i === lines.slice(-3).length - 1 ? '#e2d8f0' : '#6b5f7a',
          animation: i === lines.slice(-3).length - 1 ? 'logFade 0.3s ease-out' : 'none',
        }}>{line}</div>
      ))}
    </div>
  );
}

// ── PARTY STATUS BAR ──────────────────────────────────────────────────────────
interface BattlePartyMember {
  id: string; name: string; icon: string;
  hp: number; maxHp: number; mp: number; maxMp: number;
  color: string; active: boolean; formation?: FormationBadgeMeta;
}

function FormationBadge({ badge, active }: { badge: FormationBadgeMeta; active: boolean }) {
  return (
    <div style={{
      minWidth: 48,
      height: 23,
      padding: '0 7px',
      borderRadius: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      background: active ? `${badge.color}1f` : 'rgba(255,255,255,0.035)',
      border: `1px solid ${active ? badge.color + '82' : 'rgba(255,255,255,0.08)'}`,
      boxShadow: active ? `0 0 10px ${badge.color}28` : 'none',
      color: active ? '#f8f3ff' : '#655974',
      flexShrink: 0,
    }}>
      <span style={{ color: active ? badge.color : '#4a3a5a', fontSize: 10, lineHeight: 1 }}>{badge.icon}</span>
      <span style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        fontSize: 9,
        fontWeight: 900,
        lineHeight: 1,
      }}>{badge.label}</span>
    </div>
  );
}

function PartyStatusBar({ party, demonized, playerStatusEffects }: { party: BattlePartyMember[]; demonized: boolean; playerStatusEffects: StatusEffect[] }) {
  return (
    <div style={{
      padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4,
      background: demonized ? 'rgba(18,3,7,0.88)' : 'rgba(5,2,14,0.85)',
      borderTop: `1px solid ${demonized ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.06)'}`,
      transition: 'background 0.45s ease',
    }}>
      {party.map(member => (
        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: member.hp <= 0 ? 0.35 : 1, position: 'relative' }}>
          {member.active && playerStatusEffects.length > 0 && (
            <div style={{ position: 'absolute', top: -8, right: 4, display: 'flex', gap: 3, zIndex: 2 }}>
              {playerStatusEffects.slice(0, 4).map(effect => {
                const ui = AILMENT_UI[effect.type];
                return (
                  <div key={effect.type} style={{
                    minWidth: 17,
                    height: 17,
                    padding: '0 3px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${ui.color}88`,
                    background: `linear-gradient(135deg, ${ui.soft}, rgba(5,1,12,0.9))`,
                    color: '#fff',
                    boxShadow: `0 0 8px ${ui.color}55`,
                    fontSize: 7,
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontWeight: 900,
                  }}>{ui.icon}</div>
                );
              })}
            </div>
          )}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: member.active ? `radial-gradient(circle, ${member.color}30, #0a0515)` : 'rgba(255,255,255,0.04)',
            border: `${member.active ? 2 : 1}px solid ${member.active ? member.color : member.color + '40'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            boxShadow: member.active ? `0 0 10px ${member.color}60` : 'none',
          }}>{member.icon}</div>
          <div style={{ width: 52, flexShrink: 0, fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600, color: member.active ? '#f0ebff' : '#6b5f7a' }}>
            {member.name}
          </div>
          {member.formation && <FormationBadge badge={member.formation} active={member.hp > 0}/>}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#6b5f7a' }}>HP</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#f87171' }}>
                {member.hp}<span style={{ color: '#4a3a5a', fontSize: 8 }}>/{member.maxHp}</span>
              </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(member.hp / member.maxHp) * 100}%`, height: '100%',
                background: member.hp / member.maxHp > 0.5 ? 'linear-gradient(90deg,#dc2626,#f87171)'
                  : member.hp / member.maxHp > 0.25 ? '#f59e0b' : '#dc2626',
                borderRadius: 2, transition: 'width 0.4s ease',
              }}/>
            </div>
          </div>
          <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#6b5f7a' }}>EN</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#60a5fa' }}>{member.mp}</div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(member.mp / member.maxMp) * 100}%`, height: '100%',
                background: 'linear-gradient(90deg,#1d4ed8,#60a5fa)',
                borderRadius: 2, transition: 'width 0.4s ease',
              }}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SOUL GAUGE ────────────────────────────────────────────────────────────────
function SoulGauge({ value, demonized, demonColor, actionsRemaining }: { value: number; demonized: boolean; demonColor: string; actionsRemaining: number }) {
  const pct = demonized
    ? Math.max(0, Math.min(100, (actionsRemaining / DEMON_ACTION_LIMIT) * 100))
    : Math.min(100, Math.max(0, value));
  const full = !demonized && pct >= 100;
  return (
    <div id="tut-soul-gauge" style={{
      padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 10,
      background: demonized ? 'rgba(30,4,4,0.9)' : 'rgba(4,2,14,0.9)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      transition: 'background 0.6s ease',
    }}>
      <div style={{
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: demonized ? demonColor : '#8A2BE2', letterSpacing: '0.1em', flexShrink: 0,
        textShadow: full || demonized ? `0 0 8px ${demonized ? demonColor : '#8A2BE2'}` : 'none',
      }}>{demonized ? '☠ DEMON' : '☠ SOUL'}</div>
      <div style={{
        flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
        border: `1px solid ${full || demonized ? (demonized ? demonColor + '66' : '#8A2BE260') : 'rgba(255,255,255,0.08)'}`,
        boxShadow: full || demonized ? `0 0 12px ${demonized ? demonColor + '80' : '#8A2BE280'}` : 'none',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          backgroundImage: demonized
            ? `linear-gradient(90deg,#1f0307,${demonColor},#fca5a5)`
            : 'linear-gradient(90deg,#4a0e8a,#8A2BE2,#c084fc,#8A2BE2)',
          backgroundSize: '200% 100%',
          animation: full || demonized ? 'soulFill 1.5s linear infinite' : 'none',
          boxShadow: full || demonized ? `0 0 10px ${demonized ? demonColor : '#8A2BE2'}` : 'none',
          transition: 'width 0.6s ease',
        }}/>
      </div>
      <div style={{
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: full || demonized ? (demonized ? demonColor : '#c084fc') : '#4a3a5a', flexShrink: 0,
      }}>{demonized ? `${actionsRemaining}ACT` : full ? 'MAX' : `${Math.round(pct)}%`}</div>
    </div>
  );
}

function DemonStatusRibbon({ form, actionsRemaining, ultimateUsed, ultimateName, canUseUltimate, onUltimate }: {
  form: DemonFormData;
  actionsRemaining: number;
  ultimateUsed: boolean;
  ultimateName: string;
  canUseUltimate: boolean;
  onUltimate: () => void;
}) {
  const color = form.visual?.color ?? '#dc2626';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(96px, 132px)',
      gap: 8,
      alignItems: 'center',
      marginBottom: 8,
      padding: '7px 9px',
      borderRadius: 10,
      background: `linear-gradient(135deg, ${form.visual?.soft ?? 'rgba(220,38,38,0.18)'}, rgba(5,1,8,0.84))`,
      border: `1px solid ${color}55`,
      boxShadow: `0 0 16px ${color}24`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          fontFamily: "'Cinzel', serif",
          fontSize: 10,
          fontWeight: 800,
          color: '#f8e7ff',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          <span style={{ color }}>{form.visual?.icon ?? '☠'}</span>
          <span>{form.formName}</span>
          <span style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            borderRadius: 999,
            border: `1px solid ${color}66`,
            color,
            fontFamily: "'Cinzel', serif",
            fontSize: 8,
            flexShrink: 0,
          }}>{actionsRemaining} ACT</span>
        </div>
        <div style={{
          marginTop: 2,
          fontFamily: "'Inter', sans-serif",
          fontSize: 8,
          color: '#b9a8c8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {form.effectA.descJa} / {getDemonRiskLabel(form.effectB.riskType)}: {form.effectB.descJa}
        </div>
      </div>
      <div style={{
        minHeight: 43,
        padding: '5px 8px',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        flexShrink: 0,
        cursor: canUseUltimate ? 'pointer' : 'default',
        opacity: canUseUltimate ? 1 : 0.48,
        background: canUseUltimate
          ? `linear-gradient(135deg, ${color}40, ${color}12)`
          : 'rgba(255,255,255,0.035)',
        border: `1px solid ${canUseUltimate ? color + '88' : 'rgba(255,255,255,0.09)'}`,
        boxShadow: canUseUltimate ? `0 0 18px ${color}42, inset 0 0 14px ${color}16` : 'none',
        animation: canUseUltimate ? 'demonPulse 1.45s ease-in-out infinite' : 'none',
      }}
      onClick={() => {
        if (canUseUltimate) onUltimate();
      }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          minWidth: 0,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 11,
          fontWeight: 900,
          color: canUseUltimate ? '#fff7fb' : '#6b5f7a',
          lineHeight: 1,
        }}>
          <span style={{ color }}>☠</span>
          <span>魔神技</span>
        </div>
        <div style={{
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'Cinzel', serif",
          fontSize: 8,
          fontWeight: 800,
          color: canUseUltimate ? color : '#4a3a5a',
          textAlign: 'center',
          lineHeight: 1.15,
        }}>
          {ultimateUsed ? 'USED' : ultimateName}
        </div>
      </div>
    </div>
  );
}

// ── COMMAND BUTTON ─────────────────────────────────────────────────────────────
function CommandButton({ label, sublabel, icon, enabled, color, onClick, glow, demonized, id }: {
  label: string; sublabel?: string; icon: string; enabled: boolean;
  color: string; onClick: () => void; glow?: boolean; demonized?: boolean; id?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      id={id}
      onClick={() => { if (!enabled) return; setPressed(true); setTimeout(() => setPressed(false), 150); onClick(); }}
      style={{
        flex: 1, padding: '10px 6px',
        background: !enabled ? `${color}12`
          : pressed ? `${color}35`
          : demonized ? `linear-gradient(135deg,${color}28,${color}12)`
          : `linear-gradient(135deg,${color}22,${color}0e)`,
        border: `1px solid ${enabled ? (glow ? color : color + '60') : color + '35'}`,
        borderRadius: 14, cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.55,
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'all 0.15s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        boxShadow: glow && enabled ? `0 0 16px ${color}50, inset 0 0 10px ${color}18` : 'none',
        animation: enabled && glow ? 'demonPulse 1.5s ease-in-out infinite' : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
      {enabled && glow && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          backgroundImage: `linear-gradient(90deg,transparent,${color}18,transparent)`,
          backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite',
        }}/>
      )}
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: enabled ? '#f0ebff' : `${color}70`, letterSpacing: '0.04em', lineHeight: 1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      {sublabel && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: enabled ? color + '90' : `${color}45`, letterSpacing: '0.08em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</div>}
    </div>
  );
}

// ── SKILL BUTTON ──────────────────────────────────────────────────────────────
function SkillButton({ skill, mp, onClick, demonized }: {
  skill: BattleSkill; mp: number;
  onClick: (skill: BattleSkill) => void;
  demonized: boolean;
}) {
  const elementStyle = ELEMENT_VFX[skill.element];
  const canUse = skill.mp != null ? mp >= skill.mp : true; // mp = currentEnergy
  return (
    <div onClick={() => canUse && onClick(skill)} style={{
      padding: '10px 8px',
      background: canUse ? `linear-gradient(135deg,${elementStyle.soft},rgba(8,4,18,0.88))` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${canUse ? elementStyle.color + '70' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, cursor: canUse ? 'pointer' : 'default',
      opacity: canUse ? 1 : 0.35,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      animation: 'skillReveal 0.25s ease-out both',
      flex: '0 0 82px',
      minWidth: 82,
      boxShadow: canUse ? `0 0 12px ${elementStyle.soft}` : 'none',
    }}>
      <div style={{ fontSize: 22, filter: canUse ? `drop-shadow(0 0 8px ${elementStyle.color})` : 'none' }}>{skill.icon}</div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700, color: canUse ? '#f0ebff' : '#4a3a5a', textAlign: 'center', lineHeight: 1.2 }}>{skill.name}</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: canUse ? '#60a5fa' : '#2a1a3a', display: 'flex', alignItems: 'center', gap: 2 }}>
        {skill.cost ? <span style={{ color: demonized ? '#ef4444' : '#60a5fa' }}>{skill.cost}</span> : `EN ${skill.mp ?? 0}`}
      </div>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 7,
        color: elementStyle.color,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}>
        {elementStyle.label}/{ATTACK_TYPE_LABEL[skill.attackType]}
      </div>
    </div>
  );
}

// ── SYSTEM BAR ────────────────────────────────────────────────────────────────
function SystemBar({ auto, speed, onAuto, onSpeedChange, onEscape, canEscape }: {
  auto: boolean; speed: number;
  onAuto: () => void; onSpeedChange: (speed: number) => void;
  onEscape: () => void; canEscape: boolean;
}) {
  return (
    <div style={{
      paddingTop: 6, paddingLeft: 12, paddingRight: 12,
      paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' as string,
      display: 'flex', gap: 8, alignItems: 'center',
      background: 'rgba(3,1,12,0.9)', borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <button type="button" onClick={onAuto} style={{
        minHeight: 38,
        padding: '0 12px', borderRadius: 10,
        background: auto ? 'rgba(138,43,226,0.3)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${auto ? '#8A2BE280' : 'rgba(255,255,255,0.08)'}`,
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: auto ? '#c084fc' : '#6b5f7a',
        cursor: 'pointer', letterSpacing: '0.06em',
        boxShadow: auto ? '0 0 10px rgba(138,43,226,0.3)' : 'none',
        transition: 'all 0.2s ease',
      }}>AUTO {auto ? 'ON' : 'OFF'}</button>
      <div style={{
        minHeight: 38,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(42px, 1fr))',
        gap: 3,
        padding: 3,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.045)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {[1, 2, 3].map(value => {
          const active = speed === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSpeedChange(value)}
              style={{
                minHeight: 31,
                minWidth: 42,
                padding: '0 7px',
                borderRadius: 9,
                background: active ? 'linear-gradient(135deg, rgba(138,43,226,0.35), rgba(192,132,252,0.16))' : 'transparent',
                border: `1px solid ${active ? '#c084fc70' : 'transparent'}`,
                boxShadow: active ? '0 0 12px rgba(138,43,226,0.28)' : 'none',
                color: active ? '#f0ebff' : '#7f7194',
                fontFamily: "'Cinzel', serif",
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.16s ease',
              }}
            >
              ×{value}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }}/>
      <button type="button" onClick={canEscape ? onEscape : undefined} style={{
        minHeight: 38,
        padding: '0 13px', borderRadius: 10,
        background: canEscape ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${canEscape ? '#ef444440' : 'rgba(255,255,255,0.05)'}`,
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: canEscape ? '#f87171' : '#2a1a3a',
        cursor: canEscape ? 'pointer' : 'default',
        opacity: canEscape ? 1 : 0.4, letterSpacing: '0.06em',
      }}>逃走</button>
    </div>
  );
}

// ── MAIN BATTLE CANVAS ────────────────────────────────────────────────────────
export default function BattleCanvas({ stageId, onEnd }: BattleCanvasProps) {
  const {
    player, party, equippedResidueSlots,
    addExp, addGold, addClearedStage,
    addInventoryItems, addAbyssalResidues, addResidueMaterials,
  } = useGameStore();
  const sfx = useSoundEffects();
  const playerProfile = player ? calculateCharacterStatProfile(player, equippedResidueSlots) : null;
  const playerStats = playerProfile?.total ?? player?.stats;
  const battleWaves = useMemo(() => buildBattleWaves(stageId), [stageId]);

  const [waveIndex, setWaveIndex] = useState(0);
  const [enemies, setEnemies] = useState<EnemyState[]>(() => cloneEnemies(battleWaves[0].enemies));
  const [soul, setSoul] = useState(45);
  const [phase, setPhase] = useState<'playerTurn' | 'skillMenu' | 'itemMenu' | 'animating' | 'enemyTurn' | 'waveTransition'>('playerTurn');
  const [demonized, setDemonized] = useState(false);
  const [demonActionsRemaining, setDemonActionsRemaining] = useState(0);
  const [demonUltimateUsed, setDemonUltimateUsed] = useState(false);
  const [playerStatusEffects, setPlayerStatusEffects] = useState<StatusEffect[]>([]);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [log, setLog] = useState([`戦闘開始！${battleWaves[0].title}へ侵攻する。`, `${battleWaves[0].label} 開始。骸骨騎士のターン。`]);
  const [floats, setFloats] = useState<FloatDmg[]>([]);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [skillEffect, setSkillEffect] = useState<ActiveSkillEffect | null>(null);
  const [demonBurst, setDemonBurst] = useState<DemonBurstState | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [battleResult, setBattleResult] = useState<{
    isVictory: boolean;
    expGained: number;
    goldGained: number;
    itemsGained: any[];
    monstersGained: string[];
    isPurplePillar: boolean;
    wavesCleared: number;
    totalWaves: number;
    clearTime: number;
  } | null>(null);
  const waveIndexRef = useRef(0);
  const enemiesRef = useRef<EnemyState[]>(cloneEnemies(battleWaves[0].enemies));
  const waveResolvingRef = useRef(false);
  const battleTotalsRef = useRef({ exp: 0, gold: 0, waves: 0 });
  const effectIdRef = useRef(0);
  const demonBurstIdRef = useRef(0);
  const enemyTurnSerialRef = useRef(0);

  // Build battle party from store
  const battleParty: BattlePartyMember[] = [
    {
      id: 'player', name: player?.name ?? '骸骨騎士', icon: '💀',
      hp: playerStats?.hp ?? 820, maxHp: (playerStats as any)?.maxHp ?? playerStats?.hp ?? 820,
      mp: player?.currentEnergy ?? 0, maxMp: player?.maxEnergy ?? 100,
      color: '#8A2BE2', active: true,
    },
    ...party.slice(0, 3).map((m, i): BattlePartyMember => m ? {
      id: m.id, name: m.name, icon: m.tribe === 'UNDEAD' ? '🧟' : '👻',
      hp: m.stats?.hp ?? 580, maxHp: (m.stats as any)?.maxHp ?? m.stats?.hp ?? 580,
      mp: 0, maxMp: 100,
      color: ['#f97316','#06b6d4','#a78bfa'][i], active: false,
      formation: FORMATION_BADGES[i],
    } : {
      id: `slot_${i}`, name: `使役魔${i+1}`, icon: '💀',
      hp: 0, maxHp: 100, mp: 0, maxMp: 100, color: '#4a3a5a', active: false,
      formation: FORMATION_BADGES[i],
    }),
  ];

  const speedMs = 900 / speed;
  const battleDelay = useCallback((ms: number, min = 80) => Math.max(min, ms / speed), [speed]);
  const currentMp = battleParty[0]?.mp ?? 0;
  const soulFull = soul >= 100;
  const currentWave = battleWaves[waveIndex] ?? battleWaves[0];
  const currentJobId = player?.currentJobId ?? 'warrior';
  const currentJobData = JOBS[currentJobId] ?? JOBS.warrior;
  const currentJobLevel = player && currentJobData ? Math.max(1, getJobLevel(player, currentJobId)) : 1;
  const demonForm = DEMON_FORMS[currentJobId] ?? DEMON_FORMS.warrior;
  const demonColor = demonForm.visual?.color ?? '#dc2626';
  const jobSkills = currentJobData
    ? resolveUnlockedJobSkills(currentJobData, currentJobLevel, MASTER_SKILLS).map(toBattleSkill)
    : SKILLS;
  const mainSkills = jobSkills.length > 0 ? jobSkills : SKILLS;
  const demonUltimateSkill = toDemonUltimateSkill(demonForm);
  const getElementBoostMultiplier = (element: ElementType) => {
    if (element === 'NONE') return 1;
    const boost = playerProfile?.elementDmgBoosts[element] ?? player?.elementDmgBoosts?.[element] ?? 0;
    return 1 + boost / 100;
  };

  const addLog = useCallback((line: string) => setLog(prev => [...prev, line]), []);

  useEffect(() => {
    if (stageId) startTutorialBattlePhase(stageId);
  }, [stageId]);

  useEffect(() => {
    const firstEnemies = cloneEnemies(battleWaves[0].enemies);
    waveResolvingRef.current = false;
    battleTotalsRef.current = { exp: 0, gold: 0, waves: 0 };
    waveIndexRef.current = 0;
    enemiesRef.current = firstEnemies;
    setWaveIndex(0);
    setEnemies(firstEnemies);
    setSoul(45);
    setPhase('playerTurn');
    setDemonized(false);
    setDemonActionsRemaining(0);
    setDemonUltimateUsed(false);
    setPlayerStatusEffects([]);
    setAuto(false);
    setDemonBurst(null);
    setSkillEffect(null);
    setFlashColor(null);
    setScreenShake(false);
    setShowResult(false);
    setBattleResult(null);
    setLog([`戦闘開始！${battleWaves[0].title}へ侵攻する。`, `${battleWaves[0].label} 開始。骸骨騎士のターン。`]);
  }, [battleWaves]);

  useEffect(() => { waveIndexRef.current = waveIndex; }, [waveIndex]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => {
    sfx.setDemonOverlay(demonized);
    return () => {
      if (demonized) sfx.setDemonOverlay(false);
    };
  }, [demonized, sfx]);

  const resolveWaveClear = useCallback(() => {
    if (waveResolvingRef.current) return;
    waveResolvingRef.current = true;

    const clearedIndex = waveIndexRef.current;
    const clearedWave = battleWaves[clearedIndex] ?? battleWaves[0];
    battleTotalsRef.current = {
      exp: battleTotalsRef.current.exp + clearedWave.rewards.exp,
      gold: battleTotalsRef.current.gold + clearedWave.rewards.gold,
      waves: clearedIndex + 1,
    };

    setPhase('waveTransition');
    setSoul(prev => Math.min(100, prev + 18));
    sfx.waveClear(clearedWave.isBoss ? 'boss' : 'wave');
    addLog(`★ ${clearedWave.label} クリア！ EXP +${clearedWave.rewards.exp} / Gold +${clearedWave.rewards.gold}G`);

    window.setTimeout(() => {
      const nextIndex = clearedIndex + 1;
      if (nextIndex >= battleWaves.length) {
        const isBoss      = currentWave.isBoss;
        const bossName    = currentWave.enemies[0]?.name ?? 'ボス';
        const clearTime   = 74 + Math.round(Math.random() * 18);
        const totalWaves  = battleWaves.length;

        processStageResultLocal(stageId).then(({ dropResult, expGain, goldGain }) => {
          // ローカル実行時のストア更新
          addInventoryItems(dropResult.weapons);
          addAbyssalResidues(dropResult.residues);
          addResidueMaterials(dropResult.materials);
          addExp(expGain);
          addGold(goldGain);
          if (stageId) addClearedStage(stageId);

          setBattleResult({
            isVictory:      true,
            expGained:      expGain,
            goldGained:     goldGain,
            itemsGained:    convertDropToResultItems(dropResult, player?.name),
            monstersGained: isBoss ? [`霊核: ${bossName}`] : [],
            isPurplePillar: dropResult.weapons.some((w: { rarity: string }) => w.rarity === 'SSR' || w.rarity === 'UR'),
            wavesCleared:   totalWaves,
            totalWaves,
            clearTime,
          });
          setShowResult(true);
        }).catch(() => {
          // ネットワーク失敗時フォールバック
          setBattleResult({
            isVictory: true, expGained: 0, goldGained: 0,
            itemsGained: [], monstersGained: [], isPurplePillar: false,
            wavesCleared: totalWaves, totalWaves, clearTime,
          });
          setShowResult(true);
        });
        return;
      }

      const nextWave = battleWaves[nextIndex];
      const nextEnemies = cloneEnemies(nextWave.enemies);
      enemiesRef.current = nextEnemies;
      setWaveIndex(nextIndex);
      setEnemies(nextEnemies);
      setPhase('playerTurn');
      waveResolvingRef.current = false;
      addLog(nextWave.isBoss ? `☠ BOSS登場！ ${nextWave.enemies[0].name} が現れた！` : `${nextWave.label} 開始！`);
      if (nextWave.isBoss) {
        setFlashColor('rgba(245,158,11,0.35)');
        window.setTimeout(() => setFlashColor(null), 600);
      }
    }, battleDelay(1200, 520));
  }, [addLog, addExp, addGold, addClearedStage, addInventoryItems, addAbyssalResidues, addResidueMaterials, battleDelay, battleWaves, currentWave.enemies, currentWave.isBoss, player?.name, sfx, stageId]);

  function spawnFloat(x: string, y: string, value: number, opts: Partial<FloatDmg> = {}) {
    const id = ++floatId;
    setFloats(prev => [...prev, { id, x, y, value, ...opts }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), battleDelay(1200, 450));
  }

  function triggerSkillEffect(skill: Pick<BattleSkill, 'name' | 'element' | 'attackType' | 'aoe'>, targetIds: number[]) {
    const id = ++effectIdRef.current;
    setSkillEffect({
      id,
      name: skill.name,
      element: skill.element,
      attackType: skill.attackType,
      aoe: skill.aoe,
      targetIds,
    });
    window.setTimeout(() => {
      setSkillEffect(prev => prev?.id === id ? null : prev);
    }, battleDelay(skill.element === 'THUNDER' || skill.attackType === 'SLASH' ? 920 : 1080, 420));
  }

  function doEnemyHit(eid: number) {
    setEnemies(prev => prev.map(e => e.id === eid ? { ...e, hit: true } : e));
    setTimeout(() => setEnemies(prev => prev.map(e => ({ ...e, hit: false }))), battleDelay(500, 220));
  }

  function damageEnemy(targetId: number, dmg: number, opts: { color?: string; element?: ElementType; ignoreShield?: boolean } = {}) {
    const isCrit = Math.random() < 0.2;
    const target = enemiesRef.current.find(e => e.id === targetId);
    let finalDmg = isCrit ? Math.round(dmg * 1.5) : dmg;
    let nextShieldHp = target?.shieldHp ?? 0;
    let shieldBroken = target?.shieldBroken ?? false;
    const hasShield = target && (target.maxShieldHp ?? 0) > 0 && (target.shieldHp ?? 0) > 0 && !target.shieldBroken;

    if (hasShield && target && !opts.ignoreShield) {
      const element = opts.element ?? 'NONE';
      const isWeakShieldHit = element !== 'NONE' && Boolean(target.weaknesses?.includes(element));
      if (isWeakShieldHit) {
        const shieldDamage = Math.max(1, Math.round(finalDmg * 0.75));
        nextShieldHp = Math.max(0, (target.shieldHp ?? 0) - shieldDamage);
        if (nextShieldHp <= 0) {
          shieldBroken = true;
          finalDmg = Math.round(finalDmg * 1.45);
          addLog(`◇ 霊魂砕き！ ${target.name}の防壁が崩れた。`);
          setSoul(prev => Math.min(100, prev + 30));
          setFlashColor('rgba(56,189,248,0.28)');
          setTimeout(() => setFlashColor(null), 360);
        } else {
          finalDmg = Math.max(1, Math.round(finalDmg * 0.72));
          addLog(`◇ 弱点属性が防壁を削った。残り ${nextShieldHp}`);
        }
      } else {
        finalDmg = Math.max(1, Math.round(finalDmg * 0.22));
        addLog(`◇ ${target.name}の霊的防壁がダメージを殺した。`);
      }
    } else if (hasShield && target && opts.ignoreShield) {
      addLog(`◇ ${target.name}の防御を魔神技が貫いた。`);
    }

    doEnemyHit(targetId);
    const positions: Record<number, { x: string; y: string }> = { 0: { x: '12%', y: '18%' }, 1: { x: '36%', y: '12%' }, 2: { x: '62%', y: '16%' } };
    const pos = positions[targetId] || { x: '40%', y: '15%' };
    spawnFloat(pos.x, pos.y, finalDmg, { crit: isCrit, color: opts.color || '#fff' });
    setEnemies(prev => {
      const next = prev.map(e => e.id === targetId ? {
        ...e,
        hp: Math.max(0, e.hp - finalDmg),
        shieldHp: nextShieldHp,
        shieldBroken,
      } : e);
      enemiesRef.current = next;
      if (next.every(e => e.hp <= 0)) {
        window.setTimeout(resolveWaveClear, 380);
      }
      return next;
    });
    return finalDmg;
  }

  function getSkillAilmentType(skill: Pick<BattleSkill, 'ailmentType' | 'element' | 'attackType'>): AilmentType | null {
    return getSkillAilment({
      ailmentType: skill.ailmentType,
      element: skill.element,
      attackType: skill.attackType,
      type: skill.attackType === 'MAGIC' || skill.attackType === 'SUMMON' ? 'MAGICAL' : 'PHYSICAL',
    });
  }

  function applyAilmentToEnemy(targetId: number, skill: Pick<BattleSkill, 'ailmentType' | 'ailmentBaseRate' | 'element' | 'attackType'>) {
    const target = enemiesRef.current.find(enemy => enemy.id === targetId);
    const ailmentType = getSkillAilmentType(skill);
    if (!target || !ailmentType) return;
    const result = tryApplyAilment(
      ailmentType,
      {
        atk: playerStats?.atk ?? 1500,
        effectHit: playerStats?.effectHit ?? 0,
      },
      {
        effectRes: target.effectRes ?? 0,
      },
      target.statusEffects,
      {
        baseRate: skill.ailmentBaseRate,
      },
    );
    if (!result.applied && !result.immune) return;

    const next = enemiesRef.current.map(enemy =>
      enemy.id === targetId
        ? { ...enemy, statusEffects: result.effects, statusPulse: ailmentType }
        : enemy
    );
    enemiesRef.current = next;
    setEnemies(next);
    if (result.applied) {
      const ui = AILMENT_UI[ailmentType];
      addLog(`${target.name}に${ui.label}を付与。`);
      setTimeout(() => {
        setEnemies(prev => prev.map(enemy => enemy.id === targetId ? { ...enemy, statusPulse: undefined } : enemy));
      }, 900);
    }
  }

  function applyEnemyAilmentToPlayer(enemy: EnemyState, activeDemonForm: DemonFormData | null) {
    const ailmentType: AilmentType | null = enemy.tier === 'BOSS'
      ? 'WEAKEN'
      : enemy.tier === 'ELITE'
      ? 'PARALYSIS'
      : null;
    if (!ailmentType) return;

    const result = tryApplyAilment(
      ailmentType,
      { atk: enemy.atk, effectHit: enemy.effectHit ?? 0 },
      { effectRes: playerStats?.effectRes ?? 5 },
      playerStatusEffects,
      {
        baseRate: enemy.tier === 'BOSS' ? 0.28 : 0.22,
        immune: Boolean(activeDemonForm),
      },
    );
    if (result.immune) {
      addLog('魔神化の免疫が状態異常を弾いた。');
      return;
    }
    if (result.applied) {
      setPlayerStatusEffects(result.effects);
      addLog(`${enemy.name}の呪圧で${AILMENT_UI[ailmentType].label}を受けた。`);
    }
  }

  function processEnemyStatusPhase(): { alive: EnemyState[]; skippedIds: Set<number> } {
    const skippedIds = new Set<number>();
    let nextEnemies = enemiesRef.current.map(enemy => {
      if (enemy.hp <= 0 || !enemy.statusEffects?.length) return { ...enemy, statusPulse: undefined };
      const result = processStatusEffects(enemy.statusEffects, { maxHp: enemy.maxHp });
      const firstTick = result.ticks.find(tick => tick.damage || tick.skipped)?.type;
      if (result.totalDamage > 0) {
        const positions: Record<number, { x: string; y: string }> = { 0: { x: '12%', y: '18%' }, 1: { x: '36%', y: '12%' }, 2: { x: '62%', y: '16%' } };
        const pos = positions[enemy.id] || { x: '40%', y: '15%' };
        spawnFloat(pos.x, pos.y, result.totalDamage, { color: '#4ade80' });
        const labels = result.ticks.filter(tick => tick.damage).map(tick => AILMENT_UI[tick.type].label).join('/');
        addLog(`${enemy.name}に${labels}の継続ダメージ ${result.totalDamage}。`);
      }
      if (result.skipAction) {
        skippedIds.add(enemy.id);
        const control = result.ticks.find(tick => tick.skipped)?.type;
        addLog(`${enemy.name}は${control ? AILMENT_UI[control].label : '状態異常'}で行動を阻害された。`);
      }
      result.ticks.filter(tick => tick.expired).forEach(tick => {
        addLog(`${enemy.name}の${AILMENT_UI[tick.type].label}が解除された。`);
      });
      return {
        ...enemy,
        hp: Math.max(0, enemy.hp - result.totalDamage),
        statusEffects: result.effects,
        statusPulse: firstTick,
      };
    });

    enemiesRef.current = nextEnemies;
    setEnemies(nextEnemies);
    window.setTimeout(() => {
      setEnemies(prev => prev.map(enemy => ({ ...enemy, statusPulse: undefined })));
    }, 800);

    if (nextEnemies.every(enemy => enemy.hp <= 0)) {
      window.setTimeout(resolveWaveClear, 380);
    }
    return { alive: nextEnemies.filter(enemy => enemy.hp > 0), skippedIds };
  }

  function resolvePlayerStatusBeforeAction(): boolean {
    if (demonized || playerStatusEffects.length === 0) return false;
    const result = processStatusEffects(playerStatusEffects, { maxHp: battleParty[0]?.maxHp ?? 1 });
    setPlayerStatusEffects(result.effects);
    if (result.totalDamage > 0) {
      spawnFloat('42%', '58%', result.totalDamage, { color: '#4ade80' });
      const labels = result.ticks.filter(tick => tick.damage).map(tick => AILMENT_UI[tick.type].label).join('/');
      addLog(`骸骨騎士は${labels}で${result.totalDamage}ダメージ。`);
    }
    result.ticks.filter(tick => tick.expired).forEach(tick => {
      addLog(`骸骨騎士の${AILMENT_UI[tick.type].label}が解除された。`);
    });
    if (!result.skipAction) return false;
    const control = result.ticks.find(tick => tick.skipped)?.type;
    addLog(`骸骨騎士は${control ? AILMENT_UI[control].label : '状態異常'}で行動できない。`);
    setPhase('playerTurn');
    endPlayerTurn();
    return true;
  }

  function getTargetId() {
    const t = enemies.find(e => e.targeted && e.hp > 0);
    return t ? t.id : (enemies.find(e => e.hp > 0)?.id ?? 0);
  }

  function endPlayerTurn() {
    if (enemiesRef.current.every(e => e.hp <= 0)) {
      resolveWaveClear();
      return;
    }
    let demonFormForEnemyTurn: DemonFormData | null = demonized ? demonForm : null;
    if (demonized) {
      const nextActions = demonActionsRemaining - 1;
      if (nextActions <= 0) {
        setDemonized(false);
        setDemonActionsRemaining(0);
        setDemonUltimateUsed(false);
        demonFormForEnemyTurn = null;
        addLog(`魔神化『${demonForm.formName}』が解除された。通常形態に戻る。`);
      } else {
        setDemonActionsRemaining(nextActions);
      }
    }
    if (!demonized) {
      setSoul(prev => Math.min(100, prev + 10));
    }
    setTimeout(() => runEnemyTurn(demonFormForEnemyTurn), speedMs * 0.4);
  }

  function runEnemyTurn(activeDemonForm: DemonFormData | null = demonized ? demonForm : null) {
    setPhase('enemyTurn');
    const turnToken = ++enemyTurnSerialRef.current;
    const alive = enemiesRef.current.filter(e => e.hp > 0);
    if (alive.length === 0) {
      resolveWaveClear();
      return;
    }
    const statusPhase = processEnemyStatusPhase();
    if (statusPhase.alive.length === 0) {
      resolveWaveClear();
      return;
    }
    let delay = 0;
    statusPhase.alive.forEach((enemy) => {
      if (statusPhase.skippedIds.has(enemy.id)) return;
      delay += speedMs * 0.55;
      setTimeout(() => {
        if (turnToken !== enemyTurnSerialRef.current) return;
        const enrage = enemy.gimmicks?.find(gimmick => gimmick.trigger === 'HP_BELOW_50' && gimmick.effect === 'ENRAGE');
        const enraged = Boolean(enrage && enemy.hp / enemy.maxHp <= 0.5);
        const incomingMult = getDemonIncomingDamageMultiplier(activeDemonForm);
        const effectiveAtk = enemy.atk * getAilmentAttackMultiplier(enemy.statusEffects);
        const dmg = Math.round(effectiveAtk * incomingMult * (enraged ? Number(enrage?.value ?? 1.35) : 1) * (0.8 + Math.random() * 0.4));
        spawnFloat('42%', '58%', dmg, { color: '#f87171' });
        addLog(`${enemy.name}${enraged ? 'の怒り' : ''}の攻撃！ 骸骨騎士に ${dmg}ダメージ！${incomingMult > 1 ? ' 紙装甲の代償で被害が増幅。' : ''}`);
        applyEnemyAilmentToPlayer(enemy, activeDemonForm);
        setFlashColor('rgba(239,68,68,0.25)');
        setTimeout(() => setFlashColor(null), 300);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 450);
      }, delay);
    });
    setTimeout(() => {
      if (turnToken !== enemyTurnSerialRef.current) return;
      setPhase('playerTurn');
      addLog('骸骨騎士のターン。コマンドを選択しろ。');
    }, delay + speedMs * 0.4);
  }

  function handleAttack() {
    if (phase !== 'playerTurn') return;
    if (resolvePlayerStatusBeforeAction()) return;
    sfx.battleAttack(demonized ? 'demon' : 'physical');
    setPhase('animating');
    const tid = getTargetId();
    const enemy = enemies.find(e => e.id === tid);
    const attackElement = demonized ? demonForm.ultimateSkill.damage.element : 'NONE';
    const hitCount = demonized ? getDemonActionHitCount(demonForm, 'SLASH') : 1;
    const demonMult = demonized ? getDemonDamageMultiplier(demonForm, 'SLASH') : 1;
    const ailmentMult = getAilmentAttackMultiplier(playerStatusEffects, demonized);
    const dmg = Math.round(1500 * demonMult * ailmentMult * (hitCount > 1 ? 0.62 : 1) * (0.75 + Math.random() * 0.25));
    triggerSkillEffect({
      name: demonized ? demonForm.formName : '攻撃',
      element: attackElement,
      attackType: 'SLASH',
      aoe: false,
    }, [tid]);
    addLog(demonized ? `魔神化『${demonForm.formName}』の攻撃！ ${enemy?.name}へ${hitCount > 1 ? `${hitCount}連撃` : '深淵の一撃'}！` : `骸骨騎士の攻撃！ ${enemy?.name}を狙う！`);
    setTimeout(() => {
      let totalDamage = 0;
      const hitInterval = battleDelay(120, 58);
      Array.from({ length: hitCount }).forEach((_, hitIndex) => {
        setTimeout(() => {
          totalDamage += damageEnemy(tid, dmg, { color: demonized ? demonColor : '#f0ebff', element: attackElement });
        }, hitIndex * hitInterval);
      });
      if (demonized) { setFlashColor(demonForm.visual?.soft ?? 'rgba(220,38,38,0.3)'); setTimeout(() => setFlashColor(null), 350); }
      setTimeout(() => {
        addLog(`${enemy?.name}に 合計${totalDamage}ダメージ！`);
        applyAilmentToEnemy(tid, { element: attackElement, attackType: 'SLASH' });
        if (demonized) {
          applyDemonRiskFeedback('SLASH');
        }
        setPhase('playerTurn');
        endPlayerTurn();
      }, hitCount * hitInterval + speedMs * 0.35);
    }, speedMs * 0.3);
  }

  function applyDemonRiskFeedback(attackType: SkillAttackType) {
    if (!demonized || !demonForm.effectB.riskType) return;
    if (demonForm.effectB.riskType === 'SELF_DAMAGE' && (attackType === 'MAGIC' || attackType === 'SUMMON')) {
      const backlash = Math.max(1, Math.round(demonForm.effectB.riskValue ?? 12));
      spawnFloat('42%', '58%', backlash, { color: '#fb7185' });
      addLog(`代償発動: 味方の生命を${backlash}%分燃やし、${demonForm.formName}が魔力を維持する。`);
      return;
    }
    if (demonForm.effectB.riskType === 'ENERGY_DRAIN') {
      const drain = Math.max(1, Math.round(demonForm.effectB.riskValue ?? 15));
      setSoul(prev => Math.max(0, prev - drain));
      addLog(`代償発動: 魂が過剰消費され、ソウル-${drain}。`);
      return;
    }
    if (demonForm.effectB.riskType === 'SETUP_DEPENDENT') {
      addLog('代償発動: 仕込みが薄い相手には深淵の理が完全には噛み合わない。');
    }
  }

  function handleSkill(skill: BattleSkill) {
    if (resolvePlayerStatusBeforeAction()) return;
    sfx.skillCast(skill.element, skill.attackType);
    setPhase('animating');
    const targets = skill.aoe ? enemies.filter(e => e.hp > 0).map(e => e.id) : [getTargetId()];
    const vfxStyle = ELEMENT_VFX[skill.element];
    const hitCount = demonized ? getDemonActionHitCount(demonForm, skill.attackType) : 1;
    const demonMult = demonized ? getDemonDamageMultiplier(demonForm, skill.attackType) : 1;
    const ailmentMult = getAilmentAttackMultiplier(playerStatusEffects, demonized);
    triggerSkillEffect(skill, targets);
    addLog(`${demonized ? `魔神化『${demonForm.formName}』` : '術'}発動！ ${skill.name}！ ${vfxStyle.label}属性/${ATTACK_TYPE_LABEL[skill.attackType]}`);
    setFlashColor(vfxStyle.soft);
    setTimeout(() => setFlashColor(null), 400);
    setTimeout(() => {
      const targetInterval = battleDelay(200, 90);
      const hitInterval = battleDelay(110, 55);
      targets.forEach((tid, i) => {
        setTimeout(() => {
          let totalDamage = 0;
          Array.from({ length: hitCount }).forEach((_, hitIndex) => {
            setTimeout(() => {
              const dmg = Math.round(skill.power * getElementBoostMultiplier(skill.element) * demonMult * ailmentMult * (hitCount > 1 ? 0.6 : 1) * (0.85 + Math.random() * 0.3));
              totalDamage += damageEnemy(tid, dmg, { color: vfxStyle.color, element: skill.element });
            }, hitIndex * hitInterval);
          });
          setTimeout(() => {
            addLog(`${enemies.find(e => e.id === tid)?.name}に 合計${totalDamage}ダメージ！`);
            applyAilmentToEnemy(tid, skill);
          }, hitCount * hitInterval + battleDelay(40, 25));
        }, i * targetInterval);
      });
      if (demonized) {
        applyDemonRiskFeedback(skill.attackType);
      }
      setTimeout(() => { setPhase('playerTurn'); endPlayerTurn(); }, targets.length * targetInterval + speedMs * 0.3);
    }, speedMs * 0.4);
  }

  function handleItem(item: typeof ITEMS[0]) {
    if (resolvePlayerStatusBeforeAction()) return;
    setPhase('animating');
    if (item.effect === 'heal') {
      spawnFloat('42%', '52%', item.value, { heal: true, color: '#4ade80' });
      addLog(`冥界薬を使用！ HP+${item.value}回復！`);
    } else {
      addLog(`エーテルを使用！ ENが全回復！`);
    }
    setTimeout(() => { setPhase('playerTurn'); endPlayerTurn(); }, speedMs * 0.5);
  }

  function handleDemonUltimate() {
    if (!demonized || demonUltimateUsed || phase !== 'playerTurn') return;
    if (resolvePlayerStatusBeforeAction()) return;
    sfx.demonUltimate();
    setDemonUltimateUsed(true);
    setPhase('animating');
    const ultimate = demonUltimateSkill;
    const targets = ultimate.aoe ? enemies.filter(e => e.hp > 0).map(e => e.id) : [getTargetId()];
    const vfxStyle = ELEMENT_VFX[ultimate.element];
    const damageMultiplier = getDemonDamageMultiplier(demonForm, ultimate.attackType) * getAilmentAttackMultiplier(playerStatusEffects, demonized);
    const ignoreShield = shouldBypassDefense(demonForm);
    triggerSkillEffect(ultimate, targets);
    addLog(`魔神技『${ultimate.name}』解放！ ${demonForm.formName}が戦場の理を塗り替える。`);
    setFlashColor(demonForm.visual?.soft ?? vfxStyle.soft);
    setTimeout(() => setFlashColor(null), 520);

    setTimeout(() => {
      const targetInterval = battleDelay(180, 85);
      targets.forEach((tid, i) => {
        setTimeout(() => {
          const dmg = Math.round(ultimate.power * damageMultiplier * (0.9 + Math.random() * 0.22));
          const actualDamage = damageEnemy(tid, dmg, { color: demonColor, element: ultimate.element, ignoreShield });
          addLog(`${enemies.find(e => e.id === tid)?.name}に ${actualDamage}ダメージ！`);
          applyAilmentToEnemy(tid, ultimate);
        }, i * targetInterval);
      });
      addLog(`残留効果: ${demonForm.ultimateSkill.lingering.descJa}`);
      setTimeout(() => { setPhase('playerTurn'); endPlayerTurn(); }, targets.length * targetInterval + speedMs * 0.35);
    }, speedMs * 0.45);
  }

  function handleDemonize() {
    if (!canActivateDemonMode(soul, demonized) || phase === 'animating' || phase === 'waveTransition') return;
    sfx.demonActivate();
    enemyTurnSerialRef.current += 1;
    const burstId = ++demonBurstIdRef.current;
    setAuto(false);
    setDemonized(true);
    setDemonActionsRemaining(DEMON_ACTION_LIMIT);
    setDemonUltimateUsed(false);
    setSoul(0);
    setDemonBurst({ id: burstId, form: demonForm });
    setScreenShake(true);
    window.setTimeout(() => setScreenShake(false), battleDelay(520, 260));
    window.setTimeout(() => {
      setDemonBurst(prev => prev?.id === burstId ? null : prev);
    }, battleDelay(1680, 980));
    const cleared = clearStatusEffectsByDemonize(playerStatusEffects);
    if (cleared.cleared.length > 0) {
      setPlayerStatusEffects(cleared.effects);
      addLog(`魔神化の閃光で状態異常を${cleared.cleared.length}件解除。`);
    }
    setFlashColor(demonForm.visual?.soft ?? 'rgba(180,0,0,0.5)');
    setTimeout(() => setFlashColor(null), 800);
    addLog(`☠ 魔神化『${demonForm.formName}』発動！ ${demonForm.concept}`);
    addLog('絶対割り込み: 敵の行動をキャンセルし、行動値を0に固定。状態異常とデバフを完全無効化。');
    addLog(`Effect A: ${demonForm.effectA.descJa}`);
    addLog(`Effect B: ${demonForm.effectB.descJa}`);
    setPhase('playerTurn');
  }

  function handleTargetEnemy(eid: number) {
    if (enemies.find(e => e.id === eid)?.hp === 0) return;
    setEnemies(prev => prev.map(e => ({ ...e, targeted: e.id === eid })));
  }

  // Auto battle
  useEffect(() => {
    if (!auto || phase !== 'playerTurn') return;
    const t = setTimeout(() => handleAttack(), speedMs * 0.4);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase]);

  if (showResult && battleResult) {
    return (
      <ResultScreen
        isVictory={battleResult.isVictory}
        expGained={battleResult.expGained}
        goldGained={battleResult.goldGained}
        itemsGained={battleResult.itemsGained}
        monstersGained={battleResult.monstersGained}
        isPurplePillar={battleResult.isPurplePillar}
        wavesCleared={battleResult.wavesCleared}
        totalWaves={battleResult.totalWaves}
        clearTime={battleResult.clearTime}
        onFinish={onEnd}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#06050f', position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }} data-demon={demonized ? 'true' : 'false'}>

      {/* ── TOP HUD ── */}
      <div style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingLeft: 12, paddingRight: 12, paddingBottom: 0,
        background: 'linear-gradient(180deg,rgba(3,1,12,0.92),rgba(3,1,12,0.6) 70%,transparent)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#8b7da8' }}>
            <span style={{ fontSize: 13 }}>‹</span>
            <span>マップ</span>
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700,
            color: demonized ? demonColor : '#8A2BE2',
            letterSpacing: '0.12em',
            textShadow: demonized ? `0 0 12px ${demonColor}` : '0 0 8px #8A2BE2',
            transition: 'all 0.5s ease',
          }}>{demonized ? `☠ ${demonForm.formName}` : currentWave.isBoss ? `⚠ ${currentWave.title} BOSS` : `${currentWave.title} — ${currentWave.label}/${battleWaves.length}`}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: phase === 'playerTurn' ? '#22c55e' : phase === 'enemyTurn' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: phase === 'playerTurn' ? '#22c55e' : phase === 'enemyTurn' ? '#ef4444' : '#f59e0b' }}/>
            {phase === 'playerTurn' ? '自ターン' : phase === 'enemyTurn' ? '敵ターン' : '行動中'}
          </div>
        </div>
        <TurnOrderStrip/>
      </div>

      {/* ── BATTLE ARENA ── */}
      <BattleArena
        enemies={enemies}
        onTargetEnemy={handleTargetEnemy}
        demonized={demonized}
        flashColor={flashColor}
        screenShake={screenShake}
        demonColor={demonColor}
      />

      {/* Damage floats overlay */}
      <DamageFloat floats={floats}/>

      {/* Element × attack-type skill VFX overlay */}
      <SkillEffectOverlay effect={skillEffect}/>

      {/* Demonization cinematic VFX overlay */}
      <DemonizeBurstOverlay burst={demonBurst}/>

      {/* ── BATTLE LOG ── */}
      <BattleLog lines={log}/>

      {/* ── PARTY STATUS ── */}
      <PartyStatusBar party={battleParty} demonized={demonized} playerStatusEffects={playerStatusEffects}/>

      {/* ── SOUL GAUGE ── */}
      <SoulGauge value={soul} demonized={demonized} demonColor={demonColor} actionsRemaining={demonActionsRemaining}/>

      {/* ── COMMAND PANEL ── */}
      <div style={{
        padding: '8px 12px',
        background: demonized
          ? 'linear-gradient(180deg,rgba(15,2,2,0.97),rgba(8,1,1,0.99))'
          : 'linear-gradient(180deg,rgba(4,1,14,0.97),rgba(3,1,10,0.99))',
        borderTop: `1px solid ${demonized ? '#dc262630' : 'rgba(255,255,255,0.07)'}`,
        transition: 'background 0.6s ease', zIndex: 10,
      }}>
        {phase === 'skillMenu' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: demonized ? '#ef4444' : '#8A2BE2', letterSpacing: '0.1em' }}>
                {demonized ? '魔神化スキル選択' : '術・スキル選択'}
              </div>
              <div onClick={() => setPhase('playerTurn')} style={{
                padding: '3px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', cursor: 'pointer',
              }}>← 戻る</div>
            </div>
            <div className="safe-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {mainSkills.map(skill => (
                <SkillButton key={skill.id} skill={skill} mp={currentMp}
                  onClick={(sk) => { setPhase('playerTurn'); handleSkill(sk); }}
                  demonized={demonized}/>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', lineHeight: 1.5 }}>
              スキルを選択してください。長押しで詳細確認。
            </div>
          </div>
        ) : phase === 'itemMenu' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: '#f59e0b', letterSpacing: '0.1em' }}>道具選択</div>
              <div onClick={() => setPhase('playerTurn')} style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', cursor: 'pointer' }}>← 戻る</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ITEMS.map(item => (
                <div key={item.id} onClick={() => { setPhase('playerTurn'); handleItem(item); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, cursor: 'pointer', animation: 'skillReveal 0.2s ease-out',
                }}>
                  <div style={{ fontSize: 18 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: '#f0ebff' }}>{item.name}</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8' }}>{item.desc}</div>
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#6b5f7a' }}>×{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {demonized && (
              <DemonStatusRibbon
                form={demonForm}
                actionsRemaining={demonActionsRemaining}
                ultimateUsed={demonUltimateUsed}
                ultimateName={demonUltimateSkill.name}
                canUseUltimate={phase === 'playerTurn' && !demonUltimateUsed}
                onUltimate={handleDemonUltimate}
              />
            )}
            <div style={{ display: 'flex', gap: 8, animation: 'commandReveal 0.3s ease-out' }}>
              <CommandButton
                id="tut-attack-btn"
                icon={demonized ? demonForm.visual?.icon ?? '☠' : '⚔'} label={demonized ? '魔撃' : '攻撃'}
                sublabel={demonized ? 'DEMON' : 'ATTACK'}
                enabled={phase === 'playerTurn'} color={demonized ? demonColor : '#8A2BE2'}
                demonized={demonized} onClick={handleAttack}/>
              <CommandButton
                id="tut-skill-btn"
                icon={demonized ? '✦' : '🔮'} label="術"
                sublabel={demonized ? 'DISTORT' : 'SKILL'}
                enabled={phase === 'playerTurn'} color={demonized ? demonColor : '#8A2BE2'}
                demonized={demonized} onClick={() => setPhase('skillMenu')}/>
              <CommandButton
                icon="🧪" label="道具" sublabel="ITEM"
                enabled={phase === 'playerTurn'} color="#f59e0b"
                onClick={() => setPhase('itemMenu')}/>
              {!demonized && (
                <CommandButton
                  id="tut-demon-btn"
                  icon="☠" label="魔神化"
                  sublabel={soulFull ? 'INTERRUPT' : `SOUL ${Math.round(soul)}%`}
                  enabled={soulFull && (phase === 'playerTurn' || phase === 'enemyTurn')}
                  color="#dc2626"
                  glow={soulFull}
                  onClick={handleDemonize}/>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── SYSTEM BAR ── */}
      <SystemBar
        auto={auto} speed={speed}
        onAuto={() => setAuto(a => !a)}
        onSpeedChange={setSpeed}
        onEscape={() => { addLog('逃走した。'); onEnd(); }}
        canEscape={true}/>

      {phase === 'waveTransition' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(138,43,226,0.22), transparent 56%)',
            animation: 'fadeIn 0.18s ease-out',
          }}
        >
          <div style={{
            padding: '14px 24px',
            borderRadius: 14,
            border: '1px solid rgba(188,0,251,0.6)',
            background: 'rgba(5,2,16,0.88)',
            boxShadow: '0 0 28px rgba(188,0,251,0.34)',
            color: '#f0ebff',
            fontFamily: "'Cinzel', serif",
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.14em',
          }}>
            WAVE CLEAR
          </div>
        </div>
      )}
    </div>
  );
}
