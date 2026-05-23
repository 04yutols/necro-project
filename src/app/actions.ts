'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { createCredentialsUser } from '@/services/AuthService';
import { RewardService, StageDropResult } from '@/services/RewardService';
import { MasterDataService } from '@/services/MasterDataService';
import { RankingService } from '@/services/RankingService';
import { createWorldEvent, publishWorldEvents } from '@/services/WorldEventService';
import { JobService } from '@/services/JobService';
import { calculateResidueScore, RESIDUE_SLOT_ORDER } from '@/logic/ResidueScore';
import { calculateJobAdjustedStats } from '@/logic/JobSystem';
import type {
  AbyssalResidueData,
  BaseStats,
  CharacterData,
  ElementType,
  EquipmentSlots,
  ItemData,
  JobData,
  MonsterData,
  NecroStatus,
  Resistances,
  SoulShardData,
  SpiritCoreData,
  WeaponRarity,
} from '@/types/game';
import type { OnlineStageRecordSummary, StageResultMeta, WorldEventType, WorldLogEntry } from '@/types/online';
import type { CreateCharacterResult, LoadCharacterResult, SaveGameStateResult, ServerGameData, ServerGameUser } from '@/types/serverGame';

// ── ユーザー登録 ──────────────────────────────────────────────────────────────

export interface SignUpResult {
  success: boolean;
  error?:  string;
}

export async function signUpAction(
  email:       string,
  password:    string,
  displayName: string,
): Promise<SignUpResult> {
  return createCredentialsUser({ email, password, displayName });
}

export interface StageResultPayload {
  success:   boolean;
  dropResult: StageDropResult;
  expGain:   number;
  goldGain:  number;
  cloudSaved?: boolean;
  stageRecord?: OnlineStageRecordSummary;
  worldEvents?: WorldLogEntry[];
  error?:    string;
}

function emptyDrop(): StageDropResult {
  return { weapons: [], consumables: [], residues: [], materials: [], monsters: [] };
}

const DISCOVERY_RARITIES = new Set<ItemData['rarity']>(['SSR', 'UR', 'LR', 'UNIQUE', 'HIDDEN_UNIQUE']);
const STARTER_WEAPON_BY_JOB: Record<string, string> = {
  warrior: 'bone_cleaver',
  mage: 'apprentice_cinder_staff',
  dark_priest: 'mourning_bell_crozier',
  rogue: 'grave_thorn_dagger',
};

const STAGE_ID_ALIASES: Record<string, string> = {
  '1-1': 'area1_node1',
};

// レベル1基礎ステータス（職業補正前）
// 戦士の場合: HP×1.14→912, ATK×1.20→144, DEF×1.15→92
const DEFAULT_BASE_STATS: BaseStats = {
  hp: 800,
  atk: 120,
  def: 80,
  spd: 100,
  critRate: 5,
  critDmg: 150,
  effectHit: 0,
  effectRes: 0,
};

// レベルアップごとのステータス成長量（職業補正前の生値）
const STAT_GROWTH_PER_LEVEL = {
  hp:  40,
  atk: 6,
  def: 4,
} as const;

// 累積EXP必要量: expForLevel(n) = 50*(n-1)*(n+8)
// Lv2: 500, Lv3: 1100, Lv4: 1800, Lv5: 2600, ...
function expForLevel(n: number): number {
  if (n <= 1) return 0;
  return 50 * (n - 1) * (n + 8);
}

function levelFromTotalExp(totalExp: number): number {
  let level = 1;
  while (level < 99 && expForLevel(level + 1) <= totalExp) level++;
  return level;
}
const EMPTY_EQUIPMENT: EquipmentSlots = {
  weapon: null,
  sub: null,
  head: null,
  body: null,
  arms: null,
  legs: null,
  acc1: null,
  acc2: null,
};

function getPlayerDisplayName(sessionUser: { name?: string | null; email?: string | null }) {
  return sessionUser.name ?? sessionUser.email ?? '名もなき死霊術師';
}

function isDiscoveryWeapon(weapon: ItemData): boolean {
  return weapon.isUnique || DISCOVERY_RARITIES.has(weapon.rarity);
}

function eventTypeForWeapon(weapon: ItemData): WorldEventType {
  return weapon.isUnique || weapon.rarity === 'UR' || weapon.rarity === 'UNIQUE' || weapon.rarity === 'HIDDEN_UNIQUE'
    ? 'UR_DISCOVERED'
    : 'SSR_DISCOVERED';
}

