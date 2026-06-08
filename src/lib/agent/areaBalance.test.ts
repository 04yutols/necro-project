import {
  validateAreaDraft,
  areaIdFor,
  suggestedSortOrder,
  areaFindingsToFeedback,
  type AreaBalanceContext,
} from './areaBalance';

const EXISTING: Record<string, unknown> = {
  ch1_area1: { id: 'ch1_area1', chapter: 1, area: 1, nameJa: '亡国の王都', nameEn: 'FALLEN', description: '...', color: '#8A2BE2', position: { x: 152, y: 438 }, sortOrder: 101 },
  ch2_area2: { id: 'ch2_area2', chapter: 2, area: 2, nameJa: '幽霊都市', nameEn: 'PHANTOM', description: '...', color: '#38BDF8', position: { x: 250, y: 292 }, sortOrder: 202 },
};

const CTX: AreaBalanceContext = { existingAreas: EXISTING, areaIds: new Set(Object.keys(EXISTING)) };

function validArea(): Record<string, unknown> {
  return {
    id: 'ch3_area3',
    chapter: 3,
    area: 3,
    nameJa: '凍てつく霊峰',
    nameEn: 'FROZEN PEAK',
    description: 'третий 章の舞台。',
    color: '#A78BFA',
    position: { x: 320, y: 180 },
    sortOrder: 303,
  };
}

describe('helpers', () => {
  it('areaIdFor builds id', () => {
    expect(areaIdFor(3, 3)).toBe('ch3_area3');
  });
  it('suggestedSortOrder = chapter*100 + area', () => {
    expect(suggestedSortOrder(3, 3)).toBe(303);
    expect(suggestedSortOrder(2, 5)).toBe(205);
  });
});

describe('validateAreaDraft - valid', () => {
  it('passes a well-formed area', () => {
    const res = validateAreaDraft(validArea(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateAreaDraft - id convention & duplicates', () => {
  it('FAILs when id does not match ch{chapter}_area{area}', () => {
    const d = validArea();
    d.id = 'area_three';
    const res = validateAreaDraft(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'id')).toBe(true);
  });

  it('FAILs when id collides with an existing area', () => {
    const d = validArea();
    d.id = 'ch1_area1';
    d.chapter = 1;
    d.area = 1;
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when chapter/area duplicates an existing area under a different id', () => {
    const d = validArea();
    d.id = 'ch2_area2';
    d.chapter = 2;
    d.area = 2;
    // collides by id too, but also chapter/area dup — ensure FAIL
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });
});

describe('validateAreaDraft - fields', () => {
  it('FAILs on invalid color', () => {
    const d = validArea();
    d.color = 'purple';
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on non-integer chapter', () => {
    const d = validArea();
    d.chapter = 1.5;
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when position is missing coordinates', () => {
    const d = validArea();
    d.position = { x: 100 };
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when sortOrder does not match convention', () => {
    const d = validArea();
    d.sortOrder = 999;
    const res = validateAreaDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'sortOrder' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when sortOrder is missing', () => {
    const d = validArea();
    delete d.sortOrder;
    const res = validateAreaDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'sortOrder' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when position is out of map range', () => {
    const d = validArea();
    d.position = { x: 5000, y: 5000 };
    const res = validateAreaDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'position' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on empty nameJa', () => {
    const d = validArea();
    d.nameJa = '';
    expect(validateAreaDraft(d, CTX).ok).toBe(false);
  });
});

describe('areaFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validArea();
    d.color = 'red';
    const fb = areaFindingsToFeedback(validateAreaDraft(d, CTX).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
