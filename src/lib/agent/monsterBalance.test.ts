import {
  validateMonsterDraft,
  deriveCostBands,
  monsterFindingsToFeedback,
  type MonsterBalanceContext,
} from './monsterBalance';

const EXISTING: Record<string, unknown> = {
  goblin: { name: 'Goblin', tribe: 'HUMANOID', cost: 1, stats: { hp: 50, atk: 10, def: 5, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -20 } },
  skeleton: { name: 'Skeleton', tribe: 'UNDEAD', cost: 1, stats: { hp: 40, atk: 12, def: 8, spd: 50, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { LIGHT: -20, DARK: 20 } },
  troll: { name: 'Troll', tribe: 'ORC', cost: 3, stats: { hp: 200, atk: 20, def: 25, spd: 25, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 }, resistances: { FIRE: -20 } },
};

const CTX = (expectedCost?: number): MonsterBalanceContext => ({
  existingMonsters: EXISTING,
  monsterIds: new Set(Object.keys(EXISTING)),
  expectedCost,
});

function validCost1(): Record<string, unknown> {
  return {
    id: 'ghoul',
    name: 'Ghoul',
    tribe: 'UNDEAD',
    cost: 1,
    stats: { hp: 55, atk: 11, def: 6, spd: 60, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
    resistances: { LIGHT: -20, DARK: 20 },
  };
}

describe('deriveCostBands', () => {
  it('learns stat bands per cost', () => {
    const b = deriveCostBands(EXISTING);
    expect(b[1].hp).toEqual({ min: 40, max: 50 });
    expect(b[3].hp).toEqual({ min: 200, max: 200 });
  });
});

describe('validateMonsterDraft - valid', () => {
  it('passes a well-formed cost-1 monster', () => {
    const res = validateMonsterDraft(validCost1(), CTX(1));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateMonsterDraft - cost & balance', () => {
  it('FAILs when cost mismatches expected', () => {
    const d = validCost1();
    d.cost = 2;
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('WARNs when a cost-1 monster has cost-3-level stats', () => {
    const d = validCost1();
    (d.stats as Record<string, number>).hp = 300; // cost1 帯 40-50 を大きく超過
    const res = validateMonsterDraft(d, CTX(1));
    expect(res.findings.some((f) => f.field === 'stats.hp' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on critDmg scale error', () => {
    const d = validCost1();
    (d.stats as Record<string, number>).critDmg = 1.5;
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('WARNs on resistance scale error (fraction)', () => {
    const d = validCost1();
    d.resistances = { DARK: 0.2 };
    const res = validateMonsterDraft(d, CTX(1));
    expect(res.findings.some((f) => f.field === 'resistances' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateMonsterDraft - structure', () => {
  it('FAILs on invalid tribe', () => {
    const d = validCost1();
    d.tribe = 'ANGEL';
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('FAILs on id collision', () => {
    const d = validCost1();
    d.id = 'goblin';
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('FAILs on non-snake_case id', () => {
    const d = validCost1();
    d.id = 'Ghoul-X';
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('FAILs on missing stat key', () => {
    const d = validCost1();
    d.stats = { hp: 55, atk: 11 };
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });

  it('FAILs on invalid cost', () => {
    const d = validCost1();
    d.cost = 0;
    expect(validateMonsterDraft(d, CTX()).ok).toBe(false);
  });

  it('FAILs on invalid resistance element', () => {
    const d = validCost1();
    d.resistances = { PLASMA: -20 };
    expect(validateMonsterDraft(d, CTX(1)).ok).toBe(false);
  });
});

describe('monsterFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validCost1();
    d.tribe = 'X';
    const fb = monsterFindingsToFeedback(validateMonsterDraft(d, CTX(1)).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