function weaponRarityForPayload(weapon: ItemData): WeaponRarity | ItemData['rarity'] {
  return weapon.weaponRarity ?? (weapon.rarity as WeaponRarity | ItemData['rarity']);
}

function toResidueData(row: {
  id: string;
  name: string;
  itemId: string;
  rarity: string;
  mainStat: Prisma.JsonValue;
  subOptions: Prisma.JsonValue;
  level: number;
  exp: number;
  maxExp: number;
}): AbyssalResidueData {
  return {
    id: row.id,
    name: row.name,
    itemId: row.itemId,
    rarity: row.rarity as AbyssalResidueData['rarity'],
    mainStat: row.mainStat as AbyssalResidueData['mainStat'],
    subOptions: row.subOptions as unknown as AbyssalResidueData['subOptions'],
    level: row.level,
    exp: row.exp,
    maxExp: row.maxExp,
  };
}

function toItemData(row: {
  id: string;
  name: string;
  type: string;
  rarity: string;
  atk: number;
  def: number;
  critRate: number;
  critDmg: number;
  spd: number;
  specialEffect: string | null;
  rank: number;
  archetype: string | null;
  ilv: number | null;
  passiveA: Prisma.JsonValue | null;
  passiveB: Prisma.JsonValue | null;
  subOptions: Prisma.JsonValue | null;
  isUnique: boolean;
  discovererId: string | null;
  discovererName: string | null;
  serialNo: number | null;
  discoveredAt: Date | null;
}): ItemData {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ItemData['type'],
    rarity: row.rarity as ItemData['rarity'],
    stats: {
      atk: row.atk,
      def: row.def,
      critRate: row.critRate,
      critDmg: row.critDmg,
      spd: row.spd,
    },
    specialEffect: row.specialEffect ?? undefined,
    rank: row.rank,
    archetype: row.archetype as ItemData['archetype'],
    ilv: row.ilv ?? undefined,
    passiveA: row.passiveA as unknown as ItemData['passiveA'],
    passiveB: row.passiveB as unknown as ItemData['passiveB'],
    subOptions: row.subOptions as unknown as ItemData['subOptions'],
    isUnique: row.isUnique,
    discovererId: row.discovererId ?? undefined,
    discovererName: row.discovererName ?? undefined,
    serialNo: row.serialNo ?? undefined,
    discoveredAt: row.discoveredAt?.toISOString(),
  };
}

function toBaseStats(row: {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
  effectHit: number;
  effectRes: number;
}): BaseStats {
  return {
    hp: row.hp,
    atk: row.atk,
    def: row.def,
    spd: row.spd,
    critRate: row.critRate,
    critDmg: row.critDmg,
    effectHit: row.effectHit,
    effectRes: row.effectRes,
  };
}

function toResidueSlot(row: unknown): AbyssalResidueData | null {
  return row ? toResidueData(row as Parameters<typeof toResidueData>[0]) : null;
}

function toSpiritCoreData(row: {
  id: string;
  name: string;
  element: string | null;
  skillChangeId: string | null;
  atkMultiplier: number;
} | null | undefined): SpiritCoreData | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    element: row.element as ElementType | undefined,
    skillChangeId: row.skillChangeId ?? undefined,
    atkMultiplier: row.atkMultiplier,
  };
}

function toSoulShardData(row: {
  id: string;
  originMonster: string;
  atkBonus: number;
  elementDmgBoost: number;
  specialAbility: string | null;
}): SoulShardData {
  return {
    id: row.id,
    originMonsterName: row.originMonster,
    effect: {
      atkBonus: row.atkBonus,
      elementDmgBoost: row.elementDmgBoost,
      specialAbility: row.specialAbility ?? undefined,
    },
  };
}

function toMonsterData(row: any): MonsterData {
  return {
    id: row.id,
    name: row.name,
    tribe: row.tribe,
    cost: row.cost,
    stats: toBaseStats(row),
    resistances: (row.resistances ?? {}) as Resistances,
    equippedShardId: row.soulShardId ?? undefined,
    spiritCore: toSpiritCoreData(row.spiritCore),
  };
}

