import {
  AOE_ASSUMED_TARGETS,
  buildSimulationReport,
  evaluateAgainstTarget,
  reportToText,
  type SimAttacker,
  type SimSkill,
  type SimTarget,
} from './simulationReport';

const ATK: SimAttacker = { atk: 100, critRate: 0, critDmg: 150 };
const SKILL: SimSkill = { power: 2.0, mpCost: 10, element: 'NONE', targetType: 'SINGLE' };

function target(over: Partial<SimTarget>): SimTarget {
  return { id: 'dummy', hp: 150, def: 0, resistances: {}, ...over };
}

describe('evaluateAgainstTarget - damage formula matches calculateBattleDamage', () => {
  it('no def, no crit → expected = atk*power', () => {
    const p = evaluateAgainstTarget(ATK, SKILL, target({ hp: 150, def: 0 }));
    expect(p.normal).toBe(200); // 100*2.0
    expect(p.expected).toBe(200); // critRate 0
    expect(p.oneShot).toBe(true); // 200>=150
    expect(p.hitsToKill).toBe(1);
  });

  it('high HP target → multiple hits to kill', () => {
    const p = evaluateAgainstTarget(ATK, SKILL, target({ hp: 500, def: 0 }));
    expect(p.oneShot).toBe(false);
    expect(p.hitsToKill).toBe(3); // ceil(500/200)
  });

  it('def 200 halves damage (defMult 0.5)', () => {
    const p = evaluateAgainstTarget(ATK, SKILL, target({ def: 200 }));
    expect(p.normal).toBe(100); // 200 * 0.5
  });

  it('weakness (negative resistance) amplifies and flags', () => {
    const p = evaluateAgainstTarget({ ...ATK }, { ...SKILL, element: 'ICE' }, target({ resistances: { ICE: -50 } }));
    expect(p.normal).toBe(300); // 200 * 1.5
    expect(p.isWeakness).toBe(true);
    expect(p.isResisted).toBe(false);
  });

  it('resistance reduces and flags', () => {
    const p = evaluateAgainstTarget({ ...ATK }, { ...SKILL, element: 'FIRE' }, target({ resistances: { FIRE: 50 } }));
    expect(p.normal).toBe(100); // 200 * 0.5
    expect(p.isResisted).toBe(true);
  });

  it('crit rate weights expected between normal and crit', () => {
    const p = evaluateAgainstTarget({ atk: 100, critRate: 50, critDmg: 150 }, SKILL, target({ hp: 9999, def: 0 }));
    expect(p.normal).toBe(200);
    expect(p.critical).toBe(500); // 200 * 2.5
    expect(p.expected).toBe(350); // 200*0.5 + 500*0.5
  });

  it('element boost increases damage', () => {
    const p = evaluateAgainstTarget(
      { atk: 100, critRate: 0, critDmg: 150, elementBoostPct: 50 },
      { ...SKILL, element: 'DARK' },
      target({ hp: 9999, resistances: {} }),
    );
    expect(p.normal).toBe(300); // 200 * 1.5
  });
});

describe('buildSimulationReport - summary aggregation', () => {
  const targets: SimTarget[] = [
    target({ id: 'weak', hp: 100, def: 0 }),       // expected 200 → oneShot
    target({ id: 'tanky', hp: 1000, def: 200 }),   // expected 100 → 10 hits
  ];

  it('aggregates oneShotRate / avgHitsToKill / energyEfficiency', () => {
    const r = buildSimulationReport(ATK, SKILL, targets);
    expect(r.perTarget).toHaveLength(2);
    expect(r.summary.oneShotRate).toBeCloseTo(0.5, 3); // 1/2
    expect(r.summary.avgExpected).toBe(150); // (200+100)/2
    expect(r.summary.energyEfficiency).toBeCloseTo(15, 2); // 150/10
  });

  it('energyEfficiency is null for mpCost 0 (normal attack)', () => {
    const r = buildSimulationReport(ATK, { ...SKILL, mpCost: 0 }, targets);
    expect(r.summary.energyEfficiency).toBeNull();
  });

  it('weaknessCoverage counts weakness targets', () => {
    const r = buildSimulationReport(ATK, { ...SKILL, element: 'ICE' }, [
      target({ id: 'a', resistances: { ICE: -30 } }),
      target({ id: 'b', resistances: { ICE: 20 } }),
      target({ id: 'c', resistances: {} }),
    ]);
    expect(r.summary.weaknessCoverage).toBeCloseTo(1 / 3, 2);
  });
});

describe('R-5: AoE aggregate summary', () => {
  const targets: SimTarget[] = [
    target({ id: 'weak', hp: 100, def: 0 }),       // expected 200
    target({ id: 'tanky', hp: 1000, def: 200 }),   // expected 100
  ];
  const AOE: SimSkill = { ...SKILL, targetType: 'ALL_ENEMIES' };

  it('SINGLE skill has no aoe summary', () => {
    const r = buildSimulationReport(ATK, SKILL, targets);
    expect(r.summary.aoe).toBeUndefined();
  });

  it('ALL_ENEMIES adds totalExpectedPerCast = avgExpected × assumedTargets', () => {
    const r = buildSimulationReport(ATK, AOE, targets);
    expect(r.summary.aoe).toBeDefined();
    expect(r.summary.aoe!.assumedTargets).toBe(AOE_ASSUMED_TARGETS);
    expect(r.summary.aoe!.totalExpectedPerCast).toBe(150 * AOE_ASSUMED_TARGETS); // avgExpected 150
    expect(r.summary.aoe!.energyEfficiency).toBeCloseTo((150 * AOE_ASSUMED_TARGETS) / 10, 2);
  });

  it('aoe energyEfficiency is null for mpCost 0', () => {
    const r = buildSimulationReport(ATK, { ...AOE, mpCost: 0 }, targets);
    expect(r.summary.aoe!.energyEfficiency).toBeNull();
  });

  it('reportToText includes the AoE aggregate line', () => {
    const txt = reportToText(buildSimulationReport(ATK, AOE, targets));
    expect(txt).toContain('AoE合算');
    expect(txt).toContain(`想定 ${AOE_ASSUMED_TARGETS} 体`);
  });

  it('reportToText omits the AoE line for SINGLE', () => {
    const txt = reportToText(buildSimulationReport(ATK, SKILL, targets));
    expect(txt).not.toContain('AoE合算');
  });
});

describe('reportToText', () => {
  it('produces a readable summary including key metrics', () => {
    const txt = reportToText(buildSimulationReport(ATK, SKILL, [target({ id: 'grave_soldier', tier: 'MINION', hp: 100 })]));
    expect(txt).toContain('grave_soldier');
    expect(txt).toContain('1確');
    expect(txt).toContain('要約');
  });
});
