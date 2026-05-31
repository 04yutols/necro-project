import {
  calculateCharacterStatProfile,
  calculateNecroBaseStatsContribution,
  getCanonicalOptionType,
  normalizeNecroBaseStatsBonus,
} from './StatSystem';
import type { CharacterData } from '../types/game';

const basePlayer: CharacterData = {
  id: 'p1',
  name: 'Hero',
  currentJobId: 'warrior',
  category: 'PHYSICAL',
  baseStats: { hp: 1000, atk: 100, def: 50, spd: 100, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0 },
  stats: { hp: 1000, atk: 100, def: 50, spd: 100, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0 },
  passives: { passiveHpBonus: 100, passiveAtkBonus: 5, passiveDefBonus: 3, passiveSpdBonus: 2, passiveCritRateBonus: 1, passiveCritDmgBonus: 10 },
  equipment: {
    weapon: { id: 'w1', name: 'Blade', type: 'WEAPON', rarity: 'COMMON', stats: { atk: 20 }, subOptions: [{ type: 'FIRE_DMG_BOOST', value: 12 }], isUnique: false },
    sub: null,
    head: null,
    body: null,
    arms: null,
    legs: null,
    acc1: null,
    acc2: null,
  },
  baseResistances: {},
  jobs: [],
  isAwakened: false,
  clearedStages: [],
  currentEnergy: 0,
  maxEnergy: 100,
  elementDmgBoosts: {},
};

describe('StatSystem', () => {
  test('normalizes legacy option names into the HSR stat model', () => {
    expect(getCanonicalOptionType('MATK%')).toBe('ATK%');
    expect(getCanonicalOptionType('AGI%')).toBe('SPD%');
    expect(getCanonicalOptionType('LUCK%')).toBe('CRIT_RATE%');
    expect(getCanonicalOptionType('TEC%')).toBe('CRIT_DMG%');
  });

  test('builds total stats from job, passives, equipment, and residues', () => {
    const profile = calculateCharacterStatProfile(basePlayer, [
      {
        id: 'r1',
        name: 'Residue',
        itemId: 'r1',
        rarity: 'RARE',
        mainStat: { type: 'ATK%', value: 10 },
        subOptions: [{ type: 'CRIT_RATE', value: 3 }, { type: 'DARK_DMG_BOOST', value: 8 }],
        level: 1,
        exp: 0,
        maxExp: 100,
      },
    ]);

    expect(profile.total.atk).toBe(135);
    expect(profile.total.critRate).toBe(9);
    expect(profile.total.critDmg).toBe(160);
    expect(profile.elementDmgBoosts.FIRE).toBe(12);
    expect(profile.elementDmgBoosts.DARK).toBe(8);
  });

  test('applies necro rank bonus to base combat stats before equipment and residues', () => {
    const rankedPlayer: CharacterData = {
      ...basePlayer,
      necroBaseStatsBonus: 1.5,
    };

    const profile = calculateCharacterStatProfile(rankedPlayer, [
      {
        id: 'r1',
        name: 'Residue',
        itemId: 'r1',
        rarity: 'RARE',
        mainStat: { type: 'ATK%', value: 10 },
        subOptions: [],
        level: 1,
        exp: 0,
        maxExp: 100,
      },
    ]);

    expect(profile.necro.hp).toBe(500);
    expect(profile.necro.atk).toBe(50);
    expect(profile.necro.def).toBe(25);
    expect(profile.necro.spd).toBe(50);
    expect(profile.necro.critRate).toBe(0);
    expect(profile.total.hp).toBe(1600);
    expect(profile.total.atk).toBe(190);
    expect(profile.total.def).toBe(78);
    expect(profile.total.spd).toBe(152);
  });

  test('normalizes invalid necro rank bonuses to neutral multiplier', () => {
    expect(normalizeNecroBaseStatsBonus(undefined)).toBe(1);
    expect(normalizeNecroBaseStatsBonus(0)).toBe(1);
    expect(calculateNecroBaseStatsContribution(basePlayer.stats, undefined).atk).toBe(0);
  });
});