function getJobData(jobId: string): JobData {
  const mds = MasterDataService.getInstance();
  return (mds.getJob(jobId) ?? mds.getJob('warrior')) as JobData;
}

function toServerUser(sessionUser: { id?: string; name?: string | null; email?: string | null }): ServerGameUser {
  return {
    id: sessionUser.id ?? '',
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
  };
}

function toServerGameData(character: any, inventoryItems: any[], inventoryMonsters: any[]): ServerGameData {
  const currentJobId = character.currentJobId ?? 'warrior';
  const currentJob = getJobData(currentJobId);
  const baseStats = toBaseStats(character);
  const equippedResidueSlots = [
    toResidueSlot(character.equippedResidue0),
    toResidueSlot(character.equippedResidue1),
    toResidueSlot(character.equippedResidue2),
    toResidueSlot(character.equippedResidue3),
    toResidueSlot(character.equippedResidue4),
  ];
  const player: CharacterData = {
    id: character.id,
    name: character.name,
    currentJobId,
    category: currentJob.category,
    baseStats,
    stats: calculateJobAdjustedStats(baseStats, currentJob),
    passives: {
      passiveAtkBonus: character.passiveAtkBonus,
      passiveDefBonus: character.passiveDefBonus,
      passiveSpdBonus: character.passiveSpdBonus,
      passiveCritRateBonus: character.passiveCritRateBonus,
      passiveCritDmgBonus: character.passiveCritDmgBonus,
      passiveHpBonus: character.passiveHpBonus,
    },
    equipment: {
      ...EMPTY_EQUIPMENT,
      weapon: character.equipWeapon ? toItemData(character.equipWeapon) : null,
      sub: character.equipSub ? toItemData(character.equipSub) : null,
      head: character.equipHead ? toItemData(character.equipHead) : null,
      body: character.equipBody ? toItemData(character.equipBody) : null,
      arms: character.equipArms ? toItemData(character.equipArms) : null,
      legs: character.equipLegs ? toItemData(character.equipLegs) : null,
      acc1: character.equipAcc1 ? toItemData(character.equipAcc1) : null,
      acc2: character.equipAcc2 ? toItemData(character.equipAcc2) : null,
    },
    baseResistances: {},
    jobs: (character.jobs ?? []).map((job: any) => ({ jobId: job.jobId, level: job.level, exp: job.exp })),
    isAwakened: false,
    clearedStages: character.clearedStages ?? [],
    gold: character.gold ?? 50000,
    currentEnergy: 0,
    maxEnergy: currentJob.energyCurve?.baseMaxEnergy ?? 100,
    elementDmgBoosts: {},
  };
  const monsters = inventoryMonsters.map(toMonsterData);
  const soulShards = new Map<string, SoulShardData>();
  inventoryMonsters.forEach((monster) => {
    if (monster.soulShard) soulShards.set(monster.soulShard.id, toSoulShardData(monster.soulShard));
  });

  return {
    player,
    necroStatus: {
      level: character.necroLevel,
      rank: character.necroRank,
      maxCost: character.necroMaxCost,
      baseStatsBonus: character.necroBaseStatsBonus,
      exp: character.necroExp ?? 0,
    } satisfies NecroStatus,
    party: [
      character.partySlot0 ? toMonsterData(character.partySlot0) : null,
      character.partySlot1 ? toMonsterData(character.partySlot1) : null,
      character.partySlot2 ? toMonsterData(character.partySlot2) : null,
    ],
    inventoryMonsters: monsters,
    soulShards: Array.from(soulShards.values()),
    inventoryItems: inventoryItems.map(toItemData),
    abyssalResidues: (character.abyssalResidues ?? []).map(toResidueData),
    equippedResidueSlots,
  };
}

async function ensureJobRow(tx: Prisma.TransactionClient, jobId: string) {
  const job = getJobData(jobId);
  await tx.job.upsert({
    where: { id: jobId },
    update: {
      name: job.displayName ?? job.name,
      tier: job.tier,
      category: job.category,
    },
    create: {
      id: jobId,
      name: job.displayName ?? job.name,
      tier: job.tier,
      category: job.category,
    },
  });
}

