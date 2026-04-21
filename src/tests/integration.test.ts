import { PrismaClient } from '@prisma/client';
import { JobService } from '../services/JobService';

describe('Integration Test: Job Persistence', () => {
  let prisma: PrismaClient;
  let jobService: JobService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    jobService = new JobService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Permanent passives should be maintained across job changes', async () => {
    // 1. テストデータの作成
    const characterId = 'test-char-001';
    
    // DB に直接データを投入 (本来は CharacterService 等で行う)
    await prisma.character.upsert({
      where: { id: characterId },
      update: {},
      create: {
        id: characterId,
        name: 'Test Hero',
        hp: 100, mp: 10, atk: 10, def: 10, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 10,
        currentJobId: 'warrior'
      }
    });

    await prisma.job.upsert({
      where: { id: 'warrior' },
      update: {},
      create: { id: 'warrior', name: 'Warrior', tier: 1, category: 'PHYSICAL' }
    });

    await prisma.userJob.upsert({
      where: { characterId_jobId: { characterId, jobId: 'warrior' } },
      update: { level: 9 }, // Lv9 にセット
      create: { characterId, jobId: 'warrior', level: 9 }
    });

    // 2. レベルアップさせてパッシブを獲得 (Lv9 -> Lv10)
    await jobService.onLevelUp(characterId, 'warrior', 10);

    // 3. 転職を実行
    await jobService.changeJob(characterId, 'mage');

    // 4. 検証: 転職後もパッシブボーナスが維持されていること
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
