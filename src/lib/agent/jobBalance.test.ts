import {
  validateJobDraft,
  jobFindingsToFeedback,
  type JobBalanceContext,
} from './jobBalance';

const CTX: JobBalanceContext = {
  existingJobs: {
    warrior: { tier: 1, category: 'PHYSICAL', baseAttackType: 'SLASH', statModifiers: { atk: 1.2 }, role: '前衛' },
  },
  jobIds: new Set(['warrior', 'mage']),
  skillIds: new Set(['skill_warrior_1', 'skill_mage_1']),
  skillMeta: {
    skill_warrior_1: { type: 'PHYSICAL', element: 'NONE' },
    skill_mage_1: { type: 'MAGICAL', element: 'FIRE' },
  },
};

function validJob(): Record<string, unknown> {
  return {
    id: 'spellblade',
    name: 'Spellblade',
    displayName: '魔法剣士',
    nameEn: 'SPELLBLADE',
    title: '双連の剣',
    tier: 2,
    category: 'PHYSICAL',
    baseAttackType: 'SLASH',
    role: '物理火力・バランス型',
    description: '剣に魔力を纏わせる前衛。',
    statModifiers: { hp: 1.0, atk: 1.3, def: 0.95, spd: 1.05, critRate: 1.1, critDmg: 1.1, effectHit: 0.9, effectRes: 0.9 },
    energyCurve: { baseMaxEnergy: 100, ultimateCost: 100, spGrowthPerLevel: 1 },
    levelBonuses: { '10': { passiveAtkBonus: 1 }, '30': { passiveAtkBonus: 3, passiveDefBonus: 1 } },
    skills: [{ level: 1, skillId: 'skill_warrior_1' }],
  };
}

describe('validateJobDraft - valid', () => {
  it('passes a well-formed job', () => {
    const res = validateJobDraft(validJob(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateJobDraft - category / attackType / skills', () => {
  it('FAILs on invalid category', () => {
    const d = validJob();
    d.category = 'SUPPORT';
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when baseAttackType mismatches category', () => {
    const d = validJob();
    d.baseAttackType = 'MAGIC'; // PHYSICAL に MAGIC は不自然
    const res = validateJobDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'baseAttackType' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs when a skill does not exist', () => {
    const d = validJob();
    d.skills = [{ level: 1, skillId: 'skill_unknown' }];
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when a skill type does not match the job category', () => {
    const d = validJob(); // PHYSICAL job
    d.skills = [{ level: 1, skillId: 'skill_mage_1' }]; // MAGICAL skill
    const res = validateJobDraft(d, CTX);
    expect(res.findings.some((f) => /skills\[0\]/.test(f.field) && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when there is no level-1 skill', () => {
    const d = validJob();
    d.skills = [{ level: 5, skillId: 'skill_warrior_1' }];
    const res = validateJobDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'skills' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateJobDraft - statModifiers', () => {
  it('FAILs on modifier scale error (percent instead of multiplier)', () => {
    const d = validJob();
    (d.statModifiers as Record<string, number>).atk = 120;
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when a modifier is outside the soft band', () => {
    const d = validJob();
    (d.statModifiers as Record<string, number>).atk = 1.9;
    const res = validateJobDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'statModifiers.atk' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs on excessive total power budget (all stats high)', () => {
    const d = validJob();
    d.statModifiers = { hp: 1.5, atk: 1.5, def: 1.5, spd: 1.5, critRate: 1.5, critDmg: 1.5, effectHit: 1.5, effectRes: 1.5 };
    const res = validateJobDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'statModifiers' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs when a statModifier key is missing', () => {
    const d = validJob();
    d.statModifiers = { atk: 1.2 };
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });
});

describe('validateJobDraft - structure', () => {
  it('FAILs on tier other than 1/2', () => {
    const d = validJob();
    d.tier = 3;
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on id collision', () => {
    const d = validJob();
    d.id = 'warrior';
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid energyCurve', () => {
    const d = validJob();
    (d.energyCurve as Record<string, number>).baseMaxEnergy = 0;
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid levelBonus key', () => {
    const d = validJob();
    d.levelBonuses = { '10': { passiveLuckBonus: 1 } };
    expect(validateJobDraft(d, CTX).ok).toBe(false);
  });

  it('does not require baseStatsByLevel (form interpolates it)', () => {
    const d = validJob();
    expect('baseStatsByLevel' in d).toBe(false);
    expect(validateJobDraft(d, CTX).ok).toBe(true);
  });
});

describe('jobFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validJob();
    d.tier = 9;
    const fb = jobFindingsToFeedback(validateJobDraft(d, CTX).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
