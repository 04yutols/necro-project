import {
  applyBulkSpec,
  applyMutations,
  matchesFilter,
  getByPath,
  buildPatchedCollection,
  selectMatchedIds,
  auditMutationFields,
  type BulkChange,
} from './bulkEngine';
import type { BulkSpec } from './bulkSpec';

// 注: 合成データのみ。src/data/master/*.json は読み書きしない。

function skills(): Record<string, Record<string, unknown>> {
  return {
    s_fire_aoe: { type: 'MAGICAL', targetType: 'ALL_ENEMIES', mpCost: 10, power: 1.45, element: 'FIRE' },
    s_ice_aoe: { type: 'MAGICAL', targetType: 'ALL_ENEMIES', mpCost: 18, power: 1.7, element: 'ICE' },
    s_slash: { type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6, power: 1.5, element: 'NONE' },
  };
}

describe('getByPath / matchesFilter', () => {
  it('reads dot-notation paths', () => {
    expect(getByPath({ stats: { atk: 5 } }, 'stats.atk')).toBe(5);
    expect(getByPath({ stats: { atk: 5 } }, 'stats.def')).toBeUndefined();
  });

  it('matches AND conditions including dot-notation', () => {
    const e = { type: 'MAGICAL', stats: { hp: 60 } };
    expect(matchesFilter(e, [{ field: 'type', op: '==', value: 'MAGICAL' }, { field: 'stats.hp', op: '>', value: 50 }])).toBe(true);
    expect(matchesFilter(e, [{ field: 'stats.hp', op: '<', value: 50 }])).toBe(false);
  });

  it('supports in / exists', () => {
    const e = { element: 'FIRE', gimmicks: [1] };
    expect(matchesFilter(e, [{ field: 'element', op: 'in', value: ['FIRE', 'ICE'] }])).toBe(true);
    expect(matchesFilter(e, [{ field: 'gimmicks', op: 'exists' }])).toBe(true);
    expect(matchesFilter(e, [{ field: 'missing', op: 'exists' }])).toBe(false);
  });
});

describe('applyMutations - numeric ops keep type', () => {
  it('add on float keeps precision', () => {
    const e = { power: 1.45 };
    applyMutations(e, [{ field: 'power', op: 'add', value: -0.1 }]);
    expect(e.power).toBe(1.35);
  });

  it('mul on integer rounds', () => {
    const e: Record<string, unknown> = { stats: { def: 5 } };
    applyMutations(e, [{ field: 'stats.def', op: 'mul', value: 1.1 }]);
    expect((e.stats as { def: number }).def).toBe(6); // round(5.5)
  });

  it('set / clampMin / clampMax', () => {
    const e: Record<string, unknown> = { a: 10, b: 3, c: 100 };
    applyMutations(e, [
      { field: 'a', op: 'set', value: 1 },
      { field: 'b', op: 'clampMin', value: 5 },
      { field: 'c', op: 'clampMax', value: 50 },
    ]);
    expect(e).toEqual({ a: 1, b: 5, c: 50 });
  });
});

describe('applyBulkSpec - filtering + diff', () => {
  const spec: BulkSpec = {
    file: 'skills',
    filter: [
      { field: 'type', op: '==', value: 'MAGICAL' },
      { field: 'targetType', op: '==', value: 'ALL_ENEMIES' },
      { field: 'mpCost', op: '<=', value: 15 },
    ],
    operation: [{ field: 'power', op: 'add', value: -0.1 }],
  };

  it('only changes matching entities', () => {
    const changes = applyBulkSpec(skills(), spec);
    expect(changes.map((c) => c.id)).toEqual(['s_fire_aoe']); // ice is mpCost 18, slash is physical
  });

  it('produces a minimal diff', () => {
    const changes = applyBulkSpec(skills(), spec);
    expect(changes[0].diff).toEqual([{ path: 'power', before: 1.45, after: 1.35, kind: 'changed' }]);
  });

  it('does NOT mutate the input collection', () => {
    const data = skills();
    const snapshot = JSON.stringify(data);
    applyBulkSpec(data, spec);
    expect(JSON.stringify(data)).toBe(snapshot); // 入力不変を保証
  });

  it('skips entities whose value would not change', () => {
    const noop: BulkSpec = { file: 'skills', filter: [], operation: [{ field: 'power', op: 'mul', value: 1 }] };
    expect(applyBulkSpec(skills(), noop)).toHaveLength(0);
  });

  it('empty filter targets all entities', () => {
    const all: BulkSpec = { file: 'skills', filter: [], operation: [{ field: 'mpCost', op: 'add', value: 1 }] };
    expect(applyBulkSpec(skills(), all)).toHaveLength(3);
  });
});

describe('selectMatchedIds / auditMutationFields', () => {
  it('selects matched ids regardless of change', () => {
    expect(selectMatchedIds(skills(), [{ field: 'type', op: '==', value: 'MAGICAL' }]).sort()).toEqual(['s_fire_aoe', 's_ice_aoe']);
  });

  it('flags mutation fields absent from all matched entities (typo/hallucination)', () => {
    const matched = [{ power: 1.4 }, { power: 1.7 }];
    expect(auditMutationFields(matched, [{ field: 'power', op: 'add' }])).toEqual([]); // 存在する
    expect(auditMutationFields(matched, [{ field: 'pow', op: 'add' }])).toEqual(['pow']); // typo
  });

  it('ignores set ops (intentional new field)', () => {
    const matched = [{ a: 1 }];
    expect(auditMutationFields(matched, [{ field: 'newField', op: 'set' }])).toEqual([]);
  });
});

describe('buildPatchedCollection', () => {
  it('overlays changes without mutating input', () => {
    const data = skills();
    const changes: BulkChange[] = applyBulkSpec(data, { file: 'skills', filter: [{ field: 'element', op: '==', value: 'FIRE' }], operation: [{ field: 'power', op: 'mul', value: 2 }] });
    const patched = buildPatchedCollection(data, changes);
    expect((patched.s_fire_aoe as { power: number }).power).toBe(2.9);
    expect((data.s_fire_aoe as { power: number }).power).toBe(1.45); // 元は不変
  });
});
