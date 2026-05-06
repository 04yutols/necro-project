import type { BaseStats, CharacterData, JobData, SkillData } from '../types/game';

export const STAT_KEYS: (keyof BaseStats)[] = ['hp', 'mp', 'atk', 'def', 'matk', 'mdef', 'agi', 'luck', 'tec'];

export const JOB_ORDER = [
  'warrior',
  'mage',
  'dark_priest',
  'rogue',
  'dark_knight',
  'berserker',
  'archmage',
  'sorcerer',
  'warlock',
  'necromancer',
  'assassin',
  'trickster',
];

export const JOB_STYLE: Record<string, { color: string; glow: string; soft: string; emoji: string; motif: string }> = {
  warrior: { color: '#FF9955', glow: 'rgba(255,153,85,0.52)', soft: 'rgba(255,153,85,0.13)', emoji: '⚔', motif: 'SWORD' },
  mage: { color: '#5599FF', glow: 'rgba(85,153,255,0.52)', soft: 'rgba(85,153,255,0.13)', emoji: '✦', motif: 'ARCANA' },
  dark_priest: { color: '#BB55FF', glow: 'rgba(187,85,255,0.5)', soft: 'rgba(187,85,255,0.13)', emoji: '☾', motif: 'RITE' },
  rogue: { color: '#55FFBB', glow: 'rgba(85,255,187,0.44)', soft: 'rgba(85,255,187,0.12)', emoji: '◇', motif: 'DAGGER' },
  dark_knight: { color: '#C45CFF', glow: 'rgba(196,92,255,0.55)', soft: 'rgba(196,92,255,0.15)', emoji: '◆', motif: 'ECLIPSE' },
  berserker: { color: '#FF5E4D', glow: 'rgba(255,94,77,0.55)', soft: 'rgba(255,94,77,0.14)', emoji: '▲', motif: 'RAGE' },
  archmage: { color: '#68C7FF', glow: 'rgba(104,199,255,0.55)', soft: 'rgba(104,199,255,0.13)', emoji: '✧', motif: 'ORBIT' },
  sorcerer: { color: '#7DD3FC', glow: 'rgba(125,211,252,0.5)', soft: 'rgba(125,211,252,0.12)', emoji: '◌', motif: 'TEMPEST' },
  warlock: { color: '#A855F7', glow: 'rgba(168,85,247,0.56)', soft: 'rgba(168,85,247,0.16)', emoji: '✹', motif: 'ABYSS' },
  necromancer: { color: '#DD22FF', glow: 'rgba(221,34,255,0.58)', soft: 'rgba(221,34,255,0.15)', emoji: '☠', motif: 'LEGION' },
  assassin: { color: '#F472B6', glow: 'rgba(244,114,182,0.48)', soft: 'rgba(244,114,182,0.13)', emoji: '✕', motif: 'EXECUTE' },
  trickster: { color: '#FACC15', glow: 'rgba(250,204,21,0.45)', soft: 'rgba(250,204,21,0.12)', emoji: '✣', motif: 'MIRAGE' },
};

export const DEFAULT_JOB_STYLE = {
  color: '#8B00FF',
  glow: 'rgba(139,0,255,0.45)',
  soft: 'rgba(139,0,255,0.12)',
  emoji: '◆',
  motif: 'VOID',
};

export function getJobStyle(jobId: string) {
  return JOB_STYLE[jobId] ?? DEFAULT_JOB_STYLE;
}

export function normalizeJobData(jobId: string, job: JobData): JobData {
  return { ...job, id: job.id ?? jobId };
}

export function getJobLevel(character: CharacterData, jobId: string): number {
  return character.jobs.find((job) => job.jobId === jobId)?.level ?? 0;
}

export function getJobExp(character: CharacterData, jobId: string): number {
  return character.jobs.find((job) => job.jobId === jobId)?.exp ?? 0;
}

export function calculateJobAdjustedStats(baseStats: BaseStats, job: JobData): BaseStats {
  return STAT_KEYS.reduce((next, key) => {
    const modifier = job.statModifiers?.[key] ?? 1;
    next[key] = Math.max(1, Math.round(baseStats[key] * modifier));
    return next;
  }, {} as BaseStats);
}

export function addPassiveBonuses(stats: BaseStats, character: CharacterData): BaseStats {
  return {
    ...stats,
    atk: stats.atk + (character.passives.passiveAtkBonus ?? 0),
    def: stats.def + (character.passives.passiveDefBonus ?? 0),
    matk: stats.matk + (character.passives.passiveMatkBonus ?? 0),
    mdef: stats.mdef + (character.passives.passiveMdefBonus ?? 0),
  };
}

export function getJobUnlockStatus(character: CharacterData, job: JobData) {
  const requirements = job.unlock?.jobs ?? [];
  const missing = requirements.filter((requirement) => getJobLevel(character, requirement.jobId) < requirement.minLevel);
  return {
    unlocked: missing.length === 0,
    requirements,
    missing,
  };
}

export function getUnlockedSkillIds(job: JobData, level: number): string[] {
  return job.skills
    .filter((skill) => level >= skill.level)
    .map((skill) => skill.skillId);
}

export function resolveJobSkills(job: JobData, level: number, skills: Record<string, SkillData>) {
  return job.skills.map((unlock) => ({
    ...unlock,
    unlocked: level >= unlock.level,
    skill: skills[unlock.skillId],
  }));
}

export function resolveUnlockedJobSkills(job: JobData, level: number, skills: Record<string, SkillData>): SkillData[] {
  return resolveJobSkills(job, level, skills)
    .filter((entry) => entry.unlocked && entry.skill)
    .map((entry) => entry.skill);
}
