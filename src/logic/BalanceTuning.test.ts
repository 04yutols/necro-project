import enemiesData from '../data/master/enemies.json';
import itemsData from '../data/master/items.json';
import jobsData from '../data/master/jobs.json';
import stagesData from '../data/master/stages.json';
import type { BaseStats, CharacterData, EnemyData, ItemData, JobData, MonsterData, StageData } from '../types/game';
import { calculateBattleDamage } from './BattleDamage';
import { BattleEngine } from './BattleEngine';
import { calculateJobAdjustedStats } from './JobSystem';
import { calculateWeaponBaseAttack } from './WeaponSystem';

const ENEMIES = enemiesData as Record<string, EnemyData>;
const ITEMS = itemsData as Record<string, ItemData>;
const JOBS = jobsData as Record<string, JobData>;
const STAGES = stagesData as Record<string, StageData>;

const STARTER_BASE_STATS: BaseStats = {
  hp: 60,
  atk: 8,
  def: 10,
  spd: 100,
  critRate: 5,
  critDmg: 150,
  effectHit: 0,
  effectRes: 0,
};

function makePlayer(finalStats: BaseStats): CharacterData {
  return {
    id: 'balance-player',
    name: 'Balance Player',
    currentJobId: 'warrior',
    category: 'PHYSICAL',
    baseStats: STARTER_BASE_STATS,
    stats: finalStats,
    passives: {
      passiveAtkBonus: 0,
      passiveDefBonus: 0,
      passiveSpdBonus: 0,
      passiveCritRateBonus: 0,
      passiveCritDmgBonus: 0,
      passiveHpBonus: 0,
    },
    equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
    baseResistances: {},
    jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
    isAwakened: false,
    clearedStages: [],
    currentEnergy: 0,
    maxEnergy: 100,
    elementDmgBoosts: {},
  };
}

function enemyToMonster(enemyId: string): MonsterData {
  const enemy = ENEMIES[enemyId];
  return {
    id: enemy.id,
    name: enemy.nameJa,
    tribe: enemy.tribe,
    cost: 1,
    stats: { ...enemy.stats },
    resistances: { ...enemy.resistances },
    weaknesses: [...enemy.weaknesses],
    shieldHp: enemy.shieldHp,
    maxShieldHp: enemy.maxShieldHp ?? enemy.shieldHp,
    tier: enemy.tier,
    gimmicks: enemy.gimmicks,
  };
}

describe('Balance tuning for area1_node1', () => {
  test('starter character and weapon use JRPG-scale attack values', () => {
    const warriorStats = calculateJobAdjustedStats(STARTER_BASE_STATS, JOBS.warrior);
    const starterWeaponAtk = calculateWeaponBaseAttack(ITEMS.bone_cleaver);

    expect(warriorStats.hp).toBe(68);
    expect(warriorStats.atk).toBe(10);
    expect(warriorStats.def).toBe(12);
    expect(starterWeaponAtk).toBe(1);
    expect(warriorStats.atk + starterWeaponAtk).toBe(11);
  });

  test('area1_node1 final wave is an elite tutorial fight, not a boss', () => {
    expect(STAGES.area1_node1.waves[2]).toMatchObject({
      label: 'WAVE 3',
      role: 'ELITE',
      enemyIds: ['grave_soldier', 'grave_knight'],
    });
    expect(ENEMIES.ossuary_wyrm_lord.stats.hp).toBe(180);
    expect(ENEMIES.grave_knight.stats.hp).toBe(40);
  });

  test('starter damage hits area1_node1 kill-count targets without crit variance', () => {
    const warriorStats = calculateJobAdjustedStats(STARTER_BASE_STATS, JOBS.warrior);
    const attackerStats = {
      ...warriorStats,
      atk: warriorStats.atk + calculateWeaponBaseAttack(ITEMS.bone_cleaver),
      critRate: 0,
    };
    const noCrit = () => 1;

    const graveSoldierAttack = calculateBattleDamage({
      attackerStats,
      defenderStats: ENEMIES.grave_soldier.stats,
      defenderResistances: ENEMIES.grave_soldier.resistances,
      rng: noCrit,
    });
    const graveSoldierSkill = calculateBattleDamage({
      attackerStats,
      defenderStats: ENEMIES.grave_soldier.stats,
      defenderResistances: ENEMIES.grave_soldier.resistances,
      powerMultiplier: 1.5,
      rng: noCrit,
    });
    const graveKnightAttack = calculateBattleDamage({
      attackerStats,
      defenderStats: ENEMIES.grave_knight.stats,
      defenderResistances: ENEMIES.grave_knight.resistances,
      rng: noCrit,
    });
    const graveKnightSkill = calculateBattleDamage({
      attackerStats,
      defenderStats: ENEMIES.grave_knight.stats,
      defenderResistances: ENEMIES.grave_knight.resistances,
      powerMultiplier: 1.5,
      rng: noCrit,
    });

    expect(graveSoldierAttack.damage).toBe(10);
    expect(graveSoldierSkill.damage).toBe(16);
    expect(graveKnightAttack.damage).toBe(10);
    expect(graveKnightSkill.damage).toBe(15);
  });

  test('abyss_warden shield breaks with two starter normal attacks', () => {
    const warriorStats = calculateJobAdjustedStats(STARTER_BASE_STATS, JOBS.warrior);
    const player = makePlayer({
      ...warriorStats,
      atk: warriorStats.atk + calculateWeaponBaseAttack(ITEMS.bone_cleaver),
      critRate: 0,
    });
    const target = enemyToMonster('abyss_warden');
    const engine = new BattleEngine(player, []);

    engine.simulateAction('PHYSICAL_ATTACK', target);
    expect(target.shieldHp).toBe(10);
    expect(target.shieldBroken).toBeFalsy();

    engine.simulateAction('PHYSICAL_ATTACK', target);
    expect(target.shieldHp).toBe(0);
    expect(target.shieldBroken).toBe(true);
  });
});
