/**
 * R-4: Server Action から抽出した決定論ヘルパのユニットテスト（合成データのみ）。
 */
import {
  validateRequirements,
  deriveElementAffinity,
  buildEnemyDesignContext,
  powerBandHint,
  buildFieldHints,
  findingKey,
  buildSimTargets,
  toSimSkill,
  snapshotFileOf,
  clampLevel,
} from './actionSupport';

describe('validateRequirements', () => {
  it('rejects empty / null / short input', () => {
    expect(validateRequirements('')).not.toBeNull();
    expect(validateRequirements(null)).not.toBeNull();
    expect(validateRequirements(undefined)).not.toBeNull();
    expect(validateRequirements('abc')).not.toBeNull();
    expect(validateRequirements('   a   ')).not.toBeNull(); // trim 後 1 文字
  });

  it('accepts 4+ chars', () => {
    expect(validateRequirements('強い敵を作る')).toBeNull();
    expect(validateRequirements('abcd')).toBeNull();
  });
});

describe('deriveElementAffinity', () => {
  it('keeps only positive resistances', () => {
    expect(deriveElementAffinity({ FIRE: 30, ICE: -20, DARK: 0 })).toEqual(['FIRE']);
  });

  it('is safe for non-objects', () => {
    expect(deriveElementAffinity(null)).toEqual([]);
    expect(deriveElementAffinity('FIRE')).toEqual([]);
    expect(deriveElementAffinity(undefined)).toEqual([]);
  });

  it('ignores non-number values', () => {
    expect(deriveElementAffinity({ FIRE: '30', ICE: 10 })).toEqual(['ICE']);
  });
});

describe('buildEnemyDesignContext', () => {
  const enemies = {
    a: { tier: 'MINION', stats: { hp: 10, atk: 4, def: 2 } },
    b: { tier: 'MINION', stats: { hp: 20, atk: 6, def: 3 } },
    c: { tier: 'BOSS', stats: { hp: 90, atk: 12, def: 10 } },
  };

  it('includes learned tier bands', () => {
    const ctx = buildEnemyDesignContext(enemies);
    expect(ctx).toContain('MINION');
    expect(ctx).toContain('BOSS');
    expect(ctx).toContain('hp 10〜20');
  });

  it('appends doc excerpt when provided and omits the section otherwise', () => {
    expect(buildEnemyDesignContext(enemies, 'エリア構成の方針')).toContain('設計書 15 抜粋');
    expect(buildEnemyDesignContext(enemies)).not.toContain('設計書 15 抜粋');
  });
});

describe('powerBandHint', () => {
  it('returns the band for a known classification/cost', () => {
    const hint = powerBandHint({ type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6 }, 1);
    expect(hint).toContain('PHYS_SINGLE');
    expect(hint).toContain('1.2〜1.55');
  });

  it('uses tier2 range when tier=2', () => {
    const hint = powerBandHint({ type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6 }, 2);
    expect(hint).toContain('1.4〜1.8');
  });

  it('reports unknown classification', () => {
    expect(powerBandHint({ type: 'HEAL', targetType: 'SINGLE', mpCost: 6 }, 1)).toContain('分類不明');
  });

  it('reports out-of-band cost', () => {
    expect(powerBandHint({ type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 1 }, 1)).toContain('帯外');
  });
});

describe('buildFieldHints', () => {
  it('lists field paths with types per file', () => {
    const hints = buildFieldHints({
      skills: { fireball: { power: 1.5, name: '火球', tags: ['a'], meta: { depth: 1 } } },
    });
    expect(hints).toContain('## skills');
    expect(hints).toContain('power:number');
    expect(hints).toContain('name:string');
    expect(hints).toContain('tags:array');
    expect(hints).toContain('meta.depth:number');
  });

  it('skips empty files', () => {
    expect(buildFieldHints({ skills: {}, enemies: undefined })).toBe('');
  });
});

describe('findingKey', () => {
  it('is stable per scope/id/message', () => {
    const f = { scope: 'skills', id: 'fireball', message: 'power 帯外' };
    expect(findingKey(f)).toBe('skills|fireball|power 帯外');
    expect(findingKey(f)).toBe(findingKey({ ...f }));
  });
});

describe('buildSimTargets', () => {
  const enemies = {
    a: { tier: 'MINION', stats: { hp: 15, def: 3 }, resistances: { FIRE: -30 } },
    b: { stats: {} },
    c: { tier: 'BOSS', stats: { hp: 90, def: 10 }, resistances: {} },
  };

  it('builds all targets when ids omitted', () => {
    const targets = buildSimTargets(enemies);
    expect(targets.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('fills missing stats with safe defaults (hp=1, def=0)', () => {
    const [b] = buildSimTargets(enemies, ['b']);
    expect(b).toEqual({ id: 'b', tier: undefined, hp: 1, def: 0, resistances: {} });
  });

  it('drops unknown ids', () => {
    const targets = buildSimTargets(enemies, ['a', 'nope']);
    expect(targets.map((t) => t.id)).toEqual(['a']);
  });

  it('keeps tier and resistances', () => {
    const [a] = buildSimTargets(enemies, ['a']);
    expect(a.tier).toBe('MINION');
    expect(a.resistances).toEqual({ FIRE: -30 });
  });
});

describe('toSimSkill', () => {
  it('passes through valid fields', () => {
    expect(toSimSkill({ power: 1.5, mpCost: 8, element: 'ICE', targetType: 'ALL_ENEMIES' })).toEqual({
      power: 1.5,
      mpCost: 8,
      element: 'ICE',
      targetType: 'ALL_ENEMIES',
    });
  });

  it('defaults missing/invalid fields', () => {
    expect(toSimSkill({})).toEqual({ power: 1.0, mpCost: 0, element: 'NONE', targetType: 'SINGLE' });
    expect(toSimSkill({ power: '2', targetType: 'SELF' }).power).toBe(1.0);
    expect(toSimSkill({ targetType: 'SELF' }).targetType).toBe('SINGLE');
  });
});

describe('snapshotFileOf', () => {
  it('extracts the master file name from a snapshot id', () => {
    expect(snapshotFileOf('skills__2026-06-11T00-00-00.json')).toBe('skills');
    expect(snapshotFileOf('enemies__x.json')).toBe('enemies');
  });
});

describe('clampLevel', () => {
  it('clamps into 1..100', () => {
    expect(clampLevel(0, 60)).toBe(60); // falsy → fallback
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(101)).toBe(100);
    expect(clampLevel(42)).toBe(42);
    expect(clampLevel(undefined, 10)).toBe(10);
  });
});
