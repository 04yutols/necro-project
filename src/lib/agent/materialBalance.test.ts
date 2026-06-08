import {
  validateMaterialDraft,
  deriveExpBands,
  materialFindingsToFeedback,
  type MaterialBalanceContext,
} from './materialBalance';

const EXISTING: Record<string, unknown> = {
  bone_chip: { id: 'bone_chip', name: '骸の欠片', quantity: 1, expValue: 120, rarity: 'COMMON' },
  grave_crystal: { id: 'grave_crystal', name: '墓晶石', quantity: 1, expValue: 160, rarity: 'COMMON' },
  ossuary_memory: { id: 'ossuary_memory', name: '竜骨の記憶片', quantity: 1, expValue: 600, rarity: 'RARE' },
  bloodmire_essence: { id: 'bloodmire_essence', name: '血沼の精', quantity: 1, expValue: 800, rarity: 'RARE' },
};

const CTX: MaterialBalanceContext = {
  existingMaterials: EXISTING,
  materialIds: new Set(Object.keys(EXISTING)),
};

function validCommon(): Record<string, unknown> {
  return { id: 'ash_dust', name: '灰塵', quantity: 1, expValue: 140, rarity: 'COMMON' };
}

describe('deriveExpBands', () => {
  it('learns expValue bands per rarity', () => {
    const b = deriveExpBands(EXISTING);
    expect(b.COMMON).toEqual({ min: 120, max: 160 });
    expect(b.RARE).toEqual({ min: 600, max: 800 });
  });
});

describe('validateMaterialDraft - valid', () => {
  it('passes a well-formed COMMON material', () => {
    const res = validateMaterialDraft(validCommon(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });

  it('passes a RARE material within band', () => {
    const res = validateMaterialDraft({ id: 'soul_relic', name: '魂の遺物', quantity: 1, expValue: 700, rarity: 'RARE' }, CTX);
    expect(res.ok).toBe(true);
  });
});

describe('validateMaterialDraft - rarity / expValue', () => {
  it('FAILs on invalid rarity', () => {
    const d = validCommon();
    d.rarity = 'MYTHIC';
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when COMMON expValue is far outside the learned band', () => {
    const d = validCommon();
    d.expValue = 5000;
    const res = validateMaterialDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'expValue' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs on rarity inversion (RARE expValue within COMMON band)', () => {
    const d = { id: 'weak_rare', name: '弱いレア', quantity: 1, expValue: 150, rarity: 'RARE' };
    const res = validateMaterialDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'expValue' && f.level === 'WARN')).toBe(true);
  });

  it('uses fallback band for EPIC (no existing data)', () => {
    const low = validateMaterialDraft({ id: 'epic_x', name: 'エピック', quantity: 1, expValue: 150, rarity: 'EPIC' }, CTX);
    expect(low.findings.some((f) => f.field === 'expValue' && f.level === 'WARN')).toBe(true);
    const ok = validateMaterialDraft({ id: 'epic_y', name: 'エピック', quantity: 1, expValue: 2000, rarity: 'EPIC' }, CTX);
    expect(ok.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });

  it('FAILs on non-integer / non-positive expValue', () => {
    const d = validCommon();
    d.expValue = 0;
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });
});

describe('validateMaterialDraft - structure', () => {
  it('FAILs on id collision', () => {
    const d = validCommon();
    d.id = 'bone_chip';
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on non-snake_case id', () => {
    const d = validCommon();
    d.id = 'Ash-Dust';
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on missing name', () => {
    const d = validCommon();
    d.name = '';
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid quantity', () => {
    const d = validCommon();
    d.quantity = 0;
    expect(validateMaterialDraft(d, CTX).ok).toBe(false);
  });
});

describe('materialFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validCommon();
    d.rarity = 'BOGUS';
    const fb = materialFindingsToFeedback(validateMaterialDraft(d, CTX).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
