import { prisma } from '../lib/prisma';
import { JobService } from '../services/JobService';
import { emptyPlayerSave, playerSaveToJson, readPlayerSave } from '../services/PlayerSaveService';
import { PLAYER_SAVE_SCHEMA_VERSION } from '../types/playerSave';

// Neon コールドスタートを考慮して長めに設定
jest.setTimeout(30000);

describe('Integration Test: Job Persistence', () => {
  let jobService: JobService;

  beforeAll(() => {
    jobService = new JobService(prisma as any);
  });

  test('Permanent passives should be maintained across job changes', async () => {
    const characterId = 'test-char-001';
    const userId = 'test-user-job-persistence';

    const initialSave = emptyPlayerSave();
    initialSave.player.name = 'Test Hero';
    initialSave.player.currentJobId = 'warrior';
    initialSave.player.jobs = [{ jobId: 'warrior', level: 9, exp: 0 }];

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: 'job-persistence@example.test', displayName: 'Test Hero' },
    });

    // Character を用意（旧ミラーテーブルではなく playerState を正とする）
    await prisma.character.upsert({
      where: { id: characterId },
      update: {
        playerState: playerSaveToJson(initialSave),
        saveVersion: PLAYER_SAVE_SCHEMA_VERSION,
      },
      create: {
        id: characterId,
        userId,
        playerState: playerSaveToJson(initialSave),
        saveVersion: PLAYER_SAVE_SCHEMA_VERSION,
      }
    });

    // Lv9 → Lv10 でパッシブを獲得
    await jobService.onLevelUp(characterId, 'warrior', 10);

    // 転職
    await jobService.changeJob(characterId, 'mage');

    // 検証: 転職後もパッシブボーナスが維持されていること
    const updatedChar = await prisma.character.findUnique({
      where: { id: characterId }
    });
    const updatedSave = readPlayerSave(updatedChar?.playerState);

    expect(updatedSave.player.currentJobId).toBe('mage');
    expect(updatedSave.player.passives.passiveAtkBonus).toBe(1); // warrior Lv10 で +1%
    expect(updatedSave.player.jobs).toEqual(expect.arrayContaining([
      { jobId: 'warrior', level: 10, exp: 0 },
      { jobId: 'mage', level: 1, exp: 0 },
    ]));

    // クリーンアップ
    await prisma.character.delete({ where: { id: characterId } });
    await prisma.user.delete({ where: { id: userId } });
  });
});
