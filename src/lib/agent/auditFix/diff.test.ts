import { deepDiff, diffTouchesOnly } from './diff';

describe('deepDiff', () => {
  it('detects a changed primitive', () => {
    const d = deepDiff({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(d).toEqual([{ path: 'b', before: 2, after: 3, kind: 'changed' }]);
  });

  it('detects nested changes with dot paths', () => {
    const d = deepDiff({ stats: { hp: 10, atk: 5 } }, { stats: { hp: 10, atk: 8 } });
    expect(d).toEqual([{ path: 'stats.atk', before: 5, after: 8, kind: 'changed' }]);
  });

  it('detects added and removed keys', () => {
    const d = deepDiff({ a: 1 }, { b: 2 });
    expect(d).toContainEqual({ path: 'a', before: 1, after: undefined, kind: 'removed' });
    expect(d).toContainEqual({ path: 'b', before: undefined, after: 2, kind: 'added' });
  });

  it('treats arrays as whole-value changes', () => {
    const d = deepDiff({ weaknesses: ['ICE'] }, { weaknesses: ['ICE', 'LIGHT'] });
    expect(d).toHaveLength(1);
    expect(d[0].path).toBe('weaknesses');
    expect(d[0].kind).toBe('changed');
  });

  it('returns empty when identical', () => {
    expect(deepDiff({ a: 1, s: { x: 2 } }, { a: 1, s: { x: 2 } })).toEqual([]);
  });

  it('does not flag array reordering vs equal content', () => {
    expect(deepDiff({ a: [1, 2] }, { a: [1, 2] })).toEqual([]);
  });
});

describe('diffTouchesOnly', () => {
  it('true when all diffs are within allowed top-level fields', () => {
    const d = deepDiff({ stats: { atk: 5 }, name: 'x' }, { stats: { atk: 8 }, name: 'x' });
    expect(diffTouchesOnly(d, new Set(['stats']))).toBe(true);
  });
  it('false when a diff touches a field outside the allowed set', () => {
    const d = deepDiff({ stats: { atk: 5 }, name: 'x' }, { stats: { atk: 8 }, name: 'y' });
    expect(diffTouchesOnly(d, new Set(['stats']))).toBe(false);
  });
});
