import {
  BOT_JOB_IDS,
  BOT_POLICY_NAMES,
  BOT_PROFILE_NAMES,
  getBotSimulationCatalog,
  runBotBattle,
  resolveBotProfile,
  simulateBotScenario,
  simulateBotSensitivity,
  validateBotScenario,
  wilsonInterval,
} from './BotSimulation';
import { MasterDataService } from '../services/MasterDataService';

describe('BotSimulation', () => {
  const mds = MasterDataService.getInstance();

  test('publishes playable master-data catalog', () => {
    const catalog = getBotSimulationCatalog();
    expect(catalog.stages.some(stage => stage.id === 'area1_node1')).toBe(true);
    expect(catalog.stages.every(stage => stage.waveCount > 0)).toBe(true);
    expect(catalog.profiles).toEqual(BOT_PROFILE_NAMES);
    expect(catalog.policies).toEqual(BOT_POLICY_NAMES);
    expect(catalog.jobs).toEqual(BOT_JOB_IDS);
    expect(catalog.suites.yomi).toHaveLength(20);
    expect(catalog.suites.chapter1.every(id => !id.startsWith('yomi_'))).toBe(true);
    expect(catalog.yomiDepthBands['B16-B20']).toEqual(['yomi_b16', 'yomi_b17', 'yomi_b18', 'yomi_b19', 'yomi_b20']);
  });

  test('rejects invalid and oversized requests', () => {
    const errors = validateBotScenario({
      stageId: 'missing',
      profile: 'starter',
      policy: 'basic_only',
      iterations: 501,
      seed: 'bad',
    });
    expect(errors).toEqual(expect.arrayContaining([
      'stageId must reference a playable stage.',
      'iterations must be an integer between 1 and 500.',
    ]));
  });

  test('replays the same scenario with the same seed', () => {
    const input = {
      stageId: 'area1_node1',
      profile: 'starter' as const,
      policy: 'weakness_first' as const,
      jobId: 'mage' as const,
      iterations: 8,
      seed: 'deterministic-batch',
      sampleRuns: 2,
    };
    const left = simulateBotScenario(input);
    const right = simulateBotScenario(input);
    expect(left.difficulty).toEqual(right.difficulty);
    expect(left.series).toEqual(right.series);
    expect(left.drops).toEqual(right.drops);
    expect(left.samples).toEqual(right.samples);
  });

  test('runs every wave and reports party survival metrics', () => {
    const stage = mds.getStage('area1_node1')!;
    const profile = resolveBotProfile('starter', 'warrior');
    const run = runBotBattle(stage, profile, 'basic_only', 'full-stage', 0, 100);
    expect(run.outcome).toBe('VICTORY');
    expect(run.wavesCleared).toBe(stage.waves.length);
    expect(run.alivePartyMembers).toBeGreaterThanOrEqual(0);
    expect(run.remainingPartyHpPct).toBeGreaterThanOrEqual(0);
    expect(run.remainingPartyHpPct).toBeLessThanOrEqual(100);
  });

  test('reports timeout when the round cap is reached', () => {
    const result = simulateBotScenario({
      stageId: 'area1_node1',
      profile: 'starter',
      policy: 'basic_only',
      iterations: 1,
      seed: 'timeout',
      maxRounds: 1,
    });
    expect(result.difficulty.timeouts).toBe(1);
    expect(result.difficulty.wins).toBe(0);
  });

  test('counts a wave cleared on the final allowed round as victory', () => {
    const stage = mds.getStage('area1_node1')!;
    const profile = resolveBotProfile('starter', 'warrior');
    const baseline = runBotBattle(stage, profile, 'basic_only', 'round-boundary', 0, 100);
    expect(baseline.outcome).toBe('VICTORY');
    const capped = runBotBattle(stage, profile, 'basic_only', 'round-boundary', 0, baseline.rounds);
    expect(capped.outcome).toBe('VICTORY');
    expect(capped.wavesCleared).toBe(stage.waves.length);
  });

  test('separates first-clear guaranteed drops from repeat rewards', () => {
    const firstClear = simulateBotScenario({
      stageId: 'area1_node1',
      profile: 'ch1_end',
      policy: 'skill_first',
      iterations: 1,
      seed: 'first-clear',
      firstClear: true,
    });
    expect(firstClear.difficulty.wins).toBe(1);
    expect(firstClear.drops.find(drop => drop.key === 'MONSTER:grave_soldier')?.dropCount).toBe(1);
    expect(firstClear.drops.find(drop => drop.key === 'MONSTER:rot_hound')?.dropCount).toBe(1);

    const repeat = simulateBotScenario({
      stageId: 'area1_node1',
      profile: 'ch1_end',
      policy: 'skill_first',
      iterations: 1,
      seed: 'first-clear',
      firstClear: false,
    });
    expect(repeat.drops.find(drop => drop.key === 'MONSTER:grave_soldier')).toBeUndefined();
  });

  test('calculates bounded Wilson intervals', () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
    const interval = wilsonInterval(55, 100);
    expect(interval.low).toBeLessThan(0.55);
    expect(interval.high).toBeGreaterThan(0.55);
    expect(interval.low).toBeGreaterThanOrEqual(0);
    expect(interval.high).toBeLessThanOrEqual(1);
  });

  test('runs YOMI with wave statScale and milestone first-clear rewards', () => {
    const result = simulateBotScenario({
      stageId: 'yomi_b10', profile: 'yomi_deep', policy: 'weakness_first', jobId: 'warrior',
      iterations: 2, seed: 'yomi-b10', firstClear: true,
    });
    expect(result.stage.id).toBe('yomi_b10');
    expect(result.resolvedProfile.clearedStages).toContain('yomi_b01');
    if (result.difficulty.wins > 0) {
      expect(result.drops.find(drop => drop.key === 'RESIDUE:EPIC')?.configuredRate).toBe(1);
    }
  });

  test('applies arbitrary weapon, party and residue build input', () => {
    const result = simulateBotScenario({
      stageId: 'area1_node1', profile: 'ch1_end', policy: 'skill_first', iterations: 1, seed: 'build',
      build: {
        jobLevel: 20, necroLevel: 100, weaponId: 'spirit_silver_saber',
        partyMonsterIds: ['goblin', 'skeleton'],
        residues: [{ mainStat: { type: 'ATK%', value: 25 }, subOptions: [{ type: 'CRIT_RATE', value: 10 }] }],
      },
    });
    expect(result.resolvedProfile).toMatchObject({ jobLevel: 20, necroLevel: 100, partyMonsterIds: ['goblin', 'skeleton'] });
    expect(result.resolvedProfile.residues).toHaveLength(1);
  });

  test('compares sensitivity variants with common random seeds', () => {
    const report = simulateBotSensitivity({
      scenario: { stageId: 'area1_node1', profile: 'starter', policy: 'basic_only', iterations: 3, seed: 'sensitivity' },
      stats: ['atk'], deltasPct: [-10, 10],
    });
    expect(report.variants).toHaveLength(2);
    expect(report.variants.map(value => value.deltaPct)).toEqual([-10, 10]);
    expect(report.baseline.difficulty.runs).toBe(3);
  });

  test('rejects oversized residue and over-cost party builds', () => {
    const residue = { mainStat: { type: 'ATK%', value: 1 } };
    const errors = validateBotScenario({
      stageId: 'area1_node1', profile: 'starter', policy: 'basic_only', iterations: 1, seed: 'bad-build',
      build: { partyMonsterIds: ['boss_goblin', 'troll', 'wyvern'], residues: [residue, residue, residue, residue, residue, residue] },
    });
    expect(errors).toEqual(expect.arrayContaining([
      'build.residues must contain at most 5 residues.',
    ]));
    expect(errors.some(error => error.includes('necro cost limit'))).toBe(true);
  });
});
