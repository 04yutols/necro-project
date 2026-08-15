import {
  authorCombatUnit,
  authorResidueName,
  authorSkill,
  authorWeapon,
  type GameplayAuthoringContext,
} from './gameplayAuthoring';

const ctx: GameplayAuthoringContext = {
  existingEnemies: {
    minion: { tier: 'MINION', stats: { hp: 40, atk: 8, def: 6, spd: 80, critRate: 2, critDmg: 150, effectHit: 5, effectRes: 5 } },
  },
  existingMonsters: {
    minion_ally: { cost: 1, stats: { hp: 50, atk: 10, def: 5, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 } },
  },
  existingSkills: {
    skill_undead: { id: 'skill_undead', type: 'PHYSICAL', element: 'DARK', targetType: 'SINGLE' },
  },
  existingItems: {},
  existingJobs: {
    warrior: { name: 'Warrior', displayName: '戦士', tier: 1, category: 'PHYSICAL', baseAttackType: 'SLASH' },
  },
  materials: {},
};

describe('gameplayAuthoring', () => {
  test('combat-unit authoring separates shared stats from enemy master data', () => {
    const result = authorCombatUnit({
      kind: 'ENEMY', id: 'phase2_wraith', name: 'Phase2 Wraith', nameJa: '試験亡霊',
      description: '決定論ゲート用の試験敵。', role: 'CONTROLLER', level: 20,
      tier: 'MINION', tribe: 'UNDEAD', weaknesses: ['LIGHT'], resistances: ['DARK'], maxEnergy: 30,
      skillIds: ['skill_undead'],
    }, ctx);

    expect(result.scope).toBe('enemy');
    expect(result.shared.stats.effectHit).toBeGreaterThan(5);
    expect(result.shared.growth['1']).toBeDefined();
    expect(result.shared.growth['20']).toEqual(result.shared.stats);
    expect(result.changeData.resistances).toEqual({ LIGHT: -25, DARK: 20 });
    expect(result.gate.ok).toBe(true);

    const higherLevel = authorCombatUnit({
      kind: 'ENEMY', id: 'phase2_wraith_high', name: 'Phase2 Wraith High', description: '高レベル比較。',
      role: 'CONTROLLER', level: 40, tier: 'MINION', tribe: 'UNDEAD', skillIds: ['skill_undead'],
    }, ctx);
    expect(higherLevel.shared.stats.hp).toBeGreaterThan(result.shared.stats.hp);
  });

  test('skill authoring uses power bands and ailment budget', () => {
    const result = authorSkill({
      id: 'phase2_bleed', name: '墓血斬り', description: '墓土の血を刃に変える。',
      type: 'PHYSICAL', targetType: 'SINGLE', element: 'DARK', attackType: 'SLASH',
      ownerKind: 'job', ownerId: 'warrior', tier: 1, potency: 'MID', ailmentType: 'BLEED',
    }, ctx);

    expect(result.gate.ok).toBe(true);
    expect(result.changeData.mpCost).toBe(12);
    expect(result.changeData.power).toBeGreaterThanOrEqual(result.budget.powerRange[0]);
    expect(result.budget.ailmentBudget).toBeGreaterThanOrEqual(57);
  });

  test('ultimate authoring is validated against the ultimate range', () => {
    const result = authorSkill({
      id: 'phase2_ultimate', name: '亡王断罪', description: '全MPを断罪の一撃へ変える。',
      type: 'PHYSICAL', targetType: 'SINGLE', element: 'DARK', attackType: 'SLASH',
      ownerKind: 'job', ownerId: 'warrior', tier: 2, potency: 'HIGH', isUltimate: true, ultimateCost: 100,
    }, ctx);

    expect(result.gate.ok).toBe(true);
    expect(result.changeData.isUltimate).toBe(true);
    expect(result.changeData.power).toBeGreaterThanOrEqual(3.5);
    expect(result.changeData.mpCost).toBe(100);
  });

  test('weapon authoring derives base ATK, rarity slots, and five passive ranks', () => {
    const result = authorWeapon({
      id: 'phase2_void_blade', name: '虚無葬送剣', flavor: '亡国の夜を鋼へ封じた剣。',
      rarity: 'SSR', archetype: 'HIGH', ilv: 70, subOption: 'CRIT_RATE', element: 'DARK',
      passiveA: { nameJa: '夜葬', descTemplate: '闇属性ダメージが{value}%上昇する。', baseValue: 8 },
      passiveB: { nameJa: '断末魔', descTemplate: '会心率が{value}%上昇する。', baseValue: 5 },
    }, ctx);

    expect(result.gate.ok).toBe(true);
    expect(result.baseAtk.current).toBeGreaterThan(0);
    expect(result.changeData.subOptions).toHaveLength(2);
    expect(result.changeData.passiveA?.values).toHaveLength(5);
    expect(result.changeData.passiveA?.values[4]).toBe(16);
  });

  test('residue authoring cannot author performance fields', () => {
    const result = authorResidueName({
      id: 'phase2_residue', name: '煤涙の残滓', rarity: 'RARE', chapter: 1,
      origin: '王都焼失跡', themes: ['灰', '喪失'],
    });

    expect(result.changeData).not.toHaveProperty('stats');
    expect(result.approvalBoundary.performance).toContain('deterministic RNG');
  });
});
