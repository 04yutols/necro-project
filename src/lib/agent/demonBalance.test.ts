import {
  validateDemonFormDraft,
  demonFindingsToFeedback,
  type DemonBalanceContext,
  type DemonJobOwner,
} from './demonBalance';

const JOB_IDS = new Set(['warrior', 'berserker', 'mage', 'archmage']);

const WARRIOR_OWNER: DemonJobOwner = { id: 'warrior', displayName: '剣士', category: 'PHYSICAL', baseAttackType: 'SLASH', tier: 1 };
const BERSERKER_OWNER: DemonJobOwner = { id: 'berserker', displayName: 'ベルセルク', category: 'PHYSICAL', baseAttackType: 'SLASH', tier: 2 };

function ctx(owner?: DemonJobOwner): DemonBalanceContext {
  return { existingForms: {}, jobIds: JOB_IDS, owner };
}

function tier1Form(): Record<string, unknown> {
  return {
    jobId: 'warrior',
    formName: '黒翼の剣聖',
    tier: 1,
    concept: '剣術が闇に侵食される。',
    effectA: { descJa: '攻撃力+80%、防御+40%。', statBoosts: { atk: 0.8, def: 0.4 }, flags: ['DARK_EDGE'] },
    effectB: { descJa: 'リスクなし。', riskType: null, onAttackEffect: 'SHIELD_REND' },
    ultimateSkill: {
      nameJa: '黒聖十字断',
      damage: { power: 3.2, element: 'DARK', targetType: 'SINGLE', attackType: 'SLASH', flags: ['SHIELD_REND'] },
      lingering: { type: 'PARTY_BUFF', descJa: '味方防御UP。', duration: 3 },
    },
    visual: { color: '#c084fc', soft: 'rgba(192,132,252,0.2)', icon: '☾' },
  };
}

function tier2Form(): Record<string, unknown> {
  return {
    jobId: 'berserker',
    formName: '血河の狂戦士',
    tier: 2,
    concept: '手数が反動を伴って暴走。',
    effectA: { descJa: '攻撃力+150%。', statBoosts: { atk: 1.5 }, flags: [] },
    effectB: { descJa: '物理が3回ヒットだが被ダメ2倍。', riskType: 'GLASS_CANNON', riskValue: 2.0, onAttackEffect: 'TRIPLE_HIT' },
    ultimateSkill: {
      nameJa: '絶禍の断頭台',
      damage: { power: 4.5, element: 'DARK', targetType: 'SINGLE', attackType: 'SLASH', flags: ['IGNORE_DEF'] },
      lingering: { type: 'PARTY_BUFF', descJa: '吸血バフ。', duration: 3 },
    },
  };
}

describe('validateDemonFormDraft - valid', () => {
  it('passes a well-formed Tier1 form', () => {
    const res = validateDemonFormDraft(tier1Form(), ctx(WARRIOR_OWNER));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
  it('passes a well-formed Tier2 form', () => {
    const res = validateDemonFormDraft(tier2Form(), ctx(BERSERKER_OWNER));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateDemonFormDraft - Tier rules (設計書16)', () => {
  it('FAILs when Tier2 has no risk (riskType null)', () => {
    const d = tier2Form();
    (d.effectB as Record<string, unknown>).riskType = null;
    const res = validateDemonFormDraft(d, ctx(BERSERKER_OWNER));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'effectB.riskType' && f.level === 'FAIL')).toBe(true);
  });

  it('WARNs when Tier1 has a risk set', () => {
    const d = tier1Form();
    (d.effectB as Record<string, unknown>).riskType = 'GLASS_CANNON';
    const res = validateDemonFormDraft(d, ctx(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'effectB.riskType' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs when Tier2 ultimate has no lingering effect', () => {
    const d = tier2Form();
    delete (d.ultimateSkill as Record<string, unknown>).lingering;
    const res = validateDemonFormDraft(d, ctx(BERSERKER_OWNER));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'ultimateSkill.lingering' && f.level === 'FAIL')).toBe(true);
  });

  it('WARNs when ultimate power is outside the tier band', () => {
    const d = tier1Form();
    (d.ultimateSkill as { damage: Record<string, unknown> }).damage.power = 4.5; // Tier1 帯 2.8〜3.6 超過
    const res = validateDemonFormDraft(d, ctx(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'ultimateSkill.damage.power' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when form tier mismatches the job tier', () => {
    const d = tier1Form();
    d.tier = 2;
    // tier2 になったので riskType null は FAIL になるが、tier mismatch WARN も出る
    const res = validateDemonFormDraft(d, ctx(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'tier' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateDemonFormDraft - structure & references', () => {
  it('FAILs when jobId does not exist', () => {
    const d = tier1Form();
    d.jobId = 'paladin';
    expect(validateDemonFormDraft(d, ctx()).ok).toBe(false);
  });

  it('FAILs on invalid tier', () => {
    const d = tier1Form();
    d.tier = 3;
    expect(validateDemonFormDraft(d, ctx(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('FAILs on invalid statBoosts key', () => {
    const d = tier1Form();
    (d.effectA as { statBoosts: Record<string, number> }).statBoosts = { luck: 0.5 };
    expect(validateDemonFormDraft(d, ctx(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('FAILs on statBoost scale error (percent instead of multiplier)', () => {
    const d = tier1Form();
    (d.effectA as { statBoosts: Record<string, number> }).statBoosts = { atk: 80 };
    expect(validateDemonFormDraft(d, ctx(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('FAILs on invalid lingering.type', () => {
    const d = tier1Form();
    (d.ultimateSkill as { lingering: Record<string, unknown> }).lingering.type = 'HEAL_OVER_TIME';
    expect(validateDemonFormDraft(d, ctx(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('FAILs on invalid ultimate targetType (ALL_ENEMIES is wrong; must be ALL)', () => {
    const d = tier1Form();
    (d.ultimateSkill as { damage: Record<string, unknown> }).damage.targetType = 'ALL_ENEMIES';
    expect(validateDemonFormDraft(d, ctx(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('WARNs when ultimate attackType does not match the job baseAttackType', () => {
    const d = tier1Form();
    (d.ultimateSkill as { damage: Record<string, unknown> }).damage.attackType = 'STRIKE';
    const res = validateDemonFormDraft(d, ctx(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'ultimateSkill.damage.attackType' && f.level === 'WARN')).toBe(true);
  });
});

describe('demonFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = tier2Form();
    (d.effectB as Record<string, unknown>).riskType = null;
    const res = validateDemonFormDraft(d, ctx(BERSERKER_OWNER));
    const fb = demonFindingsToFeedback(res.findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
