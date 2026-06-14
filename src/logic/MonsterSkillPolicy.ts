import type { ElementType, MonsterData, Resistances, SkillData } from '../types/game';
import { resolveMonsterCurrentEnergy } from './MonsterEnergySystem';

export type MonsterActionChoice =
  | { type: 'ATTACK' }
  | { type: 'SKILL'; skillId: string };

export interface MonsterSkillTarget {
  hp: number;
  resistances?: Resistances;
}

function resolveSkillMap(skills: Record<string, SkillData> | readonly SkillData[]): Record<string, SkillData> {
  if (!Array.isArray(skills)) return skills as Record<string, SkillData>;
  return Object.fromEntries((skills as readonly SkillData[]).map(skill => [skill.id, skill]));
}

function isOffensiveMonsterSkill(skill: SkillData): boolean {
  return skill.type !== 'HEAL'
    && skill.targetType !== 'SELF'
    && skill.targetType !== 'ALLY'
    && skill.power > 0;
}

function getResistanceScore(element: ElementType, targets: readonly MonsterSkillTarget[]): number {
  if (element === 'NONE') return 0;
  return targets.reduce((score, target) => {
    const resistance = target.resistances?.[element] ?? 0;
    if (resistance < 0) return score + 0.35;
    if (resistance > 0) return score - 0.2;
    return score;
  }, 0);
}

export function getUsableMonsterSkills(
  monster: Pick<MonsterData, 'skillIds' | 'currentEnergy' | 'maxEnergy'>,
  skills: Record<string, SkillData> | readonly SkillData[],
): SkillData[] {
  const skillMap = resolveSkillMap(skills);
  const currentEnergy = resolveMonsterCurrentEnergy(monster);
  return (monster.skillIds ?? [])
    .map(skillId => skillMap[skillId])
    .filter((skill): skill is SkillData => Boolean(skill))
    .filter(isOffensiveMonsterSkill)
    .filter(skill => skill.mpCost <= currentEnergy);
}

export function pickMonsterAction(
  monster: Pick<MonsterData, 'skillIds' | 'currentEnergy' | 'maxEnergy'>,
  skills: Record<string, SkillData> | readonly SkillData[],
  enemies: readonly MonsterSkillTarget[],
): MonsterActionChoice {
  const aliveTargets = enemies.filter(enemy => enemy.hp > 0);
  const usable = getUsableMonsterSkills(monster, skills);
  if (usable.length === 0 || aliveTargets.length === 0) return { type: 'ATTACK' };

  const scored = usable
    .map(skill => {
      const targetCount = skill.targetType === 'ALL_ENEMIES' ? aliveTargets.length : 1;
      const aoeBonus = aliveTargets.length > 1 && skill.targetType === 'ALL_ENEMIES' ? 0.45 : 0;
      const resistanceScore = getResistanceScore(skill.element ?? 'NONE', aliveTargets);
      const efficiency = skill.power * targetCount + aoeBonus + resistanceScore - skill.mpCost * 0.005;
      return { skill, efficiency };
    })
    .sort((a, b) => b.efficiency - a.efficiency || a.skill.mpCost - b.skill.mpCost);

  return { type: 'SKILL', skillId: scored[0].skill.id };
}
