import { findUnknownFields, KNOWN_TOP_LEVEL_FIELDS } from './knownFields';

describe('findUnknownFields', () => {
  it('flags a junk top-level field as WARN', () => {
    const res = findUnknownFields({ id: 'x', name: 'y', foobar: 1 }, 'materials');
    expect(res).toHaveLength(1);
    expect(res[0].level).toBe('WARN');
    expect(res[0].field).toBe('foobar');
  });

  it('returns [] when all fields are known', () => {
    expect(findUnknownFields({ id: 'm', name: 'n', quantity: 1, expValue: 100, rarity: 'COMMON' }, 'materials')).toEqual([]);
  });

  it('ignores __meta-prefixed keys (snapshot payloads etc.)', () => {
    expect(findUnknownFields({ id: 'x', name: 'y', __meta: {} }, 'materials')).toEqual([]);
  });

  it('returns [] for an unregistered scope (no schema to check)', () => {
    expect(findUnknownFields({ anything: 1 }, 'spells')).toEqual([]);
  });

  it('returns [] for non-object input', () => {
    expect(findUnknownFields(null, 'enemies')).toEqual([]);
    expect(findUnknownFields([1, 2], 'enemies')).toEqual([]);
  });

  it('catches a typo of a real field (powr vs power)', () => {
    const res = findUnknownFields({ id: 's', name: 'n', power: 1.5, powr: 9, type: 'PHYSICAL' }, 'skills');
    expect(res.map((r) => r.field)).toContain('powr');
    expect(res.map((r) => r.field)).not.toContain('power');
  });
});

describe('KNOWN_TOP_LEVEL_FIELDS - completeness vs actual data keys', () => {
  // 実データの実キー（誤検出防止のため、許容集合がこれらを全て含むことを保証）
  const ACTUAL: Record<string, string[]> = {
    enemies: ['battle', 'description', 'dropTable', 'gimmicks', 'id', 'maxShieldHp', 'name', 'nameEn', 'nameJa', 'necromance', 'resistances', 'shieldHp', 'stats', 'tier', 'tribe', 'weaknesses'],
    skills: ['ailmentBaseRate', 'ailmentType', 'ailments', 'attackType', 'description', 'effectKey', 'element', 'flags', 'healSelfPct', 'id', 'isUltimate', 'mpCost', 'name', 'power', 'targetType', 'type'],
    stages: ['area', 'areaGimmick', 'chapter', 'chapterName', 'description', 'difficulty', 'element', 'id', 'isAreaBoss', 'name', 'nameEn', 'nameJa', 'nodeType', 'position', 'rewards', 'unlockRequires', 'waveCount', 'waves'],
    jobs: ['baseAttackType', 'baseStatsByLevel', 'category', 'description', 'displayName', 'energyCurve', 'levelBonuses', 'name', 'nameEn', 'role', 'skills', 'statModifiers', 'tier', 'title', 'unlock'],
    items: ['archetype', 'battleEffect', 'battleUsable', 'flavor', 'icon', 'id', 'ilv', 'isUnique', 'name', 'passiveA', 'passiveB', 'quantity', 'rank', 'rarity', 'stats', 'subOptions', 'type', 'weaponRarity'],
    materials: ['expValue', 'id', 'name', 'quantity', 'rarity'],
    monsters: ['cost', 'name', 'resistances', 'stats', 'tribe'],
    demonForms: ['concept', 'effectA', 'effectB', 'formName', 'jobId', 'tier', 'ultimateSkill', 'visual'],
    areas: ['area', 'chapter', 'color', 'description', 'id', 'nameEn', 'nameJa', 'position', 'sortOrder'],
  };

  for (const [scope, keys] of Object.entries(ACTUAL)) {
    it(`${scope}: allowed set covers all real data keys (no false WARN)`, () => {
      const allowed = new Set(KNOWN_TOP_LEVEL_FIELDS[scope]);
      const missing = keys.filter((k) => !allowed.has(k));
      expect(missing).toEqual([]);
    });
  }
});
