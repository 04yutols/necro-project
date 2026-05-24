import { prisma } from '../lib/prisma';
import { GameManager } from './GameManager';

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
        partySlot0Id: null,
        partySlot1Id: null,
        partySlot2Id: null,
      },
    });
    await prisma.monster.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.userJob.deleteMany({ where: { characterId: { in: characterIds } } });
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

async function createUserWithCharacter(email: string, displayName: string, necroMaxCost = 10) {
  const user = await prisma.user.create({
    data: {
      email,
      name: displayName,
      displayName,
    },
  });
  const character = await prisma.character.create({
    data: {
      userId: user.id,
      name: displayName,
      currentJobId: 'warrior',
      hp: 60,
      atk: 8,
      def: 10,
      spd: 100,
      necroMaxCost,
    },
  });
  return { user, character };
}

async function createMonster(characterId: string, name: string, cost: number) {
  return prisma.monster.create({
    data: {
      characterId,
      name,
      tribe: 'UNDEAD',
      cost,
      hp: 100,
      atk: 20,
      def: 10,
      spd: 80,
      critRate: 5,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
      resistances: {},
    },
  });
}

describe('GameManager.updateParty', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `codex-sec3-a-${suffix}@example.test`;
  const emailB = `codex-sec3-b-${suffix}@example.test`;
  const manager = new GameManager();

  afterAll(async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);
    await prisma.$disconnect();
  });

  test('persists party slots for owned monsters including empty slots', async () => {
    await cleanupUser(emailA);
    const { character } = await createUserWithCharacter(emailA, 'SEC3-A', 10);
    const front = await createMonster(character.id, '前衛の骸', 3);
    const back = await createMonster(character.id, '後衛の骸', 4);

    await manager.updateParty(character.id, [front.id, null, back.id]);

    const updated = await prisma.character.findUniqueOrThrow({
      where: { id: character.id },
      select: { partySlot0Id: true, partySlot1Id: true, partySlot2Id: true },
    });
    expect(updated).toEqual({
      partySlot0Id: front.id,
      partySlot1Id: null,
      partySlot2Id: back.id,
    });
  });

  test('rejects duplicate, foreign, and over-cost formations without overwriting the saved party', async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);
    const { character: characterA } = await createUserWithCharacter(emailA, 'SEC3-A', 5);
    const { character: characterB } = await createUserWithCharacter(emailB, 'SEC3-B', 10);
    const first = await createMonster(characterA.id, '所有骸A', 2);
    const second = await createMonster(characterA.id, '所有骸B', 3);
    const expensive = await createMonster(characterA.id, '重すぎる骸', 4);
    const foreign = await createMonster(characterB.id, 'よその骸', 1);

    await manager.updateParty(characterA.id, [first.id, second.id, null]);

    await expect(manager.updateParty(characterA.id, [first.id, first.id, null]))
      .rejects.toThrow('Duplicate monsters');
    await expect(manager.updateParty(characterA.id, [first.id, foreign.id, null]))
      .rejects.toThrow('not owned');
    await expect(manager.updateParty(characterA.id, [second.id, expensive.id, null]))
      .rejects.toThrow('Cost limit exceeded');
    await expect(manager.updateParty(characterA.id, [first.id, null]))
      .rejects.toThrow('Party must have 3 slots');

    const unchanged = await prisma.character.findUniqueOrThrow({
      where: { id: characterA.id },
      select: { partySlot0Id: true, partySlot1Id: true, partySlot2Id: true },
    });
    expect(unchanged).toEqual({
      partySlot0Id: first.id,
      partySlot1Id: second.id,
      partySlot2Id: null,
    });
  });
});
