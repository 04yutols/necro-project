import { JobService } from './JobService';
import { CharacterData } from '../types/game';

describe('JobService', () => {
  let jobService: JobService;
  let mockCharacter: CharacterData;

  beforeEach(() => {
    jobService = new JobService();
    mockCharacter = {
      id: '1',
      name: 'Hero',
      currentJobId: 'warrior',
      category: 'PHYSICAL',
      stats: {
        hp: 100, atk: 10, def: 10, spd: 100, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0
      },
      passives: {
        passiveAtkBonus: 0,
        passiveDefBonus: 0,
        passiveSpdBonus: 0,
        passiveCritRateBonus: 0,
        passiveCritDmgBonus: 0,
        passiveHpBonus: 0,
      },
      equipment: { weapon: null, sub: null, head: null, body: null, arms: null, legs: null, acc1: null, acc2: null },
      baseResistances: {},
      jobs: [
        { jobId: 'warrior', level: 10, exp: 100 }
      ],
      isAwakened: false,
      clearedStages: [],
      currentEnergy: 0,
      maxEnergy: 100,
      elementDmgBoosts: {},
    };
  });

  test('changeJob should return a new Lv1 job state without mutating the input character', async () => {
    const originalJobs = mockCharacter.jobs;
    const originalStats = mockCharacter.stats;

    const changed = await jobService.changeJob(mockCharacter, 'mage');

    expect(changed).not.toBe(mockCharacter);
    expect(changed.currentJobId).toBe('mage');
    expect(changed.category).toBe('MAGICAL');
    const mageJob = changed.jobs.find(j => j.jobId === 'mage');
    expect(mageJob?.level).toBe(1);
    expect(mockCharacter.currentJobId).toBe('warrior');
    expect(mockCharacter.jobs).toBe(originalJobs);
    expect(mockCharacter.jobs).toHaveLength(1);
    expect(mockCharacter.stats).toBe(originalStats);
    expect(changed.jobs).not.toBe(mockCharacter.jobs);
    expect(changed.stats).not.toBe(mockCharacter.stats);
  });

  test('onLevelUp should add passive bonus at key levels', async () => {
    // warrior Lv10 -> Lv20
    await jobService.onLevelUp(mockCharacter, 'warrior', 20);
    expect(mockCharacter.passives.passiveAtkBonus).toBe(10);
  });

  test('passive bonus persists across job changes', async () => {
    await jobService.onLevelUp(mockCharacter, 'warrior', 10); // +5
    const changed = await jobService.changeJob(mockCharacter, 'mage');

    expect(changed.passives.passiveAtkBonus).toBe(5);
    expect(changed.passives).not.toBe(mockCharacter.passives);
    expect(mockCharacter.passives.passiveAtkBonus).toBe(5);
  });
});