function itemCreateDataFromMaster(item: ItemData, ownerId: string): Prisma.ItemCreateInput {
  return {
    name: item.name,
    type: item.type,
    rarity: item.rarity,
    owner: { connect: { id: ownerId } },
    atk: Math.round(item.stats?.atk ?? 0),
    def: Math.round(item.stats?.def ?? 0),
    critRate: item.stats?.critRate ?? 0,
    critDmg: item.stats?.critDmg ?? 0,
    spd: Math.round(item.stats?.spd ?? 0),
    specialEffect: item.specialEffect ?? null,
    rank: item.rank ?? 0,
    archetype: item.archetype ?? null,
    ilv: item.ilv ?? null,
    passiveA: item.passiveA ? (item.passiveA as unknown as Prisma.InputJsonValue) : undefined,
    passiveB: item.passiveB ? (item.passiveB as unknown as Prisma.InputJsonValue) : undefined,
    subOptions: item.subOptions ? (item.subOptions as unknown as Prisma.InputJsonValue) : undefined,
    isUnique: item.isUnique,
  };
}

function resolveStageId(stageId: string): string {
  return STAGE_ID_ALIASES[stageId] ?? stageId;
}

function getStarterWeaponId(jobId: string): string {
  return STARTER_WEAPON_BY_JOB[jobId] ?? STARTER_WEAPON_BY_JOB.warrior;
}

const EQUIPMENT_FIELD_BY_SLOT: Partial<Record<keyof EquipmentSlots, string>> = {
  weapon: 'equipWeaponId',
  sub: 'equipSubId',
  head: 'equipHeadId',
  body: 'equipBodyId',
  arms: 'equipArmsId',
  legs: 'equipLegsId',
  acc1: 'equipAcc1Id',
  acc2: 'equipAcc2Id',
};

const ITEM_TYPE_BY_SLOT: Partial<Record<keyof EquipmentSlots, ItemData['type']>> = {
  weapon: 'WEAPON',
  sub: 'SUB',
  head: 'HEAD',
  body: 'BODY',
  arms: 'ARMS',
  legs: 'LEGS',
  acc1: 'ACC1',
  acc2: 'ACC2',
};

function toReadyResult(loaded: LoadCharacterResult): SaveGameStateResult {
  if (loaded.success && loaded.status === 'READY') return { success: true, data: loaded.data };
  if (loaded.success) return { success: false, error: 'キャラクターデータが見つかりません' };
  return { success: false, error: loaded.error };
}

function jobChangeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('not found in master data')) return '存在しない職業です';
  if (message.includes('is locked')) return '解放条件を満たしていません';
  if (message.includes('Character') && message.includes('not found')) return 'キャラクターが見つかりません';
  return '転職の保存に失敗しました';
}

async function getAuthorizedUser(userId: string): Promise<ServerGameUser | null> {
  const session = await auth().catch(() => null);
  if (session?.user?.id !== userId) return null;
  return toServerUser(session.user);
}

/**
 * ステージクリア後のリザルト処理。
 * ログイン済み時はサーバー側でドロップ抽選 + DB保存を行う。
 * Next.js 実行時にセッションがない場合は、クライアントで再ログインを促す。
 */
export async function processStageResultAction(stageId: string, meta: StageResultMeta = {}): Promise<StageResultPayload> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return {
      success: false,
      dropResult: emptyDrop(),
      expGain: 0,
      goldGain: 0,
      cloudSaved: false,
      error: 'SESSION_EXPIRED',
    };
  }
  return processStageResultForUser(toServerUser(session.user), stageId, meta);
}

