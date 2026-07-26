import {
  calculateCharacterStatProfile,
  getCanonicalOptionType,
} from './StatSystem';
import type { CharacterData } from '../types/game';
import { makeBaseStats, makeCharacter } from '../testing/factories';

const basePlayer: CharacterData = makeCharacter({
  id: 'p1',
  baseStats: makeBaseStats({ hp: 1000, atk: 100, def: 50, critRate: 5 }),
  stats: makeBaseStats({ hp: 1000, atk: 100, def: 50, critRate: 5 }),
  passives: { passiveHpBonus: 10, passiveAtkBonus: 5, passiveDefBonus: 3, passiveSpdBonus: 2, passiveCritRateBonus: 1, passiveCritDmgBonus: 10 },
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
});

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

  test('does not apply necromance level bonuses to the player', () => {
    const baseProfile = calculateCharacterStatProfile(basePlayer, [
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
    const rankedPlayer: CharacterData = {
      ...basePlayer,
      necroLevel: 500,
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

    expect(profile.necro.hp).toBe(0);
    expect(profile.necro.atk).toBe(0);
    expect(profile.necro.def).toBe(0);
    expect(profile.necro.spd).toBe(0);
    expect(profile.necro.critRate).toBe(0);
    expect(profile.necro.critDmg).toBe(0);
    expect(profile.total).toEqual(baseProfile.total);
    expect(profile.elementDmgBoosts).toEqual(baseProfile.elementDmgBoosts);
  });
});
