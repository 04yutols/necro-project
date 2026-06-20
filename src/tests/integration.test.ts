import { prisma } from '../lib/prisma';
import { JobService } from '../services/JobService';
import { emptyPlayerSave, playerSaveToJson, readPlayerSave } from '../services/PlayerSaveService';

// Neon コールドスタートを考慮して長めに設定
jest.setTimeout(30000);

describe('Integration Test: Job Persistence', () => {
  let jobService: JobService;

  beforeAll(() => {
    jobService = new JobService(prisma as any);
  });

  test('Permanent passives should be maintained across job changes', async () => {
    const characterId = 'test-char-001';

    const initialSave = emptyPlayerSave();
    initialSave.player.name = 'Test Hero';
    initialSave.player.currentJobId = 'warrior';
    initialSave.player.jobs = [{ jobId: 'warrior', level: 9, exp: 0 }];

    // Character を用意（旧ミラーテーブルではなく playerState を正とする）
    await prisma.character.upsert({
      where: { id: characterId },
      update: {
        currentJobId: null,
        passiveAtkBonus: 0,
        playerState: playerSaveToJson(initialSave),
      },
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
        playerState: playerSaveToJson(initialSave),
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

    expect(updatedChar?.currentJobId).toBeNull();
    expect(updatedChar?.passiveAtkBonus).toBe(0);
    expect(updatedSave.player.currentJobId).toBe('mage');
    expect(updatedSave.player.passives.passiveAtkBonus).toBe(1); // warrior Lv10 で +1%
    expect(updatedSave.player.jobs).toEqual(expect.arrayContaining([
      { jobId: 'warrior', level: 10, exp: 0 },
      { jobId: 'mage', level: 1, exp: 0 },
    ]));

    // クリーンアップ
    await prisma.character.delete({ where: { id: characterId } });
  });
});
