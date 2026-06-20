import { auth } from '@/auth';
import { prisma } from '../lib/prisma';
import jobsData from '../data/master/jobs.json';
import {
  createCharacterForUser,
  fetchPlayerAction,
  fetchPlayerForUser,
} from '../app/actions';
import { getJobBaseStatsAtLevel } from '../logic/JobGrowthSystem';
import { createCredentialsUser } from '../services/AuthService';
import type { JobData } from '../types/game';
import type { ServerGameUser } from '../types/serverGame';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.setTimeout(45000);

const JOBS = jobsData as Record<string, JobData>;

async function cleanupUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { character: { select: { id: true } } },
  });
  if (!user) return;

  const characterIds = user.character ? [user.character.id] : [];
  if (characterIds.length > 0) {
    await prisma.soulShard.deleteMany({ where: { characterId: { in: characterIds } } });
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

describe('SEC-2 fetchPlayerAction ownership checks', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `codex-sec2-a-${suffix}@example.test`;
  const emailB = `codex-sec2-b-${suffix}@example.test`;

  afterAll(async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);
    await prisma.$disconnect();
  });

  test('rejects unauthenticated calls', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const result = await fetchPlayerAction('foreign-character-id');

    expect(result.success).toBe(false);
  });

  test('returns the authenticated owner player and hides foreign characters', async () => {
    await cleanupUser(emailA);
    await cleanupUser(emailB);

    const userA = await createUser(emailA, 'SEC2-A');
    const userB = await createUser(emailB, 'SEC2-B');

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const createdA = await createCharacterForUser(userA, 'warrior', 'SEC2-A');
    expect(createdA.success).toBe(true);
    if (!createdA.success) throw new Error(createdA.error);
    const characterAId = createdA.data.player.id;

    (auth as jest.Mock).mockResolvedValue({ user: userB });
    const createdB = await createCharacterForUser(userB, 'mage', 'SEC2-B');
    expect(createdB.success).toBe(true);
    if (!createdB.success) throw new Error(createdB.error);
    const characterBId = createdB.data.player.id;

    (auth as jest.Mock).mockResolvedValue({ user: userA });
    const ownViaAction = await fetchPlayerAction(characterAId);
    expect(ownViaAction.success).toBe(true);
    if (!ownViaAction.success) throw new Error(ownViaAction.error);
    expect(ownViaAction.data.id).toBe(characterAId);
    expect(ownViaAction.data.name).toBe('SEC2-A');
    expect(ownViaAction.data.name).not.toBe('アルド');
    expect(ownViaAction.data.baseStats).toEqual(getJobBaseStatsAtLevel(JOBS.warrior, 1));
    expect(ownViaAction.data.currentJobId).toBe('warrior');

    const foreignViaAction = await fetchPlayerAction(characterBId);
    expect(foreignViaAction.success).toBe(false);

    const foreignViaForUser = await fetchPlayerForUser(userA, characterBId);
    expect(foreignViaForUser.success).toBe(false);

    (auth as jest.Mock).mockResolvedValue({ user: userB });
    const ownerB = await fetchPlayerForUser(userB, characterBId);
    expect(ownerB.success).toBe(true);
    if (!ownerB.success) throw new Error(ownerB.error);
    expect(ownerB.data.id).toBe(characterBId);
    expect(ownerB.data.name).toBe('SEC2-B');
    expect(ownerB.data.currentJobId).toBe('mage');
  });
});
