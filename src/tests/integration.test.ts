import { prisma } from '../lib/prisma';
import { JobService } from '../services/JobService';

// Neon コールドスタートを考慮して長めに設定
jest.setTimeout(30000);

describe('Integration Test: Job Persistence', () => {
  let jobService: JobService;

  beforeAll(() => {
    jobService = new JobService(prisma as any);
  });

  test('Permanent passives should be maintained across job changes', async () => {
    const characterId = 'test-char-001';

    // Job レコードを先に用意（UserJob の外部キー制約）
    await prisma.job.upsert({
      where: { id: 'warrior' },
      update: {},
      create: { id: 'warrior', name: 'Warrior', tier: 1, category: 'PHYSICAL' }
    });
    await prisma.job.upsert({
      where: { id: 'mage' },
      update: {},
      create: { id: 'mage', name: 'Mage', tier: 1, category: 'MAGICAL' }
    });

    // Character を用意（passiveAtkBonus を確実に 0 にリセット）
    await prisma.character.upsert({
      where: { id: characterId },
      update: { passiveAtkBonus: 0, currentJobId: 'warrior' },
      create: {
        id: characterId,
        name: 'Test Hero',
        hp: 100,
        atk: 10,
        def: 10,
        spd: 100,
        critRate: 5,
        critDmg: 150,
        effectHit: 0,
        effectRes: 0,
        currentJobId: 'warrior'
      }
    });

    // warrior Lv9 UserJob を用意
    await prisma.userJob.upsert({
      where: { characterId_jobId: { characterId, jobId: 'warrior' } },
      update: { level: 9 },
      create: { characterId, jobId: 'warrior', level: 9 }
    });

    // Lv9 → Lv10 でパッシブを獲得
    await jobService.onLevelUp(characterId, 'warrior', 10);

    // 転職
    await jobService.changeJob(characterId, 'mage');

    // 検証: 転職後もパッシブボーナスが維持されていること
    const updatedChar = await prisma.character.findUnique({
      where: { id: characterId }
    });

    expect(updatedChar?.currentJobId).toBe('mage');
    expect(updatedChar?.passiveAtkBonus).toBe(5); // warrior Lv10 で +5

    // クリーンアップ
    await prisma.userJob.deleteMany({ where: { characterId } });
    await prisma.character.delete({ where: { id: characterId } });
  });
});
