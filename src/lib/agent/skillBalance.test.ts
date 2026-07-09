import {
  validateSkillDraft,
  classifySkill,
  findBand,
  skillFindingsToFeedback,
  type SkillBalanceContext,
  type SkillOwner,
} from './skillBalance';

const EXISTING_SKILLS: Record<string, unknown> = {
  skill_warrior_1: { id: 'skill_warrior_1', type: 'PHYSICAL', element: 'NONE', attackType: 'SLASH', targetType: 'SINGLE', mpCost: 5, power: 1.5 },
  skill_mage_1: { id: 'skill_mage_1', type: 'MAGICAL', element: 'FIRE', attackType: 'MAGIC', targetType: 'SINGLE', mpCost: 12, power: 1.6 },
};

const WARRIOR_OWNER: SkillOwner = {
  kind: 'job', id: 'warrior', displayName: '剣士', category: 'PHYSICAL', baseAttackType: 'SLASH', tier: 1,
};

function ctxFor(owner?: SkillOwner): SkillBalanceContext {
  return { existingSkills: EXISTING_SKILLS, skillIds: new Set(Object.keys(EXISTING_SKILLS)), owner };
}

function validWarriorSkill(): Record<string, unknown> {
  return {
    id: 'skill_warrior_flame_edge',
    name: '炎刃',
    mpCost: 6,
    power: 1.4, // PHYS_SINGLE 低(4-8) Tier1 範囲 1.20〜1.55 内
    type: 'PHYSICAL',
    element: 'FIRE',
    attackType: 'SLASH',
    targetType: 'SINGLE',
    effectKey: 'fire_slash',
    description: '炎を纏った斬撃。',
  };
}

describe('classifySkill', () => {
  it('maps type + targetType to classification', () => {
    expect(classifySkill('PHYSICAL', 'SINGLE')).toBe('PHYS_SINGLE');
    expect(classifySkill('PHYSICAL', 'ALL_ENEMIES')).toBe('PHYS_AOE');
    expect(classifySkill('MAGICAL', 'SINGLE')).toBe('MAGIC_SINGLE');
    expect(classifySkill('MAGICAL', 'ALL_ENEMIES')).toBe('MAGIC_AOE');
    expect(classifySkill('WEIRD', 'SINGLE')).toBeNull();
  });
});

describe('findBand', () => {
  it('finds the cost band for physical', () => {
    expect(findBand('PHYS_SINGLE', 6)?.t1).toEqual([1.2, 1.55]);
    expect(findBand('PHYS_SINGLE', 12)?.t1).toEqual([1.45, 1.8]);
    expect(findBand('PHYS_SINGLE', 20)?.t1).toEqual([1.7, 2.1]);
  });
  it('magic low band starts at 8 (cost 6 has no band)', () => {
    expect(findBand('MAGIC_SINGLE', 6)).toBeNull();
    expect(findBand('MAGIC_SINGLE', 10)?.t1).toEqual([1.4, 1.7]);
  });
});

describe('validateSkillDraft - valid', () => {
  it('passes a well-formed warrior skill', () => {
    const res = validateSkillDraft(validWarriorSkill(), ctxFor(WARRIOR_OWNER));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateSkillDraft - power table (設計書19)', () => {
  it('FAILs when power exceeds the tier1 range for the cost band', () => {
    const d = validWarriorSkill();
    d.power = 2.0; // PHYS_SINGLE 低 Tier1 上限 1.55 超過
    const res = validateSkillDraft(d, ctxFor(WARRIOR_OWNER));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'power' && f.level === 'FAIL')).toBe(true);
  });

  it('allows higher power for a Tier2 owner', () => {
    const d = validWarriorSkill();
    d.power = 1.75; // 低帯 Tier2 範囲 1.40〜1.80 内
    const t2owner: SkillOwner = { ...WARRIOR_OWNER, tier: 2 };
    const res = validateSkillDraft(d, ctxFor(t2owner));
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });

  it('FAILs on power scale error (fraction)', () => {
    const d = validWarriorSkill();
    d.power = 0.05;
    expect(validateSkillDraft(d, ctxFor(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('WARNs when mpCost falls outside the classification cost bands', () => {
    const d = validWarriorSkill();
    d.type = 'MAGICAL';
    d.attackType = 'MAGIC';
    d.mpCost = 5; // 魔法は8以上
    d.power = 1.5;
    const res = validateSkillDraft(d, ctxFor({ ...WARRIOR_OWNER, category: 'MAGICAL', baseAttackType: 'MAGIC' }));
    expect(res.findings.some((f) => f.field === 'mpCost' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateSkillDraft - owner fit (紐付き先整合)', () => {
  it('FAILs when skill type does not match the job category', () => {
    const d = validWarriorSkill();
    d.type = 'MAGICAL'; // 剣士(PHYSICAL)に魔法スキルは不可
    d.attackType = 'MAGIC';
    const res = validateSkillDraft(d, ctxFor(WARRIOR_OWNER));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'type' && f.level === 'FAIL')).toBe(true);
  });

  it('WARNs when attackType does not match job baseAttackType', () => {
    const d = validWarriorSkill();
    d.attackType = 'STRIKE'; // 剣士は SLASH
    d.effectKey = 'fire_strike';
    const res = validateSkillDraft(d, ctxFor(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'attackType' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when monster skill element does not match affinity', () => {
    const monsterOwner: SkillOwner = {
      kind: 'monster', id: 'imp', displayName: 'インプ', tribe: 'DEMON', elementAffinity: ['FIRE'],
    };
    const d = validWarriorSkill();
    d.element = 'WATER';
    d.effectKey = 'water_slash';
    const res = validateSkillDraft(d, ctxFor(monsterOwner));
    expect(res.findings.some((f) => f.field === 'element' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateSkillDraft - structure & enums', () => {
  it('FAILs on invalid type/element/attackType/targetType', () => {
    const d = { ...validWarriorSkill(), type: 'HOLY', element: 'PLASMA', attackType: 'BITE', targetType: 'SELF' };
    expect(validateSkillDraft(d, ctxFor()).ok).toBe(false);
  });

  it('FAILs on id collision with existing skill', () => {
    const d = { ...validWarriorSkill(), id: 'skill_warrior_1' };
    expect(validateSkillDraft(d, ctxFor(WARRIOR_OWNER)).ok).toBe(false);
  });

  it('WARNs when effectKey does not match element_attackType', () => {
    const d = validWarriorSkill();
    d.effectKey = 'wrong_key';
    const res = validateSkillDraft(d, ctxFor(WARRIOR_OWNER));
    expect(res.findings.some((f) => f.field === 'effectKey' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on non-snake_case id', () => {
    const d = { ...validWarriorSkill(), id: 'Skill-Flame' };
    expect(validateSkillDraft(d, ctxFor(WARRIOR_OWNER)).ok).toBe(false);
  });
});

describe('skillFindingsToFeedback', () => {
  it('includes only non-PASS findings', () => {
    const d = validWarriorSkill();
    d.power = 2.0;
    const res = validateSkillDraft(d, ctxFor(WARRIOR_OWNER));
    const fb = skillFindingsToFeedback(res.findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
