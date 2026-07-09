import {
  validateWeaponDraft,
  weaponFindingsToFeedback,
  RARITY_SUBOPTION_SLOTS,
  type WeaponBalanceContext,
} from './weaponBalance';

const EXISTING_ITEMS: Record<string, unknown> = {
  bone_cleaver: { id: 'bone_cleaver', type: 'WEAPON', rarity: 'R' },
};

function ctx(expectedRarity?: string): WeaponBalanceContext {
  return { existingItems: EXISTING_ITEMS, itemIds: new Set(Object.keys(EXISTING_ITEMS)), expectedRarity };
}

function passive(name: string) {
  return { nameJa: name, descTemplate: '効果が{value}%上昇する。', values: [3, 4, 5, 6, 7] };
}

function rWeapon(): Record<string, unknown> {
  return {
    id: 'ash_dagger',
    name: '灰の短剣',
    type: 'WEAPON',
    rarity: 'R',
    weaponRarity: 'R',
    archetype: 'MID',
    rank: 1,
    ilv: 1,
    isUnique: false,
    stats: {},
    subOptions: [{ type: 'ATK%', value: 6.2 }],
    passiveA: passive('粗削りの刃'),
    passiveB: passive('戦場勘'),
    flavor: '粗削りだが頼れる。',
  };
}

function ssrWeapon(): Record<string, unknown> {
  return {
    id: 'frost_saber',
    name: '氷霜の刃',
    type: 'WEAPON',
    rarity: 'SSR',
    weaponRarity: 'SSR',
    archetype: 'MID',
    rank: 4,
    ilv: 72,
    isUnique: false,
    stats: {},
    subOptions: [
      { type: 'CRIT_DMG', value: 16 },
      { type: 'ICE_DMG_BOOST', value: 13 },
    ],
    passiveA: passive('氷結特効'),
    passiveB: { nameJa: '霊壁破断', descTemplate: '防御干渉を{value}%無視する。', values: [25, 32, 38, 44, 50], systemTag: 'SHIELD_PIERCE' },
    flavor: '凍てつく刃。',
  };
}

describe('RARITY_SUBOPTION_SLOTS', () => {
  it('encodes doc92 slots', () => {
    expect(RARITY_SUBOPTION_SLOTS.R).toEqual({ normal: 1, element: 0 });
    expect(RARITY_SUBOPTION_SLOTS.SSR).toEqual({ normal: 1, element: 1 });
    expect(RARITY_SUBOPTION_SLOTS.UR).toEqual({ normal: 1, element: 1 });
  });
});

describe('validateWeaponDraft - valid', () => {
  it('passes a well-formed R weapon', () => {
    const res = validateWeaponDraft(rWeapon(), ctx('R'));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
  it('passes a well-formed SSR weapon (1 normal + 1 element)', () => {
    const res = validateWeaponDraft(ssrWeapon(), ctx('SSR'));
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateWeaponDraft - rarity subOption slots (設計書92)', () => {
  it('FAILs when R has an element subOption (R has no element slot)', () => {
    const d = rWeapon();
    d.subOptions = [{ type: 'ATK%', value: 6 }, { type: 'FIRE_DMG_BOOST', value: 7 }];
    const res = validateWeaponDraft(d, ctx('R'));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'subOptions' && f.level === 'FAIL')).toBe(true);
  });

  it('FAILs when SSR is missing the element subOption', () => {
    const d = ssrWeapon();
    d.subOptions = [{ type: 'CRIT_DMG', value: 16 }];
    const res = validateWeaponDraft(d, ctx('SSR'));
    expect(res.ok).toBe(false);
  });

  it('FAILs when SSR has two normal subOptions instead of normal+element', () => {
    const d = ssrWeapon();
    d.subOptions = [{ type: 'CRIT_DMG', value: 16 }, { type: 'ATK%', value: 10 }];
    expect(validateWeaponDraft(d, ctx('SSR')).ok).toBe(false);
  });

  it('FAILs on invalid subOption type', () => {
    const d = rWeapon();
    d.subOptions = [{ type: 'LUCK%', value: 5 }];
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });

  it('FAILs on subOption value scale error (>100)', () => {
    const d = rWeapon();
    d.subOptions = [{ type: 'ATK%', value: 620 }];
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });
});

describe('validateWeaponDraft - passives', () => {
  it('FAILs when a passive slot is missing', () => {
    const d = rWeapon();
    delete d.passiveB;
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });

  it('WARNs when descTemplate lacks {value}', () => {
    const d = rWeapon();
    (d.passiveA as Record<string, unknown>).descTemplate = '常に強い。';
    const res = validateWeaponDraft(d, ctx('R'));
    expect(res.findings.some((f) => f.field === 'passiveA.descTemplate' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when values array is not length 5', () => {
    const d = rWeapon();
    (d.passiveA as Record<string, unknown>).values = [3, 4, 5];
    const res = validateWeaponDraft(d, ctx('R'));
    expect(res.findings.some((f) => f.field === 'passiveA.values' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on invalid systemTag', () => {
    const d = rWeapon();
    (d.passiveA as Record<string, unknown>).systemTag = 'SUPER_MODE';
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });
});

describe('validateWeaponDraft - structure & rarity', () => {
  it('FAILs when rarity mismatches expected', () => {
    const d = rWeapon();
    d.rarity = 'SR';
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });

  it('WARNs when UR is not MYTHIC archetype', () => {
    const d = ssrWeapon();
    d.rarity = 'UR';
    d.weaponRarity = 'UR';
    d.archetype = 'MID';
    const res = validateWeaponDraft(d, ctx('UR'));
    expect(res.findings.some((f) => f.field === 'archetype' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on id collision', () => {
    const d = rWeapon();
    d.id = 'bone_cleaver';
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });

  it('FAILs on invalid rank', () => {
    const d = rWeapon();
    d.rank = 9;
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });

  it('FAILs when type is not WEAPON', () => {
    const d = rWeapon();
    d.type = 'CONSUMABLE';
    expect(validateWeaponDraft(d, ctx('R')).ok).toBe(false);
  });
});

describe('weaponFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = rWeapon();
    d.subOptions = [{ type: 'ATK%', value: 6 }, { type: 'FIRE_DMG_BOOST', value: 7 }];
    const fb = weaponFindingsToFeedback(validateWeaponDraft(d, ctx('R')).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