export async function processStageResultForUser(
  user: ServerGameUser,
  stageId: string,
  meta: StageResultMeta = {},
): Promise<StageResultPayload> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) {
    return {
      success: false,
      dropResult: emptyDrop(),
      expGain: 0,
      goldGain: 0,
      cloudSaved: false,
      error: 'SESSION_EXPIRED',
    };
  }

  const mds   = MasterDataService.getInstance();
  const normalizedStageId = resolveStageId(stageId);
  const stage = mds.getStage(normalizedStageId);
  const svc   = new RewardService();

  if (!stage) {
    return { success: false, dropResult: emptyDrop(), expGain: 0, goldGain: 0, error: 'Stage not found' };
  }
  const userId = authorizedUser.id;

  // Character 取得（userId で紐付け）
  const char = await prisma.character.findFirst({
    where: { userId },
    include: { jobs: true },
  });
  if (!char) {
    return { success: false, dropResult: emptyDrop(), expGain: 0, goldGain: 0, cloudSaved: false, error: 'CHARACTER_NOT_FOUND' };
  }

  // EXP 計算
  const playerForExp: Parameters<RewardService['calculateExp']>[1] = {
    category:     'PHYSICAL',
    currentJobId: char.currentJobId ?? 'warrior',
    jobs:         (char.jobs as any[]).map(j => ({ jobId: j.jobId, level: j.level, exp: j.exp })),
  } as any;
  const expGain  = svc.calculateExp(stage.rewards.baseExp, playerForExp);
  const goldGain = stage.rewards.baseGold;

  // ドロップ抽選（サーバー側で確定）
  const dropResult = svc.processDropTable(stage.rewards.dropTable);
  const bestResidueScore = Math.max(0, ...dropResult.residues.map(residue => calculateResidueScore(residue)));
  const playerName = getPlayerDisplayName(authorizedUser);

  // DB 保存（トランザクション）
  const transactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const worldEvents: WorldLogEntry[] = [];

    // 武器保存
    for (const weapon of dropResult.weapons) {
      const isDiscoverable = isDiscoveryWeapon(weapon);
      const existingDiscovery = isDiscoverable
        ? await tx.item.findFirst({
            where: {
              name: weapon.name,
              rarity: weapon.rarity,
              discovererId: { not: null },
            },
            select: { id: true },
          })
        : null;
      const serialNo = isDiscoverable
        ? (await tx.itemSerialCounter.upsert({
            where: { itemName: weapon.name },
            update: { counter: { increment: 1 } },
            create: { itemName: weapon.name, counter: 1 },
            select: { counter: true },
          })).counter
        : undefined;
      const isFirstDiscovery = isDiscoverable && !existingDiscovery;
      const discoveredAt = isFirstDiscovery ? new Date() : null;

      await tx.item.create({
        data: {
          name:          weapon.name,
          type:          weapon.type,
          rarity:        weapon.rarity,
          ownerId:       userId,
          atk:           Math.round(weapon.stats?.atk ?? 0),
          def:           Math.round(weapon.stats?.def ?? 0),
          critRate:      weapon.stats?.critRate ?? 0,
          critDmg:       weapon.stats?.critDmg ?? 0,
          spd:           Math.round(weapon.stats?.spd ?? 0),
          specialEffect: weapon.specialEffect ?? null,
          rank:          weapon.rank ?? 0,
          archetype:     weapon.archetype ?? null,
          ilv:           weapon.ilv ?? null,
          passiveA:      weapon.passiveA ? (weapon.passiveA as unknown as Prisma.InputJsonValue) : undefined,
          passiveB:      weapon.passiveB ? (weapon.passiveB as unknown as Prisma.InputJsonValue) : undefined,
          subOptions:    weapon.subOptions ? (weapon.subOptions as unknown as Prisma.InputJsonValue) : undefined,
          isUnique:      weapon.isUnique,
          discovererId:  isFirstDiscovery ? userId : null,
          discovererName: isFirstDiscovery ? playerName : null,
          discoveredAt,
          serialNo,
        },
      });

      if (serialNo) weapon.serialNo = serialNo;
      if (isFirstDiscovery) {
        weapon.discovererId = userId;
        weapon.discovererName = playerName;
        weapon.discoveredAt = discoveredAt?.toISOString();
        worldEvents.push(await createWorldEvent(tx, eventTypeForWeapon(weapon), {
          playerName,
          itemName: weapon.name,
          rarity: weaponRarityForPayload(weapon),
          serialNo,
          isUnique: weapon.isUnique,
        }, userId));
      }
    }

    // 消費アイテム保存
    for (const consumable of dropResult.consumables) {
      await tx.item.create({
        data: itemCreateDataFromMaster(consumable, userId),
      });
    }

    // 残滓保存
    for (const residue of dropResult.residues) {
      await tx.abyssalResidue.create({
        data: {
          name:        residue.name,
          itemId:      residue.itemId,
          characterId: char.id,
          rarity:      residue.rarity,
          mainStat:    residue.mainStat  as any,
          subOptions:  residue.subOptions as any,
          level:       residue.level,
          exp:         residue.exp,
          maxExp:      residue.maxExp,
        },
      });
    }

    // EXP 加算 + レベルアップ時ステータス成長
    const currentJob = (char.jobs as any[]).find(j => j.jobId === char.currentJobId);
    if (currentJob) {
      const newExp      = currentJob.exp + expGain;
      const oldLevel    = currentJob.level as number;
      const newLevel    = Math.min(99, levelFromTotalExp(newExp));
      const levelsGained = newLevel - oldLevel;

      await tx.userJob.update({
        where: { characterId_jobId: { characterId: char.id, jobId: char.currentJobId! } },
        data:  { exp: newExp, level: newLevel },
      });

      if (levelsGained > 0) {
        await tx.character.update({
          where: { id: char.id },
          data: {
            hp:  { increment: STAT_GROWTH_PER_LEVEL.hp  * levelsGained },
            atk: { increment: STAT_GROWTH_PER_LEVEL.atk * levelsGained },
            def: { increment: STAT_GROWTH_PER_LEVEL.def * levelsGained },
          },
        });
      }
    }

    for (const monster of dropResult.monsters) {
      await tx.monster.create({
        data: {
          masterId: monster.id,
          characterId: char.id,
          name: monster.name,
          tribe: monster.tribe,
          cost: monster.cost,
          hp: monster.stats.hp,
          atk: monster.stats.atk,
          def: monster.stats.def,
          spd: monster.stats.spd,
          critRate: monster.stats.critRate,
          critDmg: monster.stats.critDmg,
          effectHit: monster.stats.effectHit,
          effectRes: monster.stats.effectRes,
          resistances: (monster.resistances ?? {}) as Prisma.InputJsonValue,
        },
      });
    }

    await tx.character.update({
      where: { id: char.id },
      data: {
        gold: { increment: goldGain },
        ...(!char.clearedStages.includes(normalizedStageId) ? { clearedStages: { push: normalizedStageId } } : {}),
      },
    });

    const isBossStage = stage.nodeType === 'BOSS' || Boolean(stage.isAreaBoss);
    const isWorldFirstBossClear = isBossStage && !(await tx.stageRecord.findFirst({
      where: { stageId: normalizedStageId },
      select: { id: true },
    }));
    const stageRecord = await RankingService.recordStageClear(tx, {
      userId,
      stageId: normalizedStageId,
      turnCount: meta.turnCount,
      clearTimeSec: meta.clearTimeSec,
      totalDamage: meta.totalDamage,
      isBossStage,
      bestResidueScore,
    });

    if (isWorldFirstBossClear) {
      worldEvents.push(await createWorldEvent(tx, 'BOSS_CLEARED', {
        playerName,
        stageId: normalizedStageId,
        stageName: stage.nameJa ?? stage.name ?? stageId,
      }, userId));
    }
    if (stageRecord.becameTopResidue && bestResidueScore > 0) {
      worldEvents.push(await createWorldEvent(tx, 'RANKING_UPDATED', {
        playerName,
        rankingName: '残滓スコア',
        value: bestResidueScore,
      }, userId));
    }

    return { stageRecord, worldEvents };
  });

  await RankingService.invalidate();
  await publishWorldEvents(transactionResult.worldEvents);

  return {
    success: true,
    dropResult,
    expGain,
    goldGain,
    cloudSaved: true,
    stageRecord: transactionResult.stageRecord,
    worldEvents: transactionResult.worldEvents,
  };
}

