import { JobService } from './JobService';
import { CharacterData } from '../types/game';
import { makeBaseStats, makeCharacter } from '../testing/factories';

describe('JobService', () => {
  let jobService: JobService;
  let mockCharacter: CharacterData;

  beforeEach(() => {
    jobService = new JobService();
    mockCharacter = makeCharacter({
      id: '1',
      stats: makeBaseStats({ atk: 10, def: 10, critRate: 5 }),
      jobs: [
        { jobId: 'warrior', level: 10, exp: 100 }
      ],
    });
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
    expect(mockCharacter.passives.passiveAtkBonus).toBe(2);
  });

  test('passive bonus persists across job changes', async () => {
    mockCharacter.jobs[0].level = 9;
    await jobService.onLevelUp(mockCharacter, 'warrior', 10); // +1%
    const changed = await jobService.changeJob(mockCharacter, 'mage');

    expect(changed.passives.passiveAtkBonus).toBe(1);
    expect(changed.passives).not.toBe(mockCharacter.passives);
    expect(mockCharacter.passives.passiveAtkBonus).toBe(1);
  });
});
