import { auth } from '@/auth';
import { prisma } from '../lib/prisma';
import {
  createCharacterForUser,
  equipShardForUser,
  loadCharacterForUser,
  processGrowthForUser,
  soulStoneAction,
  soulStoneForUser,
} from '../app/actions';
import { createCredentialsUser } from '../services/AuthService';
import type { ServerGameUser } from '../types/serverGame';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.setTimeout(45000);

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { characters: { select: { id: true } } },
  });
  if (!user) return;

  const characterIds = user.characters.map((character) => character.id);
  if (characterIds.length > 0) {
    await prisma.character.updateMany({
      where: { id: { in: characterIds } },
      data: {
        equipWeaponId: null,
        equipSubId: null,
        equipHeadId: null,
        equipBodyId: null,
        equipArmsId: null,
        equipLegsId: null,
        equipAcc1Id: null,
        equipAcc2Id: null,
        partySlot0Id: null,
        partySlot1Id: null,
        partySlot2Id: null,
        equippedResidue0Id: null,
        equippedResidue1Id: null,
        equippedResidue2Id: null,
        equippedResidue3Id: null,
        equippedResidue4Id: null,
      },
    });
    await prisma.soulShard.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.userJob.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.monster.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.abyssalResidue.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.character.deleteMany({ where: { id: { in: characterIds } } });
  }

  await prisma.stageRecord.deleteMany({ where: { userId: user.id } });
  await prisma.playerStats.deleteMany({ where: { userId: user.id } });
  await prisma.worldLog.deleteMany({ where: { authorId: user.id } });
  await prisma.item.deleteMany({ where: { ownerId: user.id } });
  await prisma.item.deleteMany({ where: { discovererId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

async function createUser(email: string, displayName: string): Promise<ServerGameUser> {
  const created = await createCredentialsUser({ email, password: 'CodexPass123', displayName });
  expect(created).toEqual({ success: true });

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { id: dbUser.id, name: dbUser.displayName, email: dbUser.email };
}

async function createMonster(characterId: string, name: string, atk: number, effectHit = 40) {
  return prisma.monster.create({
    data: {
      characterId,
      name,
      tribe: 'UNDEAD',
      cost: 2,
      hp: 120,
      atk,
      def: 18,
      spd: 100,
      critRate: 5,
      critDmg: 150,
      effectHit,
      effectRes: 0,
      resistances: {},
    },
  });
}

describe('SEC-1 authenticated Server Actions', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `codex-sec1-a-${suffix}@example.test`;
  const emailB = `codex-sec1-b-${suffix}@example.test`;

  afterAll(async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);
    await prisma.$disconnect();
  });

  test('rejects unauthenticated and cross-owner calls, then persists soul stone, shard equip, and rank up', async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);

    const userA = await createUser(emailA, 'SEC1-A');
    const userB = await createUser(emailB, 'SEC1-B');

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const createdA = await createCharacterForUser(userA, 'warrior', 'SEC1-A');
    expect(createdA.success).toBe(true);
    if (!createdA.success) throw new Error(createdA.error);
    const characterAId = createdA.data.player.id;

    const sourceMonster = await createMonster(characterAId, '灰かぶりの骸', 70, 40);
    const targetMonster = await createMonster(characterAId, '縫合された衛兵', 55, 20);

    (auth as jest.Mock).mockResolvedValue(null);
    const unauthenticated = await soulStoneAction(sourceMonster.id);
    expect(unauthenticated.success).toBe(false);

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const soulStone = await soulStoneForUser(userA, sourceMonster.id);
    expect(soulStone.success).toBe(true);
    if (!soulStone.success) throw new Error(soulStone.error);
    expect(soulStone.data.originMonsterName).toBe(sourceMonster.name);
    expect(soulStone.data.effect.atkBonus).toBe(7);
    expect(soulStone.data.effect.elementDmgBoost).toBe(4);
    expect(soulStone.data.effect.specialAbility).toBe('REGENERATE_SOUL');

    await expect(prisma.monster.findUnique({ where: { id: sourceMonster.id } })).resolves.toBeNull();
    const persistedShard = await prisma.soulShard.findUniqueOrThrow({ where: { id: soulStone.data.id } });
    expect(persistedShard.characterId).toBe(characterAId);

    const loadedAfterSoulStone = await loadCharacterForUser(userA);
    expect(loadedAfterSoulStone.success).toBe(true);
    expect(loadedAfterSoulStone.success && loadedAfterSoulStone.status).toBe('READY');
    if (!loadedAfterSoulStone.success || loadedAfterSoulStone.status !== 'READY') {
      throw new Error('failed to reload after soul stone');
    }
    expect(loadedAfterSoulStone.data.inventoryMonsters.some((monster) => monster.id === sourceMonster.id)).toBe(false);
    expect(loadedAfterSoulStone.data.soulShards.some((shard) => shard.id === soulStone.data.id)).toBe(true);

    const shardEquipped = await equipShardForUser(userA, targetMonster.id, soulStone.data.id);
    expect(shardEquipped.success).toBe(true);
    if (!shardEquipped.success) throw new Error(shardEquipped.error);
    const equippedMonster = await prisma.monster.findUniqueOrThrow({ where: { id: targetMonster.id } });
    expect(equippedMonster.soulShardId).toBe(soulStone.data.id);
    expect(shardEquipped.data.inventoryMonsters.find((monster) => monster.id === targetMonster.id)?.equippedShardId).toBe(soulStone.data.id);

    await prisma.character.update({
      where: { id: characterAId },
      data: {
        necroLevel: 99,
        necroRank: 1,
        necroMaxCost: 10,
        necroBaseStatsBonus: 1.0,
      },
    });
    const rankUp = await processGrowthForUser(userA, characterAId, 'RANK_UP');
    expect(rankUp.success).toBe(true);
    if (!rankUp.success) throw new Error(rankUp.error);
    expect(rankUp.data.necroStatus.level).toBe(1);
    expect(rankUp.data.necroStatus.rank).toBe(2);
    expect(rankUp.data.necroStatus.maxCost).toBe(15);
    expect(rankUp.data.necroStatus.baseStatsBonus).toBe(1.5);

    const legacyChangeJob = await processGrowthForUser(userA, characterAId, 'CHANGE_JOB');
    expect(legacyChangeJob.success).toBe(false);

    (auth as jest.Mock).mockResolvedValue({ user: userB });
    const createdB = await createCharacterForUser(userB, 'warrior', 'SEC1-B');
    expect(createdB.success).toBe(true);
    if (!createdB.success) throw new Error(createdB.error);
    const characterBId = createdB.data.player.id;
    const foreignMonster = await createMonster(characterBId, 'よその骸', 80, 30);

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const forbiddenSoulStone = await soulStoneForUser(userA, foreignMonster.id);
    expect(forbiddenSoulStone.success).toBe(false);

    (auth as jest.Mock).mockResolvedValue({ user: userB });
    const foreignSoulStone = await soulStoneForUser(userB, foreignMonster.id);
    expect(foreignSoulStone.success).toBe(true);
    if (!foreignSoulStone.success) throw new Error(foreignSoulStone.error);

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const forbiddenEquip = await equipShardForUser(userA, targetMonster.id, foreignSoulStone.data.id);
    expect(forbiddenEquip.success).toBe(false);

    const forbiddenRankUp = await processGrowthForUser(userA, characterBId, 'RANK_UP');
    expect(forbiddenRankUp.success).toBe(false);
  });
});