export async function loadCharacterAction(): Promise<LoadCharacterResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return { success: false, status: 'UNAUTHENTICATED', error: 'ログインが必要です' };
  }
  return loadCharacterForUser(toServerUser(session.user));
}

export async function loadCharacterForUser(user: ServerGameUser): Promise<LoadCharacterResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) {
    return { success: false, status: 'UNAUTHENTICATED', error: 'ログインが必要です' };
  }

  const character = await prisma.character.findFirst({
    where: { userId: authorizedUser.id },
    include: {
      jobs: true,
      equipWeapon: true,
      equipSub: true,
      equipHead: true,
      equipBody: true,
      equipArms: true,
      equipLegs: true,
      equipAcc1: true,
      equipAcc2: true,
      abyssalResidues: true,
      partySlot0: { include: { soulShard: true, spiritCore: true } },
      partySlot1: { include: { soulShard: true, spiritCore: true } },
      partySlot2: { include: { soulShard: true, spiritCore: true } },
      equippedResidue0: true,
      equippedResidue1: true,
      equippedResidue2: true,
      equippedResidue3: true,
      equippedResidue4: true,
    },
  });
  if (!character) {
    return { success: true, status: 'NO_CHARACTER', user: authorizedUser };
  }

  const inventoryItems = await prisma.item.findMany({
    where: { ownerId: authorizedUser.id },
    orderBy: { id: 'desc' },
  });
  const inventoryMonsters = await prisma.monster.findMany({
    where: { characterId: character.id },
    include: { soulShard: true, spiritCore: true },
    orderBy: { id: 'asc' },
  });

  return {
    success: true,
    status: 'READY',
    user: authorizedUser,
    data: toServerGameData(character, inventoryItems, inventoryMonsters),
  };
}

