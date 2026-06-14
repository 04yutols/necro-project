import type { MonsterData, SkillData } from '../types/game';
import { getUsableMonsterSkills, pickMonsterAction } from './MonsterSkillPolicy';

const skills: Record<string, SkillData> = {
  single: {
    id: 'single',
    name: '単体術',
    mpCost: 10,
    power: 1.8,
    type: 'MAGICAL',
    element: 'FIRE',
    attackType: 'MAGIC',
    targetType: 'SINGLE',
    description: '',
  },
  aoe: {
    id: 'aoe',
    name: '全体術',
    mpCost: 14,
    power: 1.2,
    type: 'MAGICAL',
    element: 'DARK',
    attackType: 'SUMMON',
    targetType: 'ALL_ENEMIES',
    description: '',
  },
  expensive: {
    id: 'expensive',
    name: '重い術',
    mpCost: 99,
    power: 9,
    type: 'MAGICAL',
    element: 'FIRE',
    attackType: 'MAGIC',
    targetType: 'SINGLE',
    description: '',
  },
};

const monster: Pick<MonsterData, 'skillIds' | 'currentEnergy' | 'maxEnergy'> = {
  skillIds: ['single', 'aoe', 'expensive'],
  currentEnergy: 20,
  maxEnergy: 20,
};

describe('MonsterSkillPolicy', () => {
  test('filters usable skills by monster MP and known skill ids', () => {
    expect(getUsableMonsterSkills(monster, skills).map(skill => skill.id)).toEqual(['single', 'aoe']);
  });

  test('prefers AoE when multiple enemies are alive', () => {
    expect(pickMonsterAction(monster, skills, [
      { hp: 100, resistances: {} },
      { hp: 100, resistances: {} },
    ])).toEqual({ type: 'SKILL', skillId: 'aoe' });
  });

  test('falls back to attack when no skill can be paid', () => {
    expect(pickMonsterAction({ ...monster, currentEnergy: 1 }, skills, [
      { hp: 100, resistances: {} },
    ])).toEqual({ type: 'ATTACK' });
  });

  test('uses weakness scoring to choose a single target skill', () => {
    expect(pickMonsterAction(monster, skills, [
      { hp: 100, resistances: { FIRE: -30, DARK: 40 } },
    ])).toEqual({ type: 'SKILL', skillId: 'single' });
  });
});
