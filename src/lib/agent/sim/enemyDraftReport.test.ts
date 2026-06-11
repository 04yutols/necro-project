/**
 * R-7: enemy 草案バランス評価レポート（決定論パート）のユニットテスト。
 * 合成データのみ（src/data/master は読まない）。
 */
import {
  medianAttacker,
  selectRepresentativeSkills,
  buildEnemyDraftReport,
  enemyReportToText,
} from './enemyDraftReport';
import type { SimTarget } from './simulationReport';

describe('medianAttacker', () => {
  it('takes the median per stat (odd count)', () => {
    const a = medianAttacker([
      { atk: 10, critRate: 5, critDmg: 150 },
      { atk: 30, critRate: 5, critDmg: 150 },
      { atk: 20, critRate: 10, critDmg: 200 },
    ]);
    expect(a.atk).toBe(20);
    expect(a.critRate).toBe(5);
    expect(a.critDmg).toBe(150);
  });

  it('averages the middle pair (even count) and rounds atk', () => {
    const a = medianAttacker([
      { atk: 10, critRate: 0, critDmg: 100 },
      { atk: 21, critRate: 10, critDmg: 200 },
    ]);
    expect(a.atk).toBe(16); // round(15.5)
    expect(a.critRate).toBe(5);
    expect(a.critDmg).toBe(150);
  });
});

describe('selectRepresentativeSkills', () => {
  const skills = {
    phys_low: { type: 'PHYSICAL', targetType: 'SINGLE', power: 1.2, mpCost: 4, element: 'NONE' },
    phys_mid: { type: 'PHYSICAL', targetType: 'SINGLE', power: 1.5, mpCost: 6, element: 'FIRE' },
    phys_high: { type: 'PHYSICAL', targetType: 'SINGLE', power: 1.8, mpCost: 12, element: 'NONE' },
    magic_aoe: { type: 'MAGICAL', targetType: 'ALL_ENEMIES', power: 1.3, mpCost: 10, element: 'ICE' },
    heal: { type: 'HEAL', targetType: 'SINGLE', power: 1.0, mpCost: 5 },
    broken: { type: 'PHYSICAL', targetType: 'SINGLE', power: 'x', mpCost: 5 },
  };

  it('picks the median-power skill per classification', () => {
    const reps = selectRepresentativeSkills(skills);
    const physSingle = reps.find((r) => r.classification === 'PHYS_SINGLE');
    expect(physSingle?.id).toBe('phys_mid'); // 中央値 1.5
    const magicAoe = reps.find((r) => r.classification === 'MAGIC_AOE');
    expect(magicAoe?.id).toBe('magic_aoe');
  });

  it('skips unclassifiable or power-less skills', () => {
    const reps = selectRepresentativeSkills(skills);
    expect(reps.some((r) => r.id === 'heal')).toBe(false);
    expect(reps.some((r) => r.id === 'broken')).toBe(false);
  });

  it('is deterministic (same input → same selection)', () => {
    const a = selectRepresentativeSkills(skills).map((r) => r.id);
    const b = selectRepresentativeSkills(skills).map((r) => r.id);
    expect(a).toEqual(b);
  });

  it('returns empty for empty input', () => {
    expect(selectRepresentativeSkills({})).toEqual([]);
  });
});

describe('buildEnemyDraftReport', () => {
  const attacker = { atk: 100, critRate: 0, critDmg: 150 };
  const reps = selectRepresentativeSkills({
    phys: { type: 'PHYSICAL', targetType: 'SINGLE', power: 2.0, mpCost: 6, element: 'NONE' },
    magic: { type: 'MAGICAL', targetType: 'SINGLE', power: 1.0, mpCost: 8, element: 'ICE' },
  });
  const target: SimTarget = { id: 'draft_enemy', tier: 'ELITE', hp: 300, def: 0, resistances: { ICE: -50 } };

  it('evaluates each representative skill against the single target', () => {
    const report = buildEnemyDraftReport(attacker, reps, target);
    expect(report.rows).toHaveLength(2);
    const phys = report.rows.find((r) => r.skill.id === 'phys')!;
    const magic = report.rows.find((r) => r.skill.id === 'magic')!;
    expect(phys.result.expected).toBe(200); // 100×2.0、def0
    expect(phys.result.hitsToKill).toBe(2); // ceil(300/200)
    expect(magic.result.expected).toBe(150); // 100×1.0×1.5（ICE 弱点）
    expect(magic.result.isWeakness).toBe(true);
  });

  it('aggregates summary (avg/min/max/oneShot/weakness)', () => {
    const report = buildEnemyDraftReport(attacker, reps, target);
    expect(report.summary.minHitsToKill).toBe(2);
    expect(report.summary.maxHitsToKill).toBe(2);
    expect(report.summary.avgHitsToKill).toBe(2);
    expect(report.summary.oneShotCount).toBe(0);
    expect(report.summary.weaknessHitCount).toBe(1);
    expect(report.summary.resistedCount).toBe(0);
  });

  it('counts one-shots for fragile targets', () => {
    const fragile: SimTarget = { ...target, hp: 50, resistances: {} };
    const report = buildEnemyDraftReport(attacker, reps, fragile);
    expect(report.summary.oneShotCount).toBe(2); // 200 と 100 どちらも >= 50
  });

  it('handles empty skill list without NaN', () => {
    const report = buildEnemyDraftReport(attacker, [], target);
    expect(report.summary.avgHitsToKill).toBe(0);
    expect(report.summary.minHitsToKill).toBe(0);
    expect(report.summary.maxHitsToKill).toBe(0);
  });
});

describe('enemyReportToText', () => {
  it('includes target, per-skill lines and summary', () => {
    const attacker = { atk: 100, critRate: 5, critDmg: 150 };
    const reps = selectRepresentativeSkills({
      phys: { type: 'PHYSICAL', targetType: 'SINGLE', power: 1.5, mpCost: 6, element: 'NONE' },
    });
    const txt = enemyReportToText(
      buildEnemyDraftReport(attacker, reps, { id: 'bone_wall', tier: 'ELITE', hp: 300, def: 5, resistances: {} }),
    );
    expect(txt).toContain('bone_wall');
    expect(txt).toContain('[ELITE]');
    expect(txt).toContain('phys（PHYS_SINGLE');
    expect(txt).toContain('要約');
  });
});
