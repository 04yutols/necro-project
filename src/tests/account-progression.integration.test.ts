import { prisma } from '../lib/prisma';
import { RESIDUE_SLOT_ORDER } from '../logic/ResidueScore';
import { calculateCharacterStatProfile } from '../logic/StatSystem';
import { createCredentialsUser } from '../services/AuthService';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import {
  changeJobForUser,
  createCharacterForUser,
  equipItemForUser,
  equipResidueForUser,
  loadCharacterForUser,
  processStageResultForUser,
} from '../app/actions';
import type { ServerGameUser } from '../types/serverGame';

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

describe('new account backend progression: signup -> starter job -> 1-1 clear -> equip drops', () => {
  const email = `codex-progression-${Date.now()}@example.test`;
  const password = 'CodexPass123';
  const displayName = '進行保証';

  afterAll(async () => {
    await cleanupUser(email);
    await prisma.$disconnect();
  });

  test('creates a fresh account and persists stage clear, drops, equipment, and stat growth', async () => {
    await cleanupUser(email);

    const signup = await createCredentialsUser({ email, password, displayName });
    expect(signup).toEqual({ success: true });

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    const user: ServerGameUser = { id: dbUser.id, name: dbUser.displayName, email: dbUser.email };
    (auth as jest.Mock).mockResolvedValue({ user });

    const beforeCharacter = await loadCharacterForUser(user);
    expect(beforeCharacter.success).toBe(true);
    expect(beforeCharacter.success && beforeCharacter.status).toBe('NO_CHARACTER');

    const created = await createCharacterForUser(user, 'warrior', displayName);
    expect(created.success).toBe(true);
    if (!created.success) throw new Error(created.error);

    expect(created.data.necroStatus.level).toBe(1);
    expect(created.data.necroStatus.rank).toBe(1);
    expect(created.data.necroStatus.exp).toBe(0);
    expect(created.data.player.currentJobId).toBe('warrior');
    expect(created.data.player.jobs).toEqual([{ jobId: 'warrior', level: 1, exp: 0 }]);
    expect(created.data.inventoryItems).toHaveLength(1);
    expect(created.data.inventoryItems[0].type).toBe('WEAPON');
    expect(created.data.inventoryItems[0].name).toBe('骨砕きの短剣');
    expect(created.data.player.equipment.weapon?.id).toBe(created.data.inventoryItems[0].id);
    expect(created.data.inventoryMonsters).toHaveLength(0);
    expect(created.data.abyssalResidues).toHaveLength(0);
    expect(created.data.soulShards).toHaveLength(0);
    expect(created.data.party).toEqual([null, null, null]);

    const changedToMage = await changeJobForUser(user, created.data.player.id, 'mage');
    expect(changedToMage.success).toBe(true);
    if (!changedToMage.success) throw new Error(changedToMage.error);
    expect(changedToMage.data.player.currentJobId).toBe('mage');
    expect(changedToMage.data.player.jobs).toContainEqual({ jobId: 'mage', level: 1, exp: 0 });
    expect(changedToMage.data.player.maxEnergy).toBe(80);

    const persistedMage = await prisma.character.findUnique({
      where: { id: created.data.player.id },
      include: { jobs: true },
    });
    expect(persistedMage?.currentJobId).toBe('mage');
    expect(persistedMage?.jobs.some((job) => job.jobId === 'mage' && job.level === 1)).toBe(true);

    const changedBackToWarrior = await changeJobForUser(user, created.data.player.id, 'warrior');
    expect(changedBackToWarrior.success).toBe(true);
    if (!changedBackToWarrior.success) throw new Error(changedBackToWarrior.error);
    expect(changedBackToWarrior.data.player.currentJobId).toBe('warrior');

    const initialBaseStats = changedBackToWarrior.data.player.baseStats;
    const initialProfile = calculateCharacterStatProfile(changedBackToWarrior.data.player, changedBackToWarrior.data.equippedResidueSlots);
    expect(initialProfile.total.atk).toBeGreaterThan(created.data.player.stats.atk);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const clearResult = await processStageResultForUser(user, '1-1', {
      turnCount: 5,
      clearTimeSec: 42,
      totalDamage: 3200,
    });
    randomSpy.mockRestore();

    expect(clearResult.success).toBe(true);
    expect(clearResult.cloudSaved).toBe(true);
    expect(clearResult.expGain).toBeGreaterThan(0);
    expect(clearResult.dropResult.weapons.length).toBeGreaterThan(0);
    expect(clearResult.dropResult.residues.length).toBeGreaterThan(0);

    const afterClear = await loadCharacterForUser(user);
    expect(afterClear.success).toBe(true);
    expect(afterClear.success && afterClear.status).toBe('READY');
    if (!afterClear.success || afterClear.status !== 'READY') throw new Error('failed to reload character');

    const warriorJob = afterClear.data.player.jobs.find((job) => job.jobId === 'warrior');
    expect(warriorJob?.exp).toBeGreaterThan(0);
    expect(warriorJob?.level).toBeGreaterThan(1);
    expect(afterClear.data.player.baseStats.hp).toBeGreaterThan(initialBaseStats.hp);
    expect(afterClear.data.player.baseStats.atk).toBeGreaterThan(initialBaseStats.atk);
    expect(afterClear.data.player.clearedStages).toContain('area1_node1');
    expect(afterClear.data.inventoryItems.length).toBeGreaterThan(1);
    expect(afterClear.data.abyssalResidues.length).toBeGreaterThan(0);

    const stageRecord = await prisma.stageRecord.findUnique({
      where: { userId_stageId: { userId: user.id, stageId: 'area1_node1' } },
    });
    expect(stageRecord?.turnCount).toBe(5);

    const droppedWeapon = afterClear.data.inventoryItems.find((item) => item.name === '血啜りの処刑剣');
    expect(droppedWeapon).toBeTruthy();
    if (!droppedWeapon) throw new Error('expected SR weapon drop');

    const beforeWeaponEquip = calculateCharacterStatProfile(afterClear.data.player, afterClear.data.equippedResidueSlots);
    const weaponEquipped = await equipItemForUser(user, afterClear.data.player.id, 'weapon', droppedWeapon.id);
    expect(weaponEquipped.success).toBe(true);
    if (!weaponEquipped.success) throw new Error(weaponEquipped.error);
    expect(weaponEquipped.data.player.equipment.weapon?.id).toBe(droppedWeapon.id);
    const afterWeaponEquip = calculateCharacterStatProfile(weaponEquipped.data.player, weaponEquipped.data.equippedResidueSlots);
    expect(afterWeaponEquip.total.atk).toBeGreaterThan(beforeWeaponEquip.total.atk);

    const residue = weaponEquipped.data.abyssalResidues[0];
    const slotIndex = RESIDUE_SLOT_ORDER.indexOf(residue.itemId as typeof RESIDUE_SLOT_ORDER[number]);
    expect(slotIndex).toBeGreaterThanOrEqual(0);

    const beforeResidueEquip = calculateCharacterStatProfile(weaponEquipped.data.player, weaponEquipped.data.equippedResidueSlots);
    const residueEquipped = await equipResidueForUser(user, weaponEquipped.data.player.id, slotIndex, residue.id);
    expect(residueEquipped.success).toBe(true);
    if (!residueEquipped.success) throw new Error(residueEquipped.error);
    expect(residueEquipped.data.equippedResidueSlots[slotIndex]?.id).toBe(residue.id);

    const afterResidueEquip = calculateCharacterStatProfile(residueEquipped.data.player, residueEquipped.data.equippedResidueSlots);
    const statIncreased = (Object.keys(afterResidueEquip.total) as Array<keyof typeof afterResidueEquip.total>)
      .some((key) => afterResidueEquip.total[key] > beforeResidueEquip.total[key]);
    const elementIncreased = Object.values(afterResidueEquip.elementDmgBoosts).some((value) => (value ?? 0) > 0);
    expect(statIncreased || elementIncreased).toBe(true);
  });
});
