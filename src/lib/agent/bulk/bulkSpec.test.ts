import { validateBulkSpec, specFindingsToFeedback } from './bulkSpec';

// 注: このテストは合成データのみを使い、src/data/master/*.json を一切読み書きしない。

function validSpec(): unknown {
  return {
    file: 'skills',
    filter: [
      { field: 'type', op: '==', value: 'MAGICAL' },
      { field: 'mpCost', op: '<=', value: 15 },
    ],
    operation: [{ field: 'power', op: 'add', value: -0.1 }],
    note: '全体魔法の power を下げる',
  };
}

describe('validateBulkSpec - valid', () => {
  it('accepts a well-formed spec and normalizes it', () => {
    const res = validateBulkSpec(validSpec());
    expect(res.ok).toBe(true);
    expect(res.spec?.file).toBe('skills');
    expect(res.spec?.filter).toHaveLength(2);
    expect(res.spec?.operation[0]).toEqual({ field: 'power', op: 'add', value: -0.1 });
  });

  it('allows empty filter but warns that it targets the whole file', () => {
    const res = validateBulkSpec({ file: 'enemies', filter: [], operation: [{ field: 'stats.def', op: 'mul', value: 1.1 }] });
    expect(res.ok).toBe(true);
    expect(res.findings).toContainEqual(expect.objectContaining({ level: 'WARN', field: 'filter' }));
  });

  it('supports dot-notation fields', () => {
    const res = validateBulkSpec({ file: 'enemies', filter: [{ field: 'stats.hp', op: '>', value: 50 }], operation: [{ field: 'stats.atk', op: 'add', value: 1 }] });
    expect(res.ok).toBe(true);
  });
});

describe('validateBulkSpec - file & enums', () => {
  it('FAILs on unknown file', () => {
    const d = validSpec() as Record<string, unknown>;
    d.file = 'spells';
    expect(validateBulkSpec(d).ok).toBe(false);
  });

  it('FAILs on invalid comparator', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [{ field: 'mpCost', op: '~=', value: 5 }], operation: [{ field: 'power', op: 'set', value: 1 }] });
    expect(res.ok).toBe(false);
  });

  it('FAILs on invalid mutation op', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [], operation: [{ field: 'power', op: 'increment', value: 1 }] });
    expect(res.ok).toBe(false);
  });
});

describe('validateBulkSpec - value typing', () => {
  it('FAILs when a numeric op has a non-number value', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [], operation: [{ field: 'power', op: 'mul', value: 'x' }] });
    expect(res.ok).toBe(false);
  });

  it('FAILs when "in" value is not an array', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [{ field: 'element', op: 'in', value: 'FIRE' }], operation: [{ field: 'power', op: 'set', value: 1 }] });
    expect(res.ok).toBe(false);
  });

  it('allows "exists" with no value', () => {
    const res = validateBulkSpec({ file: 'enemies', filter: [{ field: 'gimmicks', op: 'exists' }], operation: [{ field: 'stats.hp', op: 'add', value: 5 }] });
    expect(res.ok).toBe(true);
  });

  it('set accepts string/boolean', () => {
    const res = validateBulkSpec({ file: 'enemies', filter: [], operation: [{ field: 'tribe', op: 'set', value: 'UNDEAD' }] });
    expect(res.ok).toBe(true);
  });

  it('WARNs on mul value=1 (no-op)', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [], operation: [{ field: 'power', op: 'mul', value: 1 }] });
    expect(res.findings.some((f) => f.level === 'WARN')).toBe(true);
  });
});

describe('validateBulkSpec - structure', () => {
  it('FAILs on empty operation', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [], operation: [] });
    expect(res.ok).toBe(false);
  });

  it('FAILs when root is not an object', () => {
    expect(validateBulkSpec('nope').ok).toBe(false);
    expect(validateBulkSpec(null).ok).toBe(false);
  });

  it('FAILs on invalid field name', () => {
    const res = validateBulkSpec({ file: 'skills', filter: [], operation: [{ field: '1bad', op: 'set', value: 1 }] });
    expect(res.ok).toBe(false);
  });
});

describe('specFindingsToFeedback', () => {
  it('lists only FAIL findings', () => {
    const res = validateBulkSpec({ file: 'bogus', filter: [], operation: [] });
    const fb = specFindingsToFeedback(res.findings);
    expect(fb).toContain('[FAIL]');
  });
});
