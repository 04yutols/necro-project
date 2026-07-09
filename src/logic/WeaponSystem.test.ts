import {
  calculateDismantleRewards,
  calculateReforgedWeapon,
  calculateWeaponAttackBreakdown,
  calculateWeaponBaseAttack,
  getNextReforgeTargetIlv,
  getRankUpCost,
  getReforgeCost,
  getWeaponEffectiveSubOptions,
  getWeaponSubOptionRule,
  hasEnoughWeaponMaterials,
  validateWeaponSubOptions,
} from './WeaponSystem';
import type { ItemData, WeaponMaterialData } from '../types/game';
import itemsData from '../data/master/items.json';

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

    expect(breakdown.weaponBaseAtk).toBe(165);
    expect(breakdown.finalAtk).toBe(1518);
  });

  test('applies archetype and milestone growth coefficients to weapon sub options', () => {
    const lowBaseWeapon: ItemData = {
      ...ssrMidWeapon,
      id: 'ssr-low',
      archetype: 'LOW',
      subOptions: [{ type: 'CRIT_RATE', value: 8 }],
    };

    expect(getWeaponEffectiveSubOptions(lowBaseWeapon)[0]).toEqual({ type: 'CRIT_RATE', value: 12.7 });
  });

  test('reforge raises ILv by one and recalculates base ATK without changing passive rank', () => {
    const oldWeapon = { ...ssrMidWeapon, ilv: 20, rank: 3 };
    const targetIlv = getNextReforgeTargetIlv(oldWeapon);
    const reforged = calculateReforgedWeapon(oldWeapon, targetIlv ?? 20);

    expect(targetIlv).toBe(21);
    expect(reforged.rank).toBe(3);
    expect(calculateWeaponBaseAttack(reforged)).toBeGreaterThan(calculateWeaponBaseAttack(oldWeapon));
  });

  test('raises main ATK on every ILv for every rarity', () => {
    const weapons: ItemData[] = [
      { ...ssrMidWeapon, id: 'r', rarity: 'R', weaponRarity: 'R', archetype: 'MID' },
      { ...ssrMidWeapon, id: 'sr', rarity: 'SR', weaponRarity: 'SR', archetype: 'MID' },
      { ...ssrMidWeapon, id: 'ssr', rarity: 'SSR', weaponRarity: 'SSR', archetype: 'MID' },
      { ...ssrMidWeapon, id: 'ur', rarity: 'UR', weaponRarity: 'UR', archetype: 'MYTHIC', isUR: true },
    ];

    for (const weapon of weapons) {
      for (let ilv = 1; ilv < 90; ilv += 1) {
        expect(calculateWeaponBaseAttack({ ...weapon, ilv: ilv + 1 }))
          .toBeGreaterThan(calculateWeaponBaseAttack({ ...weapon, ilv }));
      }
    }
  });

  test('raises substats only at 20 ILv milestones with rarity-specific growth', () => {
    const option = [{ type: 'ATK%', value: 10 }];
    const at19 = getWeaponEffectiveSubOptions({ ...ssrMidWeapon, ilv: 19, subOptions: option });
    const at20 = getWeaponEffectiveSubOptions({ ...ssrMidWeapon, ilv: 20, subOptions: option });
    const at39 = getWeaponEffectiveSubOptions({ ...ssrMidWeapon, ilv: 39, subOptions: option });
    const at40 = getWeaponEffectiveSubOptions({ ...ssrMidWeapon, ilv: 40, subOptions: option });
    const rAt90 = getWeaponEffectiveSubOptions({ ...ssrMidWeapon, rarity: 'R', weaponRarity: 'R', ilv: 90, subOptions: option });

    expect(at19[0].value).toBe(11);
    expect(at20[0].value).toBe(11.6);
    expect(at39[0].value).toBe(11.6);
    expect(at40[0].value).toBe(12.1);
    expect(rAt90[0].value).toBe(12);
    expect(getWeaponEffectiveSubOptions({ ...ssrMidWeapon, ilv: 90, subOptions: option })[0].value).toBe(13.2);
  });

  test('gives SR stronger single-option scaling while SSR trades some scaling for an element slot', () => {
    const option = [{ type: 'ATK%', value: 10 }];
    const r = { ...ssrMidWeapon, rarity: 'R' as const, weaponRarity: 'R' as const, archetype: 'MID' as const, subOptions: option };
    const sr = { ...ssrMidWeapon, rarity: 'SR' as const, weaponRarity: 'SR' as const, archetype: 'MID' as const, subOptions: option };
    const ssr = { ...ssrMidWeapon, rarity: 'SSR' as const, weaponRarity: 'SSR' as const, archetype: 'MID' as const, subOptions: option };
    const ur = { ...ssrMidWeapon, rarity: 'UR' as const, weaponRarity: 'UR' as const, archetype: 'MID' as const, subOptions: option };

    expect(getWeaponEffectiveSubOptions(r)[0].value).toBe(12);
    expect(getWeaponEffectiveSubOptions(sr)[0].value).toBe(15.5);
    expect(getWeaponEffectiveSubOptions(ssr)[0].value).toBe(13.2);
    expect(getWeaponEffectiveSubOptions(ur)[0].value).toBe(17.4);
  });

  test('requires one option for R and SR, and one fixed element option among two for SSR and UR', () => {
    const weapons = itemsData as Record<string, ItemData>;

    expect(getWeaponSubOptionRule(weapons.bone_cleaver)).toMatchObject({ optionCount: 1, elementDamageOptionCount: 0 });
    expect(getWeaponSubOptionRule(weapons.bleed_reaver)).toMatchObject({ optionCount: 1, elementDamageOptionCount: 0 });
    expect(getWeaponSubOptionRule(weapons.spirit_silver_saber)).toMatchObject({ optionCount: 2, elementDamageOptionCount: 1 });
    expect(getWeaponSubOptionRule(weapons.grudge_manifest)).toMatchObject({ optionCount: 2, elementDamageOptionCount: 1 });

    for (const weapon of Object.values(weapons).filter((item) => item.type === 'WEAPON')) {
      expect(validateWeaponSubOptions(weapon)).toEqual([]);
    }
  });

  test('charges black steel every ILv and adds an idea at 20 ILv milestones', () => {
    const rWeapon = { ...ssrMidWeapon, rarity: 'R' as const, weaponRarity: 'R' as const };
    const srWeapon = { ...ssrMidWeapon, rarity: 'SR' as const, weaponRarity: 'SR' as const };

    expect(getReforgeCost({ ...rWeapon, ilv: 18 })).toEqual([
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 1 },
    ]);
    expect(getReforgeCost({ ...rWeapon, ilv: 19 })).toEqual([
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 1 },
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 1 },
    ]);
    expect(getReforgeCost({ ...srWeapon, ilv: 20 })).toEqual([
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 3 },
    ]);
    expect(getNextReforgeTargetIlv({ ...ssrMidWeapon, ilv: 90 })).toBeNull();
    expect(getReforgeCost({ ...ssrMidWeapon, ilv: 90 })).toEqual([]);
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
