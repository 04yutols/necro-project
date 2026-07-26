import { prisma } from '../lib/prisma';
import { GameManager } from './GameManager';
import { emptyPlayerSave, playerSaveToJson, readPlayerSave } from '../services/PlayerSaveService';
import { PLAYER_SAVE_SCHEMA_VERSION } from '../types/playerSave';

jest.setTimeout(45000);

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { character: { select: { id: true } } },
  });
  if (!user) return;

  const characterIds = user.character ? [user.character.id] : [];
  if (characterIds.length > 0) {
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

async function createUserWithCharacter(email: string, displayName: string, necroMaxCost = 10) {
  const user = await prisma.user.create({
    data: {
      email,
      name: displayName,
      displayName,
    },
  });
  const save = emptyPlayerSave();
  save.player.name = displayName;
  save.player.necroStatus.maxCost = necroMaxCost;
  const character = await prisma.character.create({
    data: {
      userId: user.id,
      playerState: playerSaveToJson(save),
      saveVersion: PLAYER_SAVE_SCHEMA_VERSION,
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
      select: { playerState: true },
    });
    expect(readPlayerSave(updated.playerState).player.partyMonsterIds).toEqual([front.id, null, back.id]);
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
      select: { playerState: true },
    });
    expect(readPlayerSave(unchanged.playerState).player.partyMonsterIds).toEqual([first.id, second.id, null]);
  });
});

describe('GameManager.processStageResult', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `codex-sec5-${suffix}@example.test`;
  const manager = new GameManager();

  afterAll(async () => {
    await cleanupUser(email);
    await prisma.$disconnect();
  });

  test('does not use combat critRate as a discovery drop bonus', async () => {
    await cleanupUser(email);
    const { character } = await createUserWithCharacter(email, 'SEC5', 10);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const result = await manager.processStageResult(character.id, 'area1_node1');
      expect(result.rewards.weapons).toHaveLength(0);
      expect(result.rewards.residues).toHaveLength(0);
      expect(result.rewards.consumables).toHaveLength(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('persists necromanced monsters once per enemy master id', async () => {
    await cleanupUser(email);
    const { character } = await createUserWithCharacter(email, 'SEC5', 10);
    const randomValues = [
      0.99, 0.99, 0.99, // stage drop table misses
      0.99, 0.99,       // non-guaranteed necromance candidates miss
    ];
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => randomValues.shift() ?? 0.99);

    try {
      const result = await manager.processStageResult(character.id, 'area1_node1');
      expect(result.rewards.monsters.map((monster: { masterId?: string }) => monster.masterId)).toEqual(['grave_soldier', 'rot_hound']);

      const saved = await prisma.monster.findMany({
        where: { characterId: character.id, masterId: { in: ['grave_soldier', 'rot_hound'] } },
        orderBy: { masterId: 'asc' },
      });
      expect(saved.map(monster => monster.masterId)).toEqual(['grave_soldier', 'rot_hound']);
      expect(saved.find(monster => monster.masterId === 'grave_soldier')).toMatchObject({
        characterId: character.id,
        masterId: 'grave_soldier',
        name: '霊体騎士',
      });
      expect(saved.find(monster => monster.masterId === 'grave_soldier')?.skillIds).toEqual(['skill_necromancer_1']);
    } finally {
      randomSpy.mockRestore();
    }

    const secondSpy = jest.spyOn(Math, 'random').mockReturnValue(0.0);
    try {
      const second = await manager.processStageResult(character.id, 'area1_node1');
      expect(second.rewards.monsters.some((monster: { masterId?: string }) => monster.masterId === 'grave_soldier')).toBe(false);

      const savedAfterSecond = await prisma.monster.findMany({
        where: { characterId: character.id, masterId: { in: ['grave_soldier', 'rot_hound'] } },
      });
      expect(savedAfterSecond.filter(monster => monster.masterId === 'grave_soldier')).toHaveLength(1);
      expect(savedAfterSecond.filter(monster => monster.masterId === 'rot_hound')).toHaveLength(1);
    } finally {
      secondSpy.mockRestore();
    }
  });
});
