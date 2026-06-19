import { prisma } from '../lib/prisma';
import jobsData from '../data/master/jobs.json';
import { calculateEnergyState } from '../logic/EnergySystem';
import { levelFromTotalExp } from '../logic/ExperienceSystem';
import { getJobBaseStatsAtLevel } from '../logic/JobGrowthSystem';
import { RESIDUE_SLOT_ORDER } from '../logic/ResidueScore';
import { calculateCharacterStatProfile } from '../logic/StatSystem';
import { calculateWeaponBaseAttack } from '../logic/WeaponSystem';
import { createCredentialsUser } from '../services/AuthService';
import { PLAYER_SAVE_SCHEMA_VERSION, type PlayerSaveV1 } from '../types/playerSave';
import type { JobData } from '../types/game';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import {
  changeJobForUser,
  createCharacterForUser,
  dismantleWeaponForUser,
  equipItemForUser,
  equipResidueForUser,
  loadCharacterForUser,
  processStageResultForUser,
  rankUpWeaponForUser,
  reforgeWeaponForUser,
  startStageForUser,
  updatePartyForUser,
} from '../app/actions';
import type { ServerGameUser } from '../types/serverGame';
import type { StageResultMeta } from '../types/online';

jest.setTimeout(70000);

const JOBS = jobsData as Record<string, JobData>;

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

