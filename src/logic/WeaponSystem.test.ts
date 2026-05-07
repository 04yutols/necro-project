import {
  calculateDismantleRewards,
  calculateReforgedWeapon,
  calculateWeaponAttackBreakdown,
  calculateWeaponBaseAttack,
  getNextReforgeTargetIlv,
  getRankUpCost,
  getWeaponEffectiveSubOptions,
  hasEnoughWeaponMaterials,
} from './WeaponSystem';
import type { ItemData, WeaponMaterialData } from '../types/game';

const ssrMidWeapon: ItemData = {
  id: 'ssr-mid',
  name: '霊銀の斬骨刀',
  type: 'WEAPON',
  rarity: 'SSR',
  weaponRarity: 'SSR',
  archetype: 'MID',
  rank: 0,
  ilv: 90,
  stats: {},
  isUnique: false,
  subOptions: [{ type: 'ATK%', value: 13 }],
};

describe('WeaponSystem', () => {
  test('calculates FinalATK from character base, weapon base, percent, and flat ATK', () => {
    const breakdown = calculateWeaponAttackBreakdown(1000, ssrMidWeapon, {
      atkBonusPercent: 20,
      flatAtk: 120,
    });

    expect(breakdown.weaponBaseAtk).toBe(608);
    expect(breakdown.finalAtk).toBe(2050);
  });

  test('applies archetype substat coefficients to weapon sub options', () => {
    const lowBaseWeapon: ItemData = {
      ...ssrMidWeapon,
      id: 'ssr-low',
      archetype: 'LOW',
      subOptions: [{ type: 'CRIT_RATE', value: 8 }],
    };

    expect(getWeaponEffectiveSubOptions(lowBaseWeapon)[0]).toEqual({ type: 'CRIT_RATE', value: 9.6 });
  });

  test('reforge raises ILv and recalculates base ATK without changing passive rank', () => {
    const oldWeapon = { ...ssrMidWeapon, ilv: 20, rank: 3 };
    const targetIlv = getNextReforgeTargetIlv(oldWeapon);
    const reforged = calculateReforgedWeapon(oldWeapon, targetIlv ?? 20);

    expect(targetIlv).toBe(40);
    expect(reforged.rank).toBe(3);
    expect(calculateWeaponBaseAttack(reforged)).toBeGreaterThan(calculateWeaponBaseAttack(oldWeapon));
  });

  test('rank-up and dismantle costs use rarity-specific idea materials', () => {
    const cost = getRankUpCost({ ...ssrMidWeapon, rank: 1 });
    const rewards = calculateDismantleRewards(ssrMidWeapon);
    const materials: WeaponMaterialData[] = [
      { type: 'IDEA_SSR', name: '英雄のイデア', quantity: 4 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 0 },
    ];

    expect(cost).toEqual({ type: 'IDEA_SSR', name: '英雄のイデア', quantity: 4 });
    expect(rewards).toEqual([{ type: 'IDEA_SSR', name: '英雄のイデア', quantity: 3 }]);
    expect(hasEnoughWeaponMaterials(materials, cost ? [cost] : [])).toBe(true);
  });

  test('UR weapons are non-dismantleable cursed uniques', () => {
    const urWeapon: ItemData = {
      ...ssrMidWeapon,
      id: 'ur',
      rarity: 'UR',
      weaponRarity: 'UR',
      archetype: 'MYTHIC',
      isUnique: true,
      isUR: true,
    };

    expect(calculateDismantleRewards(urWeapon)).toEqual([]);
    expect(calculateWeaponBaseAttack(urWeapon)).toBeGreaterThan(calculateWeaponBaseAttack(ssrMidWeapon));
  });
});

