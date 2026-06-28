import enemiesData from './master/enemies.json';
import stagesData from './master/stages.json';
import skillsData from './master/skills.json';
import itemsData from './master/items.json';
import materialsData from './master/materials.json';
import areasData from './master/areas.json';
import {
  NECROMANCE_TIER_CONVENTION,
  validateEnemyDraft,
  type EnemyBalanceContext,
} from '../lib/agent/enemyBalance';
import {
  validateStageDraft,
  type StageBalanceContext,
} from '../lib/agent/stageBalance';
import { resolveSummonMinionIds } from '../logic/BossGimmickSystem';
import type { EnemyData, SkillData, StageData } from '../types/game';

const ENEMIES = enemiesData as Record<string, EnemyData>;
const STAGES = stagesData as Record<string, StageData>;
const SKILLS = skillsData as Record<string, SkillData>;

const NEW_ENEMY_IDS = [
  'gravewarden_colossus',
  'wandering_guard_wraith',
  'cursed_head_maid',
  'dragonbone_spawn',
] as const;

const TARGET_STAGE_IDS = [
  'area1_a_mini',
  'area1_b3',
  'area1_c1',
  'area1_c2',
  'area1_c3',
] as const;

function skillMeta(): NonNullable<EnemyBalanceContext['skillMeta']> {
  return Object.fromEntries(Object.entries(SKILLS).map(([id, skill]) => [
    id,
    { element: skill.element, type: skill.type, targetType: skill.targetType },
  ]));
}

function enemyContext(currentId: string): EnemyBalanceContext {
  return {
    existingEnemies: Object.fromEntries(Object.entries(ENEMIES).filter(([id]) => id !== currentId)),
    itemIds: new Set(Object.keys(itemsData)),
    materialIds: new Set(Object.keys(materialsData)),
    skillIds: new Set(Object.keys(SKILLS)),
    skillMeta: skillMeta(),
  };
}

function stageContext(currentId: string): StageBalanceContext {
  return {
    existingStages: STAGES as unknown as Record<string, unknown>,
    stageIds: new Set(Object.keys(STAGES).filter(id => id !== currentId)),
    enemyIds: new Set(Object.keys(ENEMIES)),
    enemyTiers: Object.fromEntries(Object.entries(ENEMIES).map(([id, enemy]) => [id, enemy.tier])),
    itemIds: new Set(Object.keys(itemsData)),
    materialIds: new Set(Object.keys(materialsData)),
    areaIds: new Set(Object.keys(areasData)),
  };
}

describe('CH1 Phase 2 new enemies', () => {
  test('adds the planned four-enemy roster with tier necromance conventions', () => {
    expect(Object.keys(ENEMIES)).toEqual(expect.arrayContaining([...NEW_ENEMY_IDS]));

    const expected = {
      gravewarden_colossus: { tier: 'BOSS', tribe: 'UNDEAD', skillCount: 2 },
      wandering_guard_wraith: { tier: 'MINION', tribe: 'UNDEAD', skillCount: 1 },
      cursed_head_maid: { tier: 'ELITE', tribe: 'HUMANOID', skillCount: 2 },
      dragonbone_spawn: { tier: 'MINION', tribe: 'DRAGON', skillCount: 1 },
    } as const;

    for (const id of NEW_ENEMY_IDS) {
      const enemy = ENEMIES[id];
      const convention = NECROMANCE_TIER_CONVENTION[expected[id].tier];

      expect(enemy).toMatchObject({
        id,
        tier: expected[id].tier,
        tribe: expected[id].tribe,
        necromance: {
          captureRate: convention.captureRate,
          allyCost: convention.allyCost,
        },
      });
      expect(enemy.necromance?.skillIds).toHaveLength(expected[id].skillCount);
      expect(enemy.necromance?.skillIds?.every(skillId => Boolean(SKILLS[skillId]))).toBe(true);
    }
  });

  test('passes enemyBalance with no warnings or failures', () => {
    for (const id of NEW_ENEMY_IDS) {
      const result = validateEnemyDraft(ENEMIES[id], enemyContext(id));
      const problems = result.findings.filter(finding => finding.level !== 'PASS');

      expect(result.ok).toBe(true);
      expect(problems).toEqual([]);
    }
  });

  test('gravewarden_colossus summons a grave_soldier add on shield break', () => {
    expect(ENEMIES.gravewarden_colossus.gimmicks).toEqual([
      { trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 1 },
    ]);
    expect(resolveSummonMinionIds('gravewarden_colossus', 1, 3)).toEqual(['grave_soldier']);
  });

  test('replaces the planned placeholder waves only', () => {
    expect(STAGES.area1_a_mini.waves[2]).toMatchObject({
      role: 'BOSS',
      enemyIds: ['gravewarden_colossus', 'grave_soldier'],
      statScale: { hp: 1.2, atk: 1.1, def: 1.1 },
    });
    expect(STAGES.area1_b3.waves[2].enemyIds).toEqual(['wandering_guard_wraith', 'bone_colossus']);
    expect(STAGES.area1_c1.waves[0].enemyIds).toEqual(['wandering_guard_wraith', 'dragonbone_spawn']);
    expect(STAGES.area1_c1.waves[2].enemyIds).toEqual([
      'bone_colossus',
      'dragonbone_spawn',
      'wandering_guard_wraith',
    ]);
    expect(STAGES.area1_c2.waves[2].enemyIds).toEqual([
      'cursed_head_maid',
      'abyss_warden',
      'bone_colossus',
    ]);
    expect(STAGES.area1_c3.waves[0].enemyIds).toEqual([
      'dragonbone_spawn',
      'bloodmire_leech',
      'earthbound_grudge',
    ]);
    expect(STAGES.area1_c3.waves[1].enemyIds).toEqual(['abyss_warden', 'dragonbone_spawn']);
    expect(STAGES.area1_c3.waves[2].enemyIds).toEqual(['blood_mire_queen']);
  });

  test('passes validateStageDraft for all touched stages', () => {
    for (const id of TARGET_STAGE_IDS) {
      const result = validateStageDraft(STAGES[id], stageContext(id));
      const failures = result.findings.filter(finding => finding.level === 'FAIL');

      expect(result.ok).toBe(true);
      expect(failures).toEqual([]);
    }
  });
});