async function clearStageForTest(user: ServerGameUser, stageId: string, meta: StageResultMeta = {}) {
  const started = await startStageForUser(user, stageId);
  expect(started.success).toBe(true);
  if (!started.success) throw new Error(started.error);
  return processStageResultForUser(user, stageId, started.stageAttemptId, meta);
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
    expect(created.data.player.necroBaseStatsBonus).toBe(created.data.necroStatus.baseStatsBonus);
    expect(created.data.player.currentJobId).toBe('warrior');
    expect(created.data.player.jobs).toEqual([{ jobId: 'warrior', level: 1, exp: 0 }]);
    const warriorEnergy = calculateEnergyState(JOBS.warrior, 1);
    expect(created.data.player.currentEnergy).toBe(warriorEnergy.currentEnergy);
    expect(created.data.player.maxEnergy).toBe(warriorEnergy.maxEnergy);
    expect(created.data.inventoryItems).toHaveLength(1);
    expect(created.data.inventoryItems[0].type).toBe('WEAPON');
    expect(created.data.inventoryItems[0].name).toBe('骨砕きの短剣');
    expect(created.data.player.equipment.weapon?.id).toBe(created.data.inventoryItems[0].id);
    const starterWeapon = created.data.inventoryItems[0];
    expect(created.data.inventoryMonsters).toHaveLength(0);
    expect(created.data.abyssalResidues).toHaveLength(0);
    expect(created.data.soulShards).toHaveLength(0);
    expect(created.data.party).toEqual([null, null, null]);
    expect(created.data.weaponMaterials).toEqual(expect.arrayContaining([
      { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 8 },
      { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 10 },
    ]));
    expect(created.data.residueMaterials).toEqual([]);
    expect(created.data.transmutationPoints).toBe(0);
    const createdPlayerStateRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${created.data.player.id}
    `;
    expect(createdPlayerStateRows[0]?.playerState).toMatchObject({
      schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
      player: {
        name: displayName,
        currentJobId: 'warrior',
        gold: 50000,
        clearedStages: [],
        jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
        equipmentIds: { weapon: starterWeapon.id },
        partyMonsterIds: [null, null, null],
      },
      weaponMaterials: expect.arrayContaining([
        { type: 'IDEA_COMMON', name: '凡骨のイデア', quantity: 8 },
        { type: 'ABYSSAL_OBSIDIAN', name: '深淵の黒鋼', quantity: 10 },
      ]),
      residueMaterials: [],
      transmutationPoints: 0,
    });
    const starterAtk = calculateWeaponBaseAttack(starterWeapon);
    const reforged = await reforgeWeaponForUser(user, created.data.player.id, starterWeapon.id);
    expect(reforged.success).toBe(true);
    if (!reforged.success) throw new Error(reforged.error);
    const reforgedStarter = reforged.data.inventoryItems.find((item) => item.id === starterWeapon.id);
    expect(reforgedStarter?.ilv).toBe(2);
    expect(calculateWeaponBaseAttack(reforgedStarter!)).toBeGreaterThan(starterAtk);
    expect(reforged.data.weaponMaterials.find((material) => material.type === 'ABYSSAL_OBSIDIAN')?.quantity).toBe(9);

    const persistedStarter = await prisma.item.findUniqueOrThrow({ where: { id: starterWeapon.id } });
    expect(persistedStarter.ilv).toBe(2);
    expect(persistedStarter.atk).toBe(calculateWeaponBaseAttack(reforgedStarter!));

    const resonated = await rankUpWeaponForUser(user, created.data.player.id, starterWeapon.id);
    expect(resonated.success).toBe(true);
    if (!resonated.success) throw new Error(resonated.error);
    expect(resonated.data.inventoryItems.find((item) => item.id === starterWeapon.id)?.rank).toBe(2);
    expect(resonated.data.weaponMaterials.find((material) => material.type === 'IDEA_COMMON')?.quantity).toBe(0);

    const insufficientResonance = await rankUpWeaponForUser(user, created.data.player.id, starterWeapon.id);
    expect(insufficientResonance).toEqual({ success: false, error: '武器強化素材が不足しています' });
    expect((await prisma.item.findUniqueOrThrow({ where: { id: starterWeapon.id } })).rank).toBe(2);

    const equippedDismantle = await dismantleWeaponForUser(user, created.data.player.id, starterWeapon.id);
    expect(equippedDismantle).toEqual({ success: false, error: '装備中の武器は分解できません' });

    const spareWeapon = await prisma.item.create({
      data: {
        name: '分解確認用の短剣',
        type: 'WEAPON',
        rarity: 'R',
        ownerId: user.id,
        atk: 1,
        rank: 0,
        archetype: 'MID',
        ilv: 1,
      },
    });
    const dismantled = await dismantleWeaponForUser(user, created.data.player.id, spareWeapon.id);
    expect(dismantled.success).toBe(true);
    if (!dismantled.success) throw new Error(dismantled.error);
    expect(dismantled.data.inventoryItems.some((item) => item.id === spareWeapon.id)).toBe(false);
    expect(dismantled.data.weaponMaterials.find((material) => material.type === 'IDEA_COMMON')?.quantity).toBe(8);

    const changedToMage = await changeJobForUser(user, created.data.player.id, 'mage');
    expect(changedToMage.success).toBe(true);
    if (!changedToMage.success) throw new Error(changedToMage.error);
    expect(changedToMage.data.player.currentJobId).toBe('mage');
    expect(changedToMage.data.player.jobs).toContainEqual({ jobId: 'mage', level: 1, exp: 0 });
    const mageEnergy = calculateEnergyState(JOBS.mage, 1);
    expect(changedToMage.data.player.maxEnergy).toBe(mageEnergy.maxEnergy);
    expect(changedToMage.data.player.currentEnergy).toBe(mageEnergy.currentEnergy);

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

    const lockedStart = await startStageForUser(user, 'area2_gate');
    expect(lockedStart).toEqual({ success: false, error: 'STAGE_LOCKED' });

    const initialBaseStats = changedBackToWarrior.data.player.baseStats;
    const initialProfile = calculateCharacterStatProfile(changedBackToWarrior.data.player, changedBackToWarrior.data.equippedResidueSlots);
    expect(initialProfile.total.atk).toBeGreaterThan(created.data.player.stats.atk);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const directResult = await processStageResultForUser(user, '1-1', {
      turnCount: 5,
      clearTimeSec: 42,
      totalDamage: 3200,
    });
    expect(directResult).toMatchObject({ success: false, error: 'MISSING_STAGE_ATTEMPT' });

    const firstAttempt = await startStageForUser(user, '1-1');
    expect(firstAttempt.success).toBe(true);
    if (!firstAttempt.success) throw new Error(firstAttempt.error);

    const clearResult = await processStageResultForUser(user, '1-1', firstAttempt.stageAttemptId, {
      turnCount: 5,
      clearTimeSec: 42,
      totalDamage: Number.MAX_SAFE_INTEGER,
    });
    randomSpy.mockRestore();

    expect(clearResult.success).toBe(true);
    expect(clearResult.cloudSaved).toBe(true);
    expect(clearResult.expGain).toBeGreaterThan(0);
    expect(clearResult.dropResult.weapons.length).toBeGreaterThan(0);
    expect(clearResult.dropResult.residues).toHaveLength(0);
    expect(clearResult.data?.player.clearedStages).toContain('area1_node1');
    expect(clearResult.data?.inventoryItems.length).toBeGreaterThan(created.data.inventoryItems.length);
    expect(clearResult.stageRecord?.totalDamage).toBeLessThan(Number.MAX_SAFE_INTEGER);

    const reusedAttempt = await processStageResultForUser(user, '1-1', firstAttempt.stageAttemptId, {
      turnCount: 5,
      clearTimeSec: 42,
      totalDamage: 3200,
    });
    expect(reusedAttempt).toMatchObject({ success: false, error: 'STAGE_ATTEMPT_CONSUMED' });

    const afterClear = await loadCharacterForUser(user);
    expect(afterClear.success).toBe(true);
    expect(afterClear.success && afterClear.status).toBe('READY');
    if (!afterClear.success || afterClear.status !== 'READY') throw new Error('failed to reload character');

    const warriorJob = afterClear.data.player.jobs.find((job) => job.jobId === 'warrior');
    expect(warriorJob?.exp).toBeGreaterThan(0);
    expect(warriorJob?.level).toBeGreaterThan(1);
    expect(warriorJob?.level).toBe(levelFromTotalExp(warriorJob?.exp ?? 0));
    const expectedWarriorStats = getJobBaseStatsAtLevel(JOBS.warrior, warriorJob?.level ?? 1);
    expect(afterClear.data.player.baseStats).toEqual(expectedWarriorStats);
    const persistedAfterClear = await prisma.character.findUniqueOrThrow({ where: { id: afterClear.data.player.id } });
    expect(persistedAfterClear.hp).toBe(initialBaseStats.hp);
    expect(persistedAfterClear.atk).toBe(initialBaseStats.atk);
    expect(persistedAfterClear.def).toBe(initialBaseStats.def);
    expect(persistedAfterClear.clearedStages).toContain('area1_node1');
    expect(afterClear.data.player.clearedStages).toContain('area1_node1');
    expect(afterClear.data.inventoryItems.length).toBeGreaterThan(1);
    expect(afterClear.data.abyssalResidues).toHaveLength(0);
    const playerStateAfterClearRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${afterClear.data.player.id}
    `;
    const playerStateAfterClear = playerStateAfterClearRows[0]?.playerState;
    expect(playerStateAfterClear?.player.clearedStages).toContain('area1_node1');
    expect(playerStateAfterClear?.player.gold).toBe(afterClear.data.player.gold);
    expect(playerStateAfterClear?.player.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        jobId: 'warrior',
        exp: warriorJob?.exp,
        level: warriorJob?.level,
      }),
    ]));

    const formationMonsterA = await prisma.monster.create({
      data: {
        name: '編成保存確認スケルトン',
        masterId: 'test_formation_skeleton',
        characterId: afterClear.data.player.id,
        tribe: 'UNDEAD',
        cost: 3,
        hp: 80,
        atk: 22,
        def: 10,
        spd: 98,
        critRate: 5,
        critDmg: 150,
        effectHit: 0,
        effectRes: 0,
        currentEnergy: 30,
        maxEnergy: 30,
        resistances: {},
        skillIds: [],
      },
    });
    const formationMonsterB = await prisma.monster.create({
      data: {
        name: '編成保存確認デーモン',
        masterId: 'test_formation_demon',
        characterId: afterClear.data.player.id,
        tribe: 'DEMON',
        cost: 4,
        hp: 90,
        atk: 26,
        def: 12,
        spd: 92,
        critRate: 5,
        critDmg: 150,
        effectHit: 0,
        effectRes: 0,
        currentEnergy: 30,
        maxEnergy: 30,
        resistances: {},
        skillIds: [],
      },
    });
    const partyUpdated = await updatePartyForUser(user, afterClear.data.player.id, [formationMonsterA.id, formationMonsterB.id, null]);
    expect(partyUpdated.success).toBe(true);
    if (!partyUpdated.success) throw new Error(partyUpdated.error);
    expect(partyUpdated.data.party.map(monster => monster?.id ?? null)).toEqual([formationMonsterA.id, formationMonsterB.id, null]);
    const playerStateAfterPartyRows = await prisma.$queryRaw<Array<{
      playerState: PlayerSaveV1 | null;
      partySlot0Id: string | null;
      partySlot1Id: string | null;
      partySlot2Id: string | null;
    }>>`
      SELECT "playerState", "partySlot0Id", "partySlot1Id", "partySlot2Id"
      FROM "Character"
      WHERE id = ${afterClear.data.player.id}
    `;
    expect(playerStateAfterPartyRows[0]).toMatchObject({
      partySlot0Id: formationMonsterA.id,
      partySlot1Id: formationMonsterB.id,
      partySlot2Id: null,
    });
    expect(playerStateAfterPartyRows[0]?.playerState?.player.partyMonsterIds).toEqual([formationMonsterA.id, formationMonsterB.id, null]);
    await prisma.character.update({
      where: { id: afterClear.data.player.id },
      data: {
        partySlot0Id: null,
        partySlot1Id: null,
        partySlot2Id: null,
      },
    });
    const partyLoadedFromPlayerState = await loadCharacterForUser(user);
    expect(partyLoadedFromPlayerState.success).toBe(true);
    expect(partyLoadedFromPlayerState.success && partyLoadedFromPlayerState.status).toBe('READY');
    if (!partyLoadedFromPlayerState.success || partyLoadedFromPlayerState.status !== 'READY') throw new Error('failed to reload party drift character');
    expect(partyLoadedFromPlayerState.data.party.map(monster => monster?.id ?? null)).toEqual([formationMonsterA.id, formationMonsterB.id, null]);
    await prisma.character.update({
      where: { id: afterClear.data.player.id },
      data: {
        partySlot0Id: formationMonsterA.id,
        partySlot1Id: formationMonsterB.id,
        partySlot2Id: null,
      },
    });

    const lockedResidue = await prisma.abyssalResidue.create({
      data: {
        name: '未開放確認用の残滓',
        itemId: 'head',
        characterId: afterClear.data.player.id,
        rarity: 'COMMON',
        mainStat: { type: 'HP_FLAT', value: 120 },
        subOptions: [{ type: 'DEF_FLAT', value: 8 }],
        level: 1,
        exp: 0,
        maxExp: 800,
      },
    });
    const lockedResidueEquip = await equipResidueForUser(
      user,
      afterClear.data.player.id,
      RESIDUE_SLOT_ORDER.indexOf('head'),
      lockedResidue.id,
    );
    expect(lockedResidueEquip).toEqual({ success: false, error: '深淵の残滓は第2章到達後に解放されます' });
    await prisma.abyssalResidue.delete({ where: { id: lockedResidue.id } });

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
    const playerStateAfterWeaponEquipRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${weaponEquipped.data.player.id}
    `;
    expect(playerStateAfterWeaponEquipRows[0]?.playerState?.player.equipmentIds.weapon).toBe(droppedWeapon.id);
    await prisma.character.update({
      where: { id: weaponEquipped.data.player.id },
      data: { equipWeaponId: null },
    });
    const weaponLoadedFromPlayerState = await loadCharacterForUser(user);
    expect(weaponLoadedFromPlayerState.success).toBe(true);
    expect(weaponLoadedFromPlayerState.success && weaponLoadedFromPlayerState.status).toBe('READY');
    if (!weaponLoadedFromPlayerState.success || weaponLoadedFromPlayerState.status !== 'READY') throw new Error('failed to reload weapon drift character');
    expect(weaponLoadedFromPlayerState.data.player.equipment.weapon?.id).toBe(droppedWeapon.id);
    await prisma.character.update({
      where: { id: weaponEquipped.data.player.id },
      data: { equipWeaponId: droppedWeapon.id },
    });
    const afterWeaponEquip = calculateCharacterStatProfile(weaponEquipped.data.player, weaponEquipped.data.equippedResidueSlots);
    expect(afterWeaponEquip.total.atk).toBeGreaterThan(beforeWeaponEquip.total.atk);

    const chapterProgressSpy = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    await clearStageForTest(user, 'area1_node2');
    await clearStageForTest(user, 'area1_boss');
    await clearStageForTest(user, 'area1_node3');
    const area2GateResult = await clearStageForTest(user, 'area2_gate');
    const parallelAttemptA = await startStageForUser(user, 'area2_gate');
    const parallelAttemptB = await startStageForUser(user, 'area2_gate');
    expect(parallelAttemptA.success).toBe(true);
    expect(parallelAttemptB.success).toBe(true);
    if (!parallelAttemptA.success) throw new Error(parallelAttemptA.error);
    if (!parallelAttemptB.success) throw new Error(parallelAttemptB.error);
    const [parallelArea2A, parallelArea2B] = await Promise.all([
      processStageResultForUser(user, 'area2_gate', parallelAttemptA.stageAttemptId),
      processStageResultForUser(user, 'area2_gate', parallelAttemptB.stageAttemptId),
    ]);
    chapterProgressSpy.mockRestore();

    expect(area2GateResult.success).toBe(true);
    expect(area2GateResult.dropResult.residues.length).toBeGreaterThan(0);
    expect(area2GateResult.dropResult.materials.length).toBeGreaterThan(0);
    expect(parallelArea2A.success).toBe(true);
    expect(parallelArea2B.success).toBe(true);
    expect(parallelArea2A.dropResult.materials.length).toBeGreaterThan(0);
    expect(parallelArea2B.dropResult.materials.length).toBeGreaterThan(0);
    const allDroppedResidueMaterials = [
      ...area2GateResult.dropResult.materials,
      ...parallelArea2A.dropResult.materials,
      ...parallelArea2B.dropResult.materials,
    ];

    const afterArea2Gate = await loadCharacterForUser(user);
    expect(afterArea2Gate.success).toBe(true);
    expect(afterArea2Gate.success && afterArea2Gate.status).toBe('READY');
    if (!afterArea2Gate.success || afterArea2Gate.status !== 'READY') throw new Error('failed to reload area2 character');
    expect(afterArea2Gate.data.player.clearedStages).toContain('area1_node3');
    expect(afterArea2Gate.data.abyssalResidues.length).toBeGreaterThan(0);
    expect(afterArea2Gate.data.residueMaterials.length).toBeGreaterThanOrEqual(allDroppedResidueMaterials.length);
    for (const droppedMaterial of allDroppedResidueMaterials) {
      expect(afterArea2Gate.data.residueMaterials).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: droppedMaterial.id,
          quantity: droppedMaterial.quantity,
          expValue: droppedMaterial.expValue,
          rarity: droppedMaterial.rarity,
        }),
      ]));
    }

    const playerStateRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${afterArea2Gate.data.player.id}
    `;
    const playerState = playerStateRows[0]?.playerState;
    expect(playerState).toMatchObject({
      schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
      player: {
        currentJobId: 'warrior',
        clearedStages: expect.arrayContaining(['area1_node1', 'area1_node2', 'area1_boss', 'area1_node3', 'area2_gate']),
        jobs: expect.arrayContaining([expect.objectContaining({ jobId: 'warrior' })]),
      },
      weaponMaterials: expect.any(Array),
      transmutationPoints: 0,
    });
    expect(playerState?.residueMaterials.length).toBeGreaterThanOrEqual(allDroppedResidueMaterials.length);
    for (const droppedMaterial of allDroppedResidueMaterials) {
      expect(playerState?.residueMaterials).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: droppedMaterial.id,
          quantity: droppedMaterial.quantity,
        }),
      ]));
    }

    const residue = afterArea2Gate.data.abyssalResidues[0];
    const slotIndex = RESIDUE_SLOT_ORDER.indexOf(residue.itemId as typeof RESIDUE_SLOT_ORDER[number]);
    expect(slotIndex).toBeGreaterThanOrEqual(0);

    const beforeResidueEquip = calculateCharacterStatProfile(afterArea2Gate.data.player, afterArea2Gate.data.equippedResidueSlots);
    const residueEquipped = await equipResidueForUser(user, afterArea2Gate.data.player.id, slotIndex, residue.id);
    expect(residueEquipped.success).toBe(true);
    if (!residueEquipped.success) throw new Error(residueEquipped.error);
    expect(residueEquipped.data.equippedResidueSlots[slotIndex]?.id).toBe(residue.id);
    const playerStateAfterResidueEquipRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${residueEquipped.data.player.id}
    `;
    expect(playerStateAfterResidueEquipRows[0]?.playerState?.player.equippedResidueIds[slotIndex]).toBe(residue.id);
    const residueSlotFields = [
      'equippedResidue0Id',
      'equippedResidue1Id',
      'equippedResidue2Id',
      'equippedResidue3Id',
      'equippedResidue4Id',
    ] as const;
    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: { [residueSlotFields[slotIndex]]: null },
    });
    const residueLoadedFromPlayerState = await loadCharacterForUser(user);
    expect(residueLoadedFromPlayerState.success).toBe(true);
    expect(residueLoadedFromPlayerState.success && residueLoadedFromPlayerState.status).toBe('READY');
    if (!residueLoadedFromPlayerState.success || residueLoadedFromPlayerState.status !== 'READY') throw new Error('failed to reload residue drift character');
    expect(residueLoadedFromPlayerState.data.equippedResidueSlots[slotIndex]?.id).toBe(residue.id);
    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: { [residueSlotFields[slotIndex]]: residue.id },
    });

    const afterResidueEquip = calculateCharacterStatProfile(residueEquipped.data.player, residueEquipped.data.equippedResidueSlots);
    const statIncreased = (Object.keys(afterResidueEquip.total) as Array<keyof typeof afterResidueEquip.total>)
      .some((key) => afterResidueEquip.total[key] > beforeResidueEquip.total[key]);
    const elementIncreased = Object.values(afterResidueEquip.elementDmgBoosts).some((value) => (value ?? 0) > 0);
    expect(statIncreased || elementIncreased).toBe(true);

    const selectedPlayerStateFields = await prisma.$queryRaw<Array<{ currentJobId: string; gold: string; clearedCount: number }>>`
      SELECT
        "playerState" #>> '{player,currentJobId}' AS "currentJobId",
        "playerState" #>> '{player,gold}' AS "gold",
        jsonb_array_length("playerState" #> '{player,clearedStages}')::int AS "clearedCount"
      FROM "Character"
      WHERE id = ${residueEquipped.data.player.id}
    `;
    expect(selectedPlayerStateFields[0]).toMatchObject({
      currentJobId: residueEquipped.data.player.currentJobId,
      gold: String(residueEquipped.data.player.gold),
    });
    expect(selectedPlayerStateFields[0]?.clearedCount).toBeGreaterThanOrEqual(5);

    const fullPlayerStateBeforeLegacyDrift = playerStateAfterResidueEquipRows[0]?.playerState;
    expect(fullPlayerStateBeforeLegacyDrift?.player.clearedStages).toContain('area2_gate');
    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: { clearedStages: [] },
    });
    const startFromPlayerStateOnly = await startStageForUser(user, 'area2_gate');
    expect(startFromPlayerStateOnly.success).toBe(true);
    if (startFromPlayerStateOnly.success) {
      await prisma.stageAttempt.delete({ where: { id: startFromPlayerStateOnly.stageAttemptId } });
    }
    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: { clearedStages: fullPlayerStateBeforeLegacyDrift?.player.clearedStages ?? [] },
    });

    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: {
        playerState: {
          schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
          residueMaterials: [],
          transmutationPoints: 0,
        },
      },
    });
    const backfilled = await loadCharacterForUser(user);
    expect(backfilled.success).toBe(true);
    expect(backfilled.success && backfilled.status).toBe('READY');
    const backfilledRows = await prisma.$queryRaw<Array<{ playerState: PlayerSaveV1 | null }>>`
      SELECT "playerState" FROM "Character" WHERE id = ${residueEquipped.data.player.id}
    `;
    expect(backfilledRows[0]?.playerState?.player.clearedStages).toContain('area2_gate');
    expect(backfilledRows[0]?.playerState?.player.equipmentIds.weapon).toBe(droppedWeapon.id);
    expect(backfilledRows[0]?.playerState?.weaponMaterials).toEqual(expect.any(Array));

    const savedGold = backfilledRows[0]?.playerState?.player.gold ?? residueEquipped.data.player.gold;
    await prisma.character.update({
      where: { id: residueEquipped.data.player.id },
      data: { gold: 1 },
    });
    const legacyDriftLoad = await loadCharacterForUser(user);
    expect(legacyDriftLoad.success).toBe(true);
    expect(legacyDriftLoad.success && legacyDriftLoad.status).toBe('READY');
    if (!legacyDriftLoad.success || legacyDriftLoad.status !== 'READY') throw new Error('failed to reload drift character');
    expect(legacyDriftLoad.data.player.gold).toBe(savedGold);
  });
});
