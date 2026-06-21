import { SCOPE_REGISTRY, getScopeEntry, type MasterData } from './scopeRegistry';

const ALL: MasterData = {
  areas: { ch1_area1: { id: 'ch1_area1', chapter: 1, area: 1 } },
  enemies: {
    grave_soldier: { id: 'grave_soldier', tier: 'MINION', tribe: 'UNDEAD', stats: { hp: 15, atk: 4, def: 3, spd: 70 } },
    bone_colossus: { id: 'bone_colossus', tier: 'ELITE', tribe: 'UNDEAD', stats: { hp: 72, atk: 9, def: 9, spd: 68 } },
  },
  items: { bone_cleaver: { id: 'bone_cleaver', type: 'WEAPON', rarity: 'R' } },
  materials: { bone_chip: { id: 'bone_chip', rarity: 'COMMON', expValue: 120 } },
  skills: { skill_warrior_1: { id: 'skill_warrior_1', type: 'PHYSICAL', element: 'NONE', attackType: 'SLASH', targetType: 'SINGLE', mpCost: 5, power: 1.5 } },
  jobs: { warrior: { id: 'warrior', category: 'PHYSICAL', baseAttackType: 'SLASH', tier: 1, skills: [{ level: 1, skillId: 'skill_warrior_1' }] } },
  stages: {},
  demonForms: {},
  monsters: { goblin: { name: 'Goblin', tribe: 'HUMANOID', cost: 1, stats: { hp: 50, atk: 10, def: 5, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 } } },
};

describe('SCOPE_REGISTRY coverage', () => {
  it('registers all 9 scopes', () => {
    expect(Object.keys(SCOPE_REGISTRY).sort()).toEqual(
      ['areas', 'demonForms', 'enemies', 'items', 'jobs', 'materials', 'monsters', 'skills', 'stages'].sort(),
    );
  });
});

describe('buildContext self-exclusion', () => {
  it('excludes the target id from existingEnemies (no self-collision)', () => {
    const entry = getScopeEntry('enemies')!;
    const ctx = entry.buildContext(ALL, 'grave_soldier', ALL.enemies.grave_soldier) as { existingEnemies: Record<string, unknown> };
    expect('grave_soldier' in ctx.existingEnemies).toBe(false);
    expect('bone_colossus' in ctx.existingEnemies).toBe(true);
  });

  it('passes necro capture config into enemy validation context', () => {
    const entry = getScopeEntry('enemies')!;
    const all = {
      ...ALL,
      necroConfig: { captureRate: { cap: 0.5, rankMultiplier: 1.2 } },
    } as unknown as MasterData;
    const ctx = entry.buildContext(all, 'grave_soldier', ALL.enemies.grave_soldier) as {
      necroCapRate?: number;
      necroRankMultiplier?: number;
    };

    expect(ctx.necroCapRate).toBe(0.5);
    expect(ctx.necroRankMultiplier).toBe(1.2);
  });

  it('excludes the target id from materials id set', () => {
    const entry = getScopeEntry('materials')!;
    const ctx = entry.buildContext(ALL, 'bone_chip', ALL.materials.bone_chip) as { materialIds: Set<string> };
    expect(ctx.materialIds.has('bone_chip')).toBe(false);
  });
});

describe('validate routes to the correct validator', () => {
  it('enemies: a self-consistent existing enemy passes (no self-id collision)', () => {
    const entry = getScopeEntry('enemies')!;
    const enemy = {
      id: 'grave_soldier', name: 'Grave Soldier', nameJa: '霊体騎士', nameEn: 'GRAVE SOLDIER',
      tier: 'MINION', tribe: 'UNDEAD',
      stats: { hp: 15, atk: 4, def: 3, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
      resistances: { LIGHT: -30 }, weaknesses: ['LIGHT'],
      dropTable: [{ type: 'MATERIAL', itemId: 'bone_chip', rarity: 'COMMON', rate: 0.8 }],
      battle: { color: '#999', sprite: 'WRAITH', size: 0.7 }, description: 'x',
      necromance: { captureRate: 0.12, allyCost: 1, allyStats: { hp: 15, atk: 4, def: 3, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, skillIds: ['skill_warrior_1'] },
    };
    const ctx = entry.buildContext(ALL, 'grave_soldier', enemy);
    const res = entry.validate(enemy, ctx);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });

  it('enemies: a critDmg scale error is caught (validator wired)', () => {
    const entry = getScopeEntry('enemies')!;
    const enemy = {
      id: 'grave_soldier', name: 'x', nameJa: 'x', nameEn: 'X', tier: 'MINION', tribe: 'UNDEAD',
      stats: { hp: 15, atk: 4, def: 3, spd: 70, critRate: 0, critDmg: 1.5, effectHit: 0, effectRes: 0 },
      necromance: { captureRate: 0.12, allyCost: 1, allyStats: { hp: 15, atk: 4, def: 3, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, skillIds: ['skill_warrior_1'] },
    };
    const ctx = entry.buildContext(ALL, 'grave_soldier', enemy);
    expect(entry.validate(enemy, ctx).ok).toBe(false);
  });

  it('skills: derives owner from job that learns the skill', () => {
    const entry = getScopeEntry('skills')!;
    const ctx = entry.buildContext(ALL, 'skill_warrior_1', ALL.skills.skill_warrior_1) as { owner?: { category?: string } };
    expect(ctx.owner?.category).toBe('PHYSICAL');
  });
});