export async function changeJobAction(characterId: string, jobId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return changeJobForUser(toServerUser(session.user), characterId, jobId);
}

export async function changeJobForUser(
  user: ServerGameUser,
  characterId: string,
  jobId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    select: { id: true },
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  try {
    await new JobService(prisma).changeJob(character.id, jobId);
  } catch (error) {
    return { success: false, error: jobChangeErrorMessage(error) };
  }

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function createCharacterAction(
  jobId: string,
  name: string,
): Promise<CreateCharacterResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return { success: false, error: 'ログインが必要です' };
  }
  return createCharacterForUser(toServerUser(session.user), jobId, name);
}

export async function createCharacterForUser(
  user: ServerGameUser,
  jobId: string,
  name: string,
): Promise<CreateCharacterResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) {
    return { success: false, error: 'ログインが必要です' };
  }

  const userId = authorizedUser.id;
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 16) {
    return { success: false, error: '名前は2〜16文字にしてください' };
  }
  if (!MasterDataService.getInstance().getJob(jobId)) {
    return { success: false, error: '存在しない職業です' };
  }

  const exists = await prisma.character.findFirst({ where: { userId }, select: { id: true } });
  if (exists) {
    const loaded = await loadCharacterForUser(authorizedUser);
    if (loaded.success && loaded.status === 'READY') return { success: true, data: loaded.data };
    return { success: false, error: '既にキャラクターが存在します' };
  }

  const mds = MasterDataService.getInstance();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await ensureJobRow(tx, jobId);

    const starterWeapon = mds.getItem(getStarterWeaponId(jobId)) as ItemData | undefined;
    const createdWeapon = starterWeapon
      ? await tx.item.create({ data: itemCreateDataFromMaster(starterWeapon, userId), select: { id: true } })
      : null;

    await tx.character.create({
      data: {
        name: trimmedName,
        userId,
        currentJobId: jobId,
        gold: 50000,
        hp: DEFAULT_BASE_STATS.hp,
        atk: DEFAULT_BASE_STATS.atk,
        def: DEFAULT_BASE_STATS.def,
        spd: DEFAULT_BASE_STATS.spd,
        critRate: DEFAULT_BASE_STATS.critRate,
        critDmg: DEFAULT_BASE_STATS.critDmg,
        effectHit: DEFAULT_BASE_STATS.effectHit,
        effectRes: DEFAULT_BASE_STATS.effectRes,
        equipWeaponId: createdWeapon?.id ?? null,
        jobs: { create: { jobId, level: 1, exp: 0 } },
      },
    });
  });

  const loaded = await loadCharacterForUser(authorizedUser);
  if (loaded.success && loaded.status === 'READY') {
    return { success: true, data: loaded.data };
  }
  return { success: false, error: 'キャラクター作成後のロードに失敗しました' };
}

export async function loadGameStateAction() {
  return loadCharacterAction();
}

export async function fetchPlayerAction(characterId: string) {
  return {
    success: true,
    data: {
      id:    characterId,
      name:  'アルド',
      stats: { hp: 100, atk: 20, def: 10, spd: 100, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 0 },
    },
  };
}

export async function processGrowthAction(characterId: string, type: 'RANK_UP' | 'CHANGE_JOB') {
  return { success: true, message: `${type} completed.` };
}

export async function soulStoneAction(monsterId: string) {
  const id = `shard-${Math.random().toString(36).substr(2, 9)}`;
  return { success: true, data: { id, originMonsterName: 'Goblin', effect: { atkBonus: 5, elementDmgBoost: 0 } } };
}

export async function updatePartyAction(characterId: string, monsterIds: (string | null)[]): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return updatePartyForUser(toServerUser(session.user), characterId, monsterIds);
}

