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
        hp: 100, mp: 10, atk: 10, def: 10, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 10
      },
      passives: {
        passiveAtkBonus: 0,
        passiveDefBonus: 0,
        passiveMatkBonus: 0,
        passiveMdefBonus: 0
      },
      jobs: [
        { jobId: 'warrior', level: 10, exp: 100 }
      ],
      isAwakened: false
    };
  });

  test('changeJob should reset to Lv1 for new jobs', async () => {
    await jobService.changeJob(mockCharacter, 'mage');
    expect(mockCharacter.currentJobId).toBe('mage');
    const mageJob = mockCharacter.jobs.find(j => j.jobId === 'mage');
    expect(mageJob?.level).toBe(1);
  });

  test('onLevelUp should add passive bonus at key levels', async () => {
    // warrior Lv10 -> Lv20
    await jobService.onLevelUp(mockCharacter, 'warrior', 20);
    expect(mockCharacter.passives.passiveAtkBonus).toBe(5);
  });

  test('passive bonus persists across job changes', async () => {
    await jobService.onLevelUp(mockCharacter, 'warrior', 10); // +5
    await jobService.changeJob(mockCharacter, 'mage');
    expect(mockCharacter.passives.passiveAtkBonus).toBe(5);
  });
});
