import type { MonsterData } from '../types/game';
import { calculateMonsterAttackProfile, getSpiritCoreAtkMultiplier } from './MonsterAttackSystem';

function makeMonster(overrides: Partial<MonsterData> = {}): MonsterData {
  return {
    id: 'm-1',
    name: 'Bone Hound',
    tribe: 'UNDEAD',
    cost: 2,
    stats: {
      hp: 300,
      atk: 100,
      def: 40,
      spd: 90,
      critRate: 0,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    },
    resistances: {},
    ...overrides,
  };
}

describe('MonsterAttackSystem', () => {
  test('uses default attack profile when SpiritCore is not equipped', () => {
    const profile = calculateMonsterAttackProfile(makeMonster());

    expect(profile.stats.atk).toBe(100);
    expect(profile.element).toBe('NONE');
    expect(profile.spiritCoreAtkMultiplier).toBe(1);
    expect(profile.spiritCoreName).toBeUndefined();
  });

  test('applies SpiritCore atkMultiplier and element to monster follow-up profile', () => {
    const profile = calculateMonsterAttackProfile(makeMonster({
      spiritCore: {
        id: 'core-thunder',
        name: '雷骸の霊核',
        element: 'THUNDER',
        atkMultiplier: 1.8,
      },
    }));

    expect(profile.stats.atk).toBe(180);
    expect(profile.element).toBe('THUNDER');
    expect(profile.spiritCoreAtkMultiplier).toBe(1.8);
    expect(profile.spiritCoreName).toBe('雷骸の霊核');
  });

  test('stacks awakened multiplier with SpiritCore multiplier', () => {
    const profile = calculateMonsterAttackProfile(makeMonster({
      spiritCore: {
        id: 'core-blood',
        name: '血盟の霊核',
        atkMultiplier: 1.25,
      },
    }), { awakened: true });

    expect(profile.stats.atk).toBe(187);
  });

  test('falls back to multiplier 1 for invalid SpiritCore values', () => {
    expect(getSpiritCoreAtkMultiplier(makeMonster({
      spiritCore: {
        id: 'broken',
        name: '破損霊核',
        atkMultiplier: 0,
      },
    }))).toBe(1);
  });
});