export async function equipShardAction(monsterId: string, shardId: string) {
  return { success: true };
}

export async function equipItemAction(characterId: string, slot: string, itemId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return equipItemForUser(toServerUser(session.user), characterId, slot, itemId);
}

export async function unequipItemAction(characterId: string, slot: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return unequipItemForUser(toServerUser(session.user), characterId, slot);
}

export async function equipResidueAction(characterId: string, slotIndex: number, residueId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return equipResidueForUser(toServerUser(session.user), characterId, slotIndex, residueId);
}

export async function updatePartyForUser(
  user: ServerGameUser,
  characterId: string,
  monsterIds: (string | null)[],
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const ids = [monsterIds[0] ?? null, monsterIds[1] ?? null, monsterIds[2] ?? null];
  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    select: { id: true, necroMaxCost: true },
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  const uniqueIds = ids.filter((id): id is string => Boolean(id));
  if (new Set(uniqueIds).size !== uniqueIds.length) {
    return { success: false, error: '同じ魔物を複数スロットに編成できません' };
  }

  const monsters = uniqueIds.length > 0
    ? await prisma.monster.findMany({ where: { id: { in: uniqueIds }, characterId }, select: { id: true, cost: true } })
    : [];
  if (monsters.length !== uniqueIds.length) {
    return { success: false, error: '所有していない魔物が含まれています' };
  }
  const totalCost = monsters.reduce((sum, monster) => sum + monster.cost, 0);
  if (totalCost > character.necroMaxCost) {
    return { success: false, error: '編成コストが上限を超えています' };
  }

  await prisma.character.update({
    where: { id: characterId },
    data: {
      partySlot0Id: ids[0],
      partySlot1Id: ids[1],
      partySlot2Id: ids[2],
    },
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function equipItemForUser(
  user: ServerGameUser,
  characterId: string,
  slot: string,
  itemId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const typedSlot = slot as keyof EquipmentSlots;
  const dbField = EQUIPMENT_FIELD_BY_SLOT[typedSlot];
  const expectedType = ITEM_TYPE_BY_SLOT[typedSlot];
  if (!dbField || !expectedType) return { success: false, error: '装備スロットが不正です' };

  const character = await prisma.character.findFirst({ where: { id: characterId, userId: authorizedUser.id }, select: { id: true } });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  const item = await prisma.item.findFirst({
    where: { id: itemId, ownerId: authorizedUser.id },
    select: { id: true, type: true },
  });
  if (!item) return { success: false, error: '所有していない装備です' };
  if (item.type !== expectedType) return { success: false, error: 'このスロットには装備できません' };

  await prisma.character.update({
    where: { id: characterId },
    data: { [dbField]: item.id } as Prisma.CharacterUpdateInput,
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function unequipItemForUser(
  user: ServerGameUser,
  characterId: string,
  slot: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const typedSlot = slot as keyof EquipmentSlots;
  const dbField = EQUIPMENT_FIELD_BY_SLOT[typedSlot];
  if (!dbField) return { success: false, error: '装備スロットが不正です' };

  const character = await prisma.character.findFirst({ where: { id: characterId, userId: authorizedUser.id }, select: { id: true } });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  await prisma.character.update({
    where: { id: characterId },
    data: { [dbField]: null } as Prisma.CharacterUpdateInput,
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function equipResidueForUser(
  user: ServerGameUser,
  characterId: string,
  slotIndex: number,
  residueId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RESIDUE_SLOT_ORDER.length) {
    return { success: false, error: '残滓スロットが不正です' };
  }

  const character = await prisma.character.findFirst({ where: { id: characterId, userId: authorizedUser.id }, select: { id: true } });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  const residue = await prisma.abyssalResidue.findFirst({
    where: { id: residueId, characterId },
    select: { id: true, itemId: true },
  });
  if (!residue) return { success: false, error: '所有していない残滓です' };
  if (residue.itemId !== RESIDUE_SLOT_ORDER[slotIndex]) {
    return { success: false, error: 'この残滓は選択中のスロットに装備できません' };
  }

  const dbField = `equippedResidue${slotIndex}Id`;
  await prisma.character.update({
    where: { id: characterId },
    data: { [dbField]: residue.id } as Prisma.CharacterUpdateInput,
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}
