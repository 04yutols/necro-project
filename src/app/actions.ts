'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { changePasswordForUser, createCredentialsUser } from '@/services/AuthService';
import { RewardService, StageDropResult } from '@/services/RewardService';
import { MasterDataService } from '@/services/MasterDataService';
import { RankingService, normalizeStageClearMetrics } from '@/services/RankingService';
import { createWorldEvent, publishWorldEvents } from '@/services/WorldEventService';
import {
  addPassiveBonusToSave,
  spendWeaponMaterialsInSave,
  updatePlayerSaveSnapshot as updatePlayerSaveBlob,
} from '@/services/PlayerSaveService';
import { calculateResidueScore, RESIDUE_SLOT_ORDER } from '@/logic/ResidueScore';
import { calculateEnergyState } from '@/logic/EnergySystem';
import { hydrateMonsterEnergy } from '@/logic/MonsterEnergySystem';
import { levelFromTotalExp } from '@/logic/ExperienceSystem';
import { getJobBaseStatsAtLevel } from '@/logic/JobGrowthSystem';
import { isAbyssalResidueUnlocked } from '@/logic/AbyssalResidueUnlockSystem';
import { isStageUnlocked } from '@/logic/DungeonSystem';
import { getJobUnlockStatus } from '@/logic/JobSystem';
import {
  calculateDismantleRewards,
  calculateReforgedWeapon,
  calculateWeaponBaseAttack,
  getNextReforgeTargetIlv,
  getRankUpCost,
  getReforgeCost,
  INITIAL_WEAPON_MATERIALS,
  type WeaponCost,
} from '@/logic/WeaponSystem';
import type {
  AbyssalResidueData,
  BaseStats,
  CharacterData,
  EnemyData,
  ElementType,
  EquipmentSlots,
  ItemData,
  JobData,
  MonsterData,
  NecroStatus,
  PassiveBonuses,
  ResidueMatData,
  Resistances,
  SoulShardData,
  SpiritCoreData,
  StageData,
  UserJobState,
  WeaponMaterialData,
  WeaponMaterialType,
  WeaponRarity,
} from '@/types/game';
import type { OnlineStageRecordSummary, StageResultMeta, WorldEventType, WorldLogEntry } from '@/types/online';
import { PLAYER_SAVE_SCHEMA_VERSION, type PlayerSaveV1 } from '@/types/playerSave';
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

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return { success: false, error: 'ログインが必要です' };
  }
  return changePasswordForUser({
    userId: session.user.id,
    currentPassword,
    newPassword,
  });
}

export interface StageResultPayload {
  success:   boolean;
  dropResult: StageDropResult;
  expGain:   number;
  goldGain:  number;
  data?: ServerGameData;
  cloudSaved?: boolean;
  stageRecord?: OnlineStageRecordSummary;
  worldEvents?: WorldLogEntry[];
  error?:    string;
}

export type StageStartPayload =
  | { success: true; stageAttemptId: string; tokenId: string; expiresAt: string }
  | { success: false; error: string };

export type GrowthActionType = 'RANK_UP' | 'CHANGE_JOB';

export type SoulStoneActionResult =
  | { success: false; error: string }
  | { success: true; data: SoulShardData };

export type FetchPlayerActionResult =
  | { success: false; error: string }
  | { success: true; data: CharacterData };

function emptyDrop(): StageDropResult {
  return { weapons: [], consumables: [], residues: [], materials: [], weaponMaterials: [], monsters: [] };
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

const STAGE_ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

const CHARACTER_GAME_DATA_INCLUDE = {
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
  soulShards: true,
  equippedResidue0: true,
  equippedResidue1: true,
  equippedResidue2: true,
  equippedResidue3: true,
  equippedResidue4: true,
} satisfies Prisma.CharacterInclude;

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

function toWeaponMaterialData(row: {
  type: string;
  name: string;
  quantity: number;
}): WeaponMaterialData {
  return {
    type: row.type as WeaponMaterialType,
    name: row.name,
    quantity: row.quantity,
  };
}

const RESIDUE_MATERIAL_RARITIES = new Set<ResidueMatData['rarity']>(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);

function emptyPlayerSave(): PlayerSaveV1 {
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: 'アルド',
      currentJobId: 'warrior',
      gold: 50000,
      clearedStages: [],
      jobs: [{ jobId: 'warrior', level: 1, exp: 0 }],
      passives: {
        passiveAtkBonus: 0,
        passiveDefBonus: 0,
        passiveSpdBonus: 0,
        passiveCritRateBonus: 0,
        passiveCritDmgBonus: 0,
        passiveHpBonus: 0,
      },
      necroStatus: {
        level: 1,
        rank: 1,
        maxCost: 10,
        baseStatsBonus: 1,
        exp: 0,
      },
      equipmentIds: {
        weapon: null,
        sub: null,
        head: null,
        body: null,
        arms: null,
        legs: null,
        acc1: null,
        acc2: null,
      },
      partyMonsterIds: [null, null, null],
      equippedResidueIds: [null, null, null, null, null],
    },
    weaponMaterials: [],
    residueMaterials: [],
    transmutationPoints: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePositiveInt(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.floor(numberValue));
}

function normalizeResidueMaterial(value: unknown): ResidueMatData | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!RESIDUE_MATERIAL_RARITIES.has(value.rarity as ResidueMatData['rarity'])) return null;
  const quantity = normalizePositiveInt(value.quantity);
  if (quantity <= 0) return null;
  return {
    id: value.id,
    name: value.name,
    quantity,
    expValue: normalizePositiveInt(value.expValue),
    rarity: value.rarity as ResidueMatData['rarity'],
  };
}

function normalizeResidueMaterials(value: unknown): ResidueMatData[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, ResidueMatData>();
  for (const raw of value) {
    const material = normalizeResidueMaterial(raw);
    if (!material) continue;
    const existing = merged.get(material.id);
    if (existing) {
      existing.quantity += material.quantity;
      existing.name = material.name;
      existing.expValue = material.expValue;
      existing.rarity = material.rarity;
    } else {
      merged.set(material.id, { ...material });
    }
  }
  return Array.from(merged.values());
}

function mergeResidueMaterials(current: ResidueMatData[], additions: ResidueMatData[]): ResidueMatData[] {
  return normalizeResidueMaterials([...current, ...additions]);
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mergeStringArrays(...values: unknown[]): string[] {
  const merged = new Set<string>();
  for (const value of values) {
    for (const item of normalizeStringArray(value)) {
      merged.add(item);
    }
  }
  return Array.from(merged);
}

function getEffectiveClearedStages(character: { clearedStages?: unknown; playerState?: unknown }): string[] {
  return mergeStringArrays(
    character.clearedStages,
    readPlayerSave(character.playerState).player.clearedStages,
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeJobs(value: unknown, fallback: UserJobState[] = [{ jobId: 'warrior', level: 1, exp: 0 }]): UserJobState[] {
  if (!Array.isArray(value)) return fallback;
  const jobs = value
    .filter(isRecord)
    .map((job) => ({
      jobId: typeof job.jobId === 'string' ? job.jobId : '',
      level: Math.max(1, normalizePositiveInt(job.level, 1)),
      exp: normalizePositiveInt(job.exp),
    }))
    .filter((job) => job.jobId.length > 0);
  return jobs.length > 0 ? jobs : fallback;
}

function normalizePassives(value: unknown, fallback = emptyPlayerSave().player.passives): PassiveBonuses {
  const source = isRecord(value) ? value : {};
  return {
    passiveAtkBonus: normalizePositiveInt(source.passiveAtkBonus, fallback.passiveAtkBonus),
    passiveDefBonus: normalizePositiveInt(source.passiveDefBonus, fallback.passiveDefBonus),
    passiveSpdBonus: normalizePositiveInt(source.passiveSpdBonus, fallback.passiveSpdBonus),
    passiveCritRateBonus: Number.isFinite(Number(source.passiveCritRateBonus)) ? Number(source.passiveCritRateBonus) : fallback.passiveCritRateBonus,
    passiveCritDmgBonus: Number.isFinite(Number(source.passiveCritDmgBonus)) ? Number(source.passiveCritDmgBonus) : fallback.passiveCritDmgBonus,
    passiveHpBonus: normalizePositiveInt(source.passiveHpBonus, fallback.passiveHpBonus),
  };
}

function normalizeNecroStatus(value: unknown, fallback = emptyPlayerSave().player.necroStatus): NecroStatus {
  const source = isRecord(value) ? value : {};
  return {
    level: Math.max(1, normalizePositiveInt(source.level, fallback.level)),
    rank: Math.max(1, normalizePositiveInt(source.rank, fallback.rank)),
    maxCost: Math.max(1, normalizePositiveInt(source.maxCost, fallback.maxCost)),
    baseStatsBonus: Number.isFinite(Number(source.baseStatsBonus)) ? Number(source.baseStatsBonus) : fallback.baseStatsBonus,
    exp: normalizePositiveInt(source.exp, fallback.exp ?? 0),
  };
}

function normalizeWeaponMaterials(value: unknown): WeaponMaterialData[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, WeaponMaterialData>();
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.type !== 'string' || typeof raw.name !== 'string') continue;
    const quantity = normalizePositiveInt(raw.quantity);
    const existing = merged.get(raw.type);
    if (existing) {
      existing.quantity += quantity;
      existing.name = raw.name;
    } else {
      merged.set(raw.type, {
        type: raw.type as WeaponMaterialType,
        name: raw.name,
        quantity,
      });
    }
  }
  return Array.from(merged.values());
}

function normalizeEquipmentIds(value: unknown, fallback = emptyPlayerSave().player.equipmentIds): PlayerSaveV1['player']['equipmentIds'] {
  const source = isRecord(value) ? value : {};
  return {
    weapon: nullableString(source.weapon) ?? fallback.weapon,
    sub: nullableString(source.sub) ?? fallback.sub,
    head: nullableString(source.head) ?? fallback.head,
    body: nullableString(source.body) ?? fallback.body,
    arms: nullableString(source.arms) ?? fallback.arms,
    legs: nullableString(source.legs) ?? fallback.legs,
    acc1: nullableString(source.acc1) ?? fallback.acc1,
    acc2: nullableString(source.acc2) ?? fallback.acc2,
  };
}

function normalizeNullableTuple(value: unknown, length: 3, fallback: [string | null, string | null, string | null]): [string | null, string | null, string | null];
function normalizeNullableTuple(value: unknown, length: 5, fallback: [string | null, string | null, string | null, string | null, string | null]): [string | null, string | null, string | null, string | null, string | null];
function normalizeNullableTuple(value: unknown, length: number, fallback: (string | null)[]) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => nullableString(source[index]) ?? fallback[index] ?? null);
}

function readPlayerSave(playerState: unknown, fallback: PlayerSaveV1 = emptyPlayerSave()): PlayerSaveV1 {
  if (!isRecord(playerState) || playerState.schemaVersion !== PLAYER_SAVE_SCHEMA_VERSION) {
    return fallback;
  }
  const player = isRecord(playerState.player) ? playerState.player : {};
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: typeof player.name === 'string' ? player.name : fallback.player.name,
      currentJobId: typeof player.currentJobId === 'string' ? player.currentJobId : fallback.player.currentJobId,
      gold: normalizePositiveInt(player.gold, fallback.player.gold),
      clearedStages: Array.isArray(player.clearedStages)
        ? normalizeStringArray(player.clearedStages)
        : fallback.player.clearedStages,
      jobs: normalizeJobs(player.jobs, fallback.player.jobs),
      passives: normalizePassives(player.passives, fallback.player.passives),
      necroStatus: normalizeNecroStatus(player.necroStatus, fallback.player.necroStatus),
      equipmentIds: normalizeEquipmentIds(player.equipmentIds, fallback.player.equipmentIds),
      partyMonsterIds: normalizeNullableTuple(player.partyMonsterIds, 3, fallback.player.partyMonsterIds),
      equippedResidueIds: normalizeNullableTuple(player.equippedResidueIds, 5, fallback.player.equippedResidueIds),
    },
    weaponMaterials: Array.isArray(playerState.weaponMaterials)
      ? normalizeWeaponMaterials(playerState.weaponMaterials)
      : fallback.weaponMaterials,
    residueMaterials: Array.isArray(playerState.residueMaterials)
      ? normalizeResidueMaterials(playerState.residueMaterials)
      : fallback.residueMaterials,
    transmutationPoints: typeof playerState.transmutationPoints === 'number'
      ? normalizePositiveInt(playerState.transmutationPoints)
      : fallback.transmutationPoints,
  };
}

function playerSaveToJson(save: PlayerSaveV1): Prisma.InputJsonValue {
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: save.player.name,
      currentJobId: save.player.currentJobId,
      gold: normalizePositiveInt(save.player.gold),
      clearedStages: [...save.player.clearedStages],
      jobs: save.player.jobs.map((job) => ({
        jobId: job.jobId,
        level: job.level,
        exp: job.exp,
      })),
      passives: { ...save.player.passives },
      necroStatus: { ...save.player.necroStatus },
      equipmentIds: { ...save.player.equipmentIds },
      partyMonsterIds: [...save.player.partyMonsterIds],
      equippedResidueIds: [...save.player.equippedResidueIds],
    },
    weaponMaterials: save.weaponMaterials.map((material) => ({
      type: material.type,
      name: material.name,
      quantity: material.quantity,
    })),
    residueMaterials: save.residueMaterials.map((material) => ({
      id: material.id,
      name: material.name,
      quantity: material.quantity,
      expValue: material.expValue,
      rarity: material.rarity,
    })),
    transmutationPoints: normalizePositiveInt(save.transmutationPoints),
  };
}

async function lockCharacterForUpdate(tx: Prisma.TransactionClient, characterId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Character" WHERE id = ${characterId} FOR UPDATE
  `;
}

function buildPlayerSaveFromDb(
  character: any,
  weaponMaterials: unknown[] = [],
  previousSave: PlayerSaveV1 = readPlayerSave(character?.playerState),
): PlayerSaveV1 {
  const jobs = normalizeJobs((character.jobs ?? []).map((job: any) => ({
    jobId: job.jobId,
    level: job.level,
    exp: job.exp,
  })), previousSave.player.jobs);
  const currentJobId = character.currentJobId ?? previousSave.player.currentJobId ?? jobs[0]?.jobId ?? 'warrior';

  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: character.name ?? previousSave.player.name,
      currentJobId,
      gold: normalizePositiveInt(character.gold, previousSave.player.gold),
      clearedStages: mergeStringArrays(character.clearedStages, previousSave.player.clearedStages),
      jobs,
      passives: {
        passiveAtkBonus: normalizePositiveInt(character.passiveAtkBonus),
        passiveDefBonus: normalizePositiveInt(character.passiveDefBonus),
        passiveSpdBonus: normalizePositiveInt(character.passiveSpdBonus),
        passiveCritRateBonus: Number(character.passiveCritRateBonus ?? 0),
        passiveCritDmgBonus: Number(character.passiveCritDmgBonus ?? 0),
        passiveHpBonus: normalizePositiveInt(character.passiveHpBonus),
      },
      necroStatus: {
        level: Math.max(1, normalizePositiveInt(character.necroLevel, previousSave.player.necroStatus.level)),
        rank: Math.max(1, normalizePositiveInt(character.necroRank, previousSave.player.necroStatus.rank)),
        maxCost: Math.max(1, normalizePositiveInt(character.necroMaxCost, previousSave.player.necroStatus.maxCost)),
        baseStatsBonus: Number.isFinite(Number(character.necroBaseStatsBonus))
          ? Number(character.necroBaseStatsBonus)
          : previousSave.player.necroStatus.baseStatsBonus,
        exp: normalizePositiveInt(character.necroExp, previousSave.player.necroStatus.exp ?? 0),
      },
      equipmentIds: {
        weapon: character.equipWeaponId ?? null,
        sub: character.equipSubId ?? null,
        head: character.equipHeadId ?? null,
        body: character.equipBodyId ?? null,
        arms: character.equipArmsId ?? null,
        legs: character.equipLegsId ?? null,
        acc1: character.equipAcc1Id ?? null,
        acc2: character.equipAcc2Id ?? null,
      },
      partyMonsterIds: [
        character.partySlot0Id ?? null,
        character.partySlot1Id ?? null,
        character.partySlot2Id ?? null,
      ],
      equippedResidueIds: [
        character.equippedResidue0Id ?? null,
        character.equippedResidue1Id ?? null,
        character.equippedResidue2Id ?? null,
        character.equippedResidue3Id ?? null,
        character.equippedResidue4Id ?? null,
      ],
    },
    weaponMaterials: normalizeWeaponMaterials(weaponMaterials),
    residueMaterials: previousSave.residueMaterials,
    transmutationPoints: previousSave.transmutationPoints,
  };
}

function hasCompletePlayerSave(playerState: unknown): boolean {
  return isRecord(playerState)
    && playerState.schemaVersion === PLAYER_SAVE_SCHEMA_VERSION
    && isRecord(playerState.player)
    && Array.isArray(playerState.player.clearedStages)
    && Array.isArray(playerState.player.jobs)
    && isRecord(playerState.player.necroStatus)
    && isRecord(playerState.player.passives)
    && isRecord(playerState.player.equipmentIds)
    && Array.isArray(playerState.player.partyMonsterIds)
    && Array.isArray(playerState.player.equippedResidueIds)
    && Array.isArray(playerState.weaponMaterials)
    && Array.isArray(playerState.residueMaterials)
    && typeof playerState.transmutationPoints === 'number';
}

async function syncPlayerStateSnapshot(
  tx: Prisma.TransactionClient,
  characterId: string,
  options: { residueMaterialAdditions?: ResidueMatData[] } = {},
): Promise<PlayerSaveV1> {
  return updatePlayerSaveBlob(tx, characterId, undefined, options);
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

function deriveSoulShardAbility(tribe: string): string | undefined {
  switch (tribe) {
    case 'UNDEAD': return 'REGENERATE_SOUL';
    case 'DEMON': return 'BANE_OF_LIGHT';
    case 'DRAGON': return 'ELEMENTAL_SURGE';
    case 'ORC': return 'IRON_HIDE';
    default: return undefined;
  }
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
  return hydrateMonsterEnergy({
    id: row.id,
    masterId: row.masterId ?? undefined,
    name: row.name,
    tribe: row.tribe,
    cost: row.cost,
    stats: toBaseStats(row),
    resistances: (row.resistances ?? {}) as Resistances,
    skillIds: Array.isArray(row.skillIds) ? row.skillIds.filter((id: unknown): id is string => typeof id === 'string') : [],
    equippedShardId: row.soulShardId ?? undefined,
    spiritCore: toSpiritCoreData(row.spiritCore),
    currentEnergy: row.currentEnergy ?? undefined,
    maxEnergy: row.maxEnergy ?? undefined,
  });
}

function getJobData(jobId: string): JobData {
  const mds = MasterDataService.getInstance();
  const job = mds.getJob(jobId) ?? mds.getJob('warrior');
  if (!job) throw new Error(`Job ${jobId} not found in master data`);
  return job;
}

function sumLevelBonuses(job: JobData | undefined, fromExclusive: number, toInclusive: number): Partial<PassiveBonuses> {
  const totals: Partial<PassiveBonuses> = {};
  if (!job?.levelBonuses || toInclusive <= fromExclusive) return totals;

  for (let level = fromExclusive + 1; level <= toInclusive; level += 1) {
    const bonus = job.levelBonuses[String(level)];
    if (!bonus) continue;
    (Object.keys(bonus) as (keyof PassiveBonuses)[]).forEach((key) => {
      totals[key] = (totals[key] ?? 0) + (bonus[key] ?? 0);
    });
  }

  return totals;
}

function hasPassiveBonus(bonus: Partial<PassiveBonuses>): boolean {
  return Object.values(bonus).some((value) => typeof value === 'number' && value !== 0);
}

function toServerUser(sessionUser: { id?: string; name?: string | null; email?: string | null }): ServerGameUser {
  return {
    id: sessionUser.id ?? '',
    name: sessionUser.name ?? null,
    email: sessionUser.email ?? null,
  };
}

function toServerGameData(character: any, inventoryItems: any[], inventoryMonsters: any[], weaponMaterials: any[] = []): ServerGameData {
  const dbPlayerSave = buildPlayerSaveFromDb(character, weaponMaterials);
  const hasPlayerSave = hasCompletePlayerSave(character.playerState);
  const playerSave = readPlayerSave(character.playerState, dbPlayerSave);
  const currentJobId = playerSave.player.currentJobId ?? 'warrior';
  const currentJob = getJobData(currentJobId);
  const jobs = playerSave.player.jobs;
  const currentJobLevel = Math.max(1, jobs.find((job: { jobId: string; level: number; exp: number }) => job.jobId === currentJobId)?.level ?? 1);
  const energyState = calculateEnergyState(currentJob, currentJobLevel);
  const baseStats = getJobBaseStatsAtLevel(currentJob, currentJobLevel, toBaseStats(character));
  const clearedStages = playerSave.player.clearedStages;
  const residueUnlocked = isAbyssalResidueUnlocked(clearedStages);
  const items = inventoryItems.map(toItemData);
  const itemById = new Map(items.map(item => [item.id, item]));
  const monsters = inventoryMonsters.map(toMonsterData);
  const monsterById = new Map(monsters.map(monster => [monster.id, monster]));
  const residues: AbyssalResidueData[] = (character.abyssalResidues ?? []).map(toResidueData);
  const residueById = new Map(residues.map(residue => [residue.id, residue]));
  const resolveEquipment = (slot: keyof PlayerSaveV1['player']['equipmentIds'], relationRow: unknown): ItemData | null => {
    if (hasPlayerSave) {
      const itemId = playerSave.player.equipmentIds[slot];
      return itemId ? itemById.get(itemId) ?? null : null;
    }
    return relationRow ? toItemData(relationRow as Parameters<typeof toItemData>[0]) : null;
  };
  const persistedEquippedResidueSlots = [
    toResidueSlot(character.equippedResidue0),
    toResidueSlot(character.equippedResidue1),
    toResidueSlot(character.equippedResidue2),
    toResidueSlot(character.equippedResidue3),
    toResidueSlot(character.equippedResidue4),
  ];
  const saveEquippedResidueSlots = playerSave.player.equippedResidueIds.map((residueId) =>
    residueId ? residueById.get(residueId) ?? null : null,
  ) as (AbyssalResidueData | null)[];
  const equippedResidueSlots = residueUnlocked
    ? (hasPlayerSave ? saveEquippedResidueSlots : persistedEquippedResidueSlots)
    : [null, null, null, null, null];
  const player: CharacterData = {
    id: character.id,
    name: playerSave.player.name,
    currentJobId,
    category: currentJob.category,
    baseStats,
    necroLevel: playerSave.player.necroStatus.level,
    necroBaseStatsBonus: playerSave.player.necroStatus.baseStatsBonus,
    stats: baseStats,
    passives: playerSave.player.passives,
    equipment: {
      ...EMPTY_EQUIPMENT,
      weapon: resolveEquipment('weapon', character.equipWeapon),
      sub: resolveEquipment('sub', character.equipSub),
      head: resolveEquipment('head', character.equipHead),
      body: resolveEquipment('body', character.equipBody),
      arms: resolveEquipment('arms', character.equipArms),
      legs: resolveEquipment('legs', character.equipLegs),
      acc1: resolveEquipment('acc1', character.equipAcc1),
      acc2: resolveEquipment('acc2', character.equipAcc2),
    },
    baseResistances: {},
    jobs,
    isAwakened: false,
    clearedStages,
    gold: playerSave.player.gold,
    currentEnergy: energyState.currentEnergy,
    maxEnergy: energyState.maxEnergy,
    elementDmgBoosts: {},
  };
  const soulShards = new Map<string, SoulShardData>();
  (character.soulShards ?? []).forEach((shard: any) => {
    soulShards.set(shard.id, toSoulShardData(shard));
  });
  inventoryMonsters.forEach((monster) => {
    if (monster.soulShard) soulShards.set(monster.soulShard.id, toSoulShardData(monster.soulShard));
  });
  const partyFromSave = playerSave.player.partyMonsterIds.map((monsterId) =>
    monsterId ? monsterById.get(monsterId) ?? null : null,
  ) as (MonsterData | null)[];

  return {
    player,
    necroStatus: playerSave.player.necroStatus satisfies NecroStatus,
    party: hasPlayerSave ? partyFromSave : [
      character.partySlot0 ? toMonsterData(character.partySlot0) : null,
      character.partySlot1 ? toMonsterData(character.partySlot1) : null,
      character.partySlot2 ? toMonsterData(character.partySlot2) : null,
    ],
    inventoryMonsters: monsters,
    soulShards: Array.from(soulShards.values()),
    inventoryItems: items,
    weaponMaterials: playerSave.weaponMaterials,
    residueMaterials: playerSave.residueMaterials,
    transmutationPoints: playerSave.transmutationPoints,
    abyssalResidues: residues,
    equippedResidueSlots,
  };
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

function stageResultFailure(error: string): StageResultPayload {
  return {
    success: false,
    dropResult: emptyDrop(),
    expGain: 0,
    goldGain: 0,
    cloudSaved: false,
    error,
  };
}

function getStageEnemyHpTotal(stage: StageData, enemies: Record<string, EnemyData>): number {
  return stage.waves.reduce((total, wave) => total + wave.enemyIds.reduce((waveTotal, enemyId) => {
    const enemy = enemies[enemyId];
    const revive = enemy?.gimmicks?.find((gimmick) => gimmick.effect === 'REVIVE');
    const reviveHp = revive && enemy
      ? Math.floor(enemy.stats.hp * Math.max(0, Number(revive.value ?? 0.5)))
      : 0;
    return waveTotal + (enemy?.stats.hp ?? 0) + reviveHp;
  }, 0), 0);
}

function getStageMetricCaps(stage: StageData, mds: MasterDataService) {
  const enemyHpTotal = getStageEnemyHpTotal(stage, mds.getAllEnemies());
  return {
    maxTurnCount: Math.max(30, stage.waveCount * 30),
    maxClearTimeSec: 60 * 60,
    maxTotalDamage: Math.max(1000, enemyHpTotal * 4),
  };
}

function readStageAttemptArgs(
  stageAttemptIdOrMeta: string | StageResultMeta | null | undefined,
  meta: StageResultMeta | undefined,
): { stageAttemptId: string | null; meta: StageResultMeta } {
  if (typeof stageAttemptIdOrMeta === 'string') {
    return { stageAttemptId: stageAttemptIdOrMeta, meta: meta ?? {} };
  }
  return { stageAttemptId: null, meta: stageAttemptIdOrMeta ?? meta ?? {} };
}

async function consumeStageAttempt(
  tx: Prisma.TransactionClient,
  stageAttemptId: string,
  input: { userId: string; characterId: string; stageId: string },
): Promise<string | null> {
  const now = new Date();
  const consumed = await tx.stageAttempt.updateMany({
    where: {
      id: stageAttemptId,
      userId: input.userId,
      characterId: input.characterId,
      stageId: input.stageId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });
  if (consumed.count === 1) return null;

  const attempt = await tx.stageAttempt.findUnique({
    where: { id: stageAttemptId },
    select: { userId: true, characterId: true, stageId: true, consumedAt: true, expiresAt: true },
  });
  if (!attempt) return 'INVALID_STAGE_ATTEMPT';
  if (attempt.userId !== input.userId) return 'TOKEN_USER_MISMATCH';
  if (attempt.characterId !== input.characterId) return 'TOKEN_CHARACTER_MISMATCH';
  if (attempt.stageId !== input.stageId) return 'TOKEN_STAGE_MISMATCH';
  if (attempt.consumedAt) return 'STAGE_ATTEMPT_CONSUMED';
  if (attempt.expiresAt <= now) return 'STAGE_ATTEMPT_EXPIRED';
  return 'INVALID_STAGE_ATTEMPT';
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

function rankUpErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Lv.99') || message.includes('99')) return 'ランクアップには死霊術Lv.99到達が必要です';
  if (message.includes('試練')) return 'ランクアップには試練のクリアが必要です';
  if (message.includes('Character') && message.includes('not found')) return 'キャラクターが見つかりません';
  return 'ランクアップに失敗しました';
}

function weaponEnhancementErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('キャラクター')) return 'キャラクターが見つかりません';
  if (message.includes('所有していない')) return '所有していない武器です';
  if (message.includes('装備中')) return '装備中の武器は分解できません';
  if (message.includes('素材')) return '武器強化素材が不足しています';
  if (message.includes('共鳴')) return 'これ以上共鳴できません';
  if (message.includes('ILv')) return 'これ以上打ち直しできません';
  if (message.includes('分解')) return 'この武器は分解できません';
  return '武器強化の保存に失敗しました';
}

async function getAuthorizedUser(userId: string): Promise<ServerGameUser | null> {
  const session = await auth().catch(() => null);
  if (session?.user?.id !== userId) return null;
  return toServerUser(session.user);
}

/**
 * ステージ開始時にサーバー側で解放状態を確認し、短命・単回消費の証跡を発行する。
 */
export async function startStageAction(stageId: string): Promise<StageStartPayload> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return { success: false, error: 'SESSION_EXPIRED' };
  }
  return startStageForUser(toServerUser(session.user), stageId);
}

export async function startStageForUser(user: ServerGameUser, stageId: string): Promise<StageStartPayload> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) {
    return { success: false, error: 'SESSION_EXPIRED' };
  }

  const mds = MasterDataService.getInstance();
  const normalizedStageId = resolveStageId(stageId);
  const stage = mds.getStage(normalizedStageId);
  if (!stage) return { success: false, error: 'STAGE_NOT_FOUND' };
  if (stage.nodeType === 'SAFE') return { success: false, error: 'STAGE_NOT_PLAYABLE' };

  const char = await prisma.character.findFirst({
    where: { userId: authorizedUser.id },
    select: { id: true, clearedStages: true, playerState: true },
  });
  if (!char) return { success: false, error: 'CHARACTER_NOT_FOUND' };
  const effectiveClearedStages = getEffectiveClearedStages(char);
  if (!isStageUnlocked(stage, effectiveClearedStages)) {
    return { success: false, error: 'STAGE_LOCKED' };
  }

  const expiresAt = new Date(Date.now() + STAGE_ATTEMPT_TTL_MS);
  const attempt = await prisma.stageAttempt.create({
    data: {
      userId: authorizedUser.id,
      characterId: char.id,
      stageId: normalizedStageId,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  return {
    success: true,
    stageAttemptId: attempt.id,
    tokenId: attempt.id,
    expiresAt: attempt.expiresAt.toISOString(),
  };
}

/**
 * ステージクリア後のリザルト処理。
 * ログイン済み時はサーバー側でドロップ抽選 + DB保存を行う。
 * Next.js 実行時にセッションがない場合は、クライアントで再ログインを促す。
 */
export async function processStageResultAction(
  stageId: string,
  stageAttemptIdOrMeta?: string | StageResultMeta | null,
  maybeMeta?: StageResultMeta,
): Promise<StageResultPayload> {
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
  const { stageAttemptId, meta } = readStageAttemptArgs(stageAttemptIdOrMeta, maybeMeta);
  return processStageResultForUser(toServerUser(session.user), stageId, stageAttemptId, meta);
}

export async function processStageResultForUser(
  user: ServerGameUser,
  stageId: string,
  stageAttemptIdOrMeta?: string | StageResultMeta | null,
  maybeMeta?: StageResultMeta,
): Promise<StageResultPayload> {
  const { stageAttemptId, meta } = readStageAttemptArgs(stageAttemptIdOrMeta, maybeMeta);
  if (!stageAttemptId) {
    return stageResultFailure('MISSING_STAGE_ATTEMPT');
  }

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
  const metricCaps = getStageMetricCaps(stage, mds);
  const normalizedMetrics = normalizeStageClearMetrics(meta, metricCaps);
  if (!normalizedMetrics.ok) {
    return stageResultFailure(normalizedMetrics.error);
  }
  const userId = authorizedUser.id;

  // Character 取得（userId で紐付け）
  const char = await prisma.character.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!char) {
    return { success: false, dropResult: emptyDrop(), expGain: 0, goldGain: 0, cloudSaved: false, error: 'CHARACTER_NOT_FOUND' };
  }

  const goldGain = stage.rewards.baseGold;
  let expGain = 0;
  let dropResult = emptyDrop();
  let bestResidueScore = 0;
  const playerName = getPlayerDisplayName(authorizedUser);

  // DB 保存（トランザクション）
  let transactionResult: { stageRecord: OnlineStageRecordSummary & { becameTopResidue?: boolean }; worldEvents: WorldLogEntry[] };
  try {
    transactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const worldEvents: WorldLogEntry[] = [];
    const stageAttemptError = await consumeStageAttempt(tx, stageAttemptId, {
      userId,
      characterId: char.id,
      stageId: normalizedStageId,
    });
    if (stageAttemptError) {
      throw new Error(stageAttemptError);
    }

    await lockCharacterForUpdate(tx, char.id);
    const lockedChar = await tx.character.findUnique({
      where: { id: char.id },
      include: { jobs: true },
    });
    if (!lockedChar) throw new Error('キャラクターが見つかりません');
    const lockedSave = readPlayerSave(lockedChar.playerState, buildPlayerSaveFromDb(lockedChar));
    const clearedStagesBeforeClear = lockedSave.player.clearedStages;

    const playerForExp: Parameters<RewardService['calculateExp']>[1] = {
      category:     'PHYSICAL',
      currentJobId: lockedSave.player.currentJobId ?? 'warrior',
      jobs:         lockedSave.player.jobs,
    } as any;
    expGain = svc.calculateExp(stage.rewards.baseExp, playerForExp);

    const ownedMonsterMasterIds = (await tx.monster.findMany({
      where: { characterId: char.id },
      select: { masterId: true, id: true },
    })).map(monster => monster.masterId ?? monster.id);

    dropResult = svc.processStageDropTable(stage, clearedStagesBeforeClear, 0, Math.random, ownedMonsterMasterIds);
    dropResult.monsters.push(...svc.processStageNecromance(
      stage,
      [...ownedMonsterMasterIds, ...dropResult.monsters.map(monster => monster.masterId ?? monster.id)],
    ));
    bestResidueScore = Math.max(0, ...dropResult.residues.map(residue => calculateResidueScore(residue)));

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

    for (const monster of dropResult.monsters) {
      await tx.monster.create({
        data: {
          id: monster.id,
          masterId: monster.masterId ?? monster.id,
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
          currentEnergy: monster.currentEnergy,
          maxEnergy: monster.maxEnergy,
          resistances: (monster.resistances ?? {}) as Prisma.InputJsonValue,
          skillIds: (monster.skillIds ?? []) as Prisma.InputJsonValue,
        },
      });
    }

    const nextClearedStages = clearedStagesBeforeClear.includes(normalizedStageId)
      ? clearedStagesBeforeClear
      : [...clearedStagesBeforeClear, normalizedStageId];
    await updatePlayerSaveBlob(tx, char.id, (save) => {
      const currentJobId = save.player.currentJobId || 'warrior';
      const jobs = save.player.jobs.map((job) => ({ ...job }));
      const jobIndex = jobs.findIndex((job) => job.jobId === currentJobId);
      if (jobIndex >= 0) {
        const currentJob = jobs[jobIndex];
        const newExp = currentJob.exp + expGain;
        const oldLevel = currentJob.level;
        const newLevel = levelFromTotalExp(newExp);
        jobs[jobIndex] = { ...currentJob, exp: newExp, level: newLevel };
        save.player.jobs = jobs;

        if (newLevel > oldLevel) {
          const passiveBonus = sumLevelBonuses(mds.getJob(currentJob.jobId), oldLevel, newLevel);
          if (hasPassiveBonus(passiveBonus)) {
            save = addPassiveBonusToSave(save, passiveBonus);
          }
        }
      }
      save.player.gold += goldGain;
      save.player.clearedStages = nextClearedStages;
      return save;
    }, {
      residueMaterialAdditions: dropResult.materials,
      weaponMaterialAdditions: dropResult.weaponMaterials,
    });

    const isBossStage = stage.nodeType === 'BOSS' || Boolean(stage.isAreaBoss);
    const isWorldFirstBossClear = isBossStage && !(await tx.stageRecord.findFirst({
      where: { stageId: normalizedStageId },
      select: { id: true },
    }));
    const stageRecord = await RankingService.recordStageClear(tx, {
      userId,
      stageId: normalizedStageId,
      turnCount: normalizedMetrics.turnCount,
      clearTimeSec: normalizedMetrics.clearTimeSec,
      totalDamage: normalizedMetrics.totalDamage,
      isBossStage,
      bestResidueScore,
      ...metricCaps,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message === 'INVALID_STAGE_ATTEMPT'
      || message === 'TOKEN_USER_MISMATCH'
      || message === 'TOKEN_CHARACTER_MISMATCH'
      || message === 'TOKEN_STAGE_MISMATCH'
      || message === 'STAGE_ATTEMPT_CONSUMED'
      || message === 'STAGE_ATTEMPT_EXPIRED'
      || message === 'INVALID_STAGE_RESULT_META'
    ) {
      return stageResultFailure(message);
    }
    throw error;
  }

  await RankingService.invalidate();
  await publishWorldEvents(transactionResult.worldEvents);
  const reloaded = await loadCharacterForUser(authorizedUser);
  const data = reloaded.success && reloaded.status === 'READY' ? reloaded.data : undefined;

  return {
    success: true,
    dropResult,
    expGain,
    goldGain,
    data,
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

  let character = await prisma.character.findFirst({
    where: { userId: authorizedUser.id },
    include: CHARACTER_GAME_DATA_INCLUDE,
  });
  if (!character) {
    return { success: true, status: 'NO_CHARACTER', user: authorizedUser };
  }
  const characterId = character.id;

  const [inventoryItems, inventoryMonsters, weaponMaterials] = await Promise.all([
    prisma.item.findMany({
      where: { ownerId: authorizedUser.id },
      orderBy: { id: 'desc' },
    }),
    prisma.monster.findMany({
      where: { characterId },
      include: { soulShard: true, spiritCore: true },
      orderBy: { id: 'asc' },
    }),
    prisma.weaponMaterial.findMany({
      where: { userId: authorizedUser.id },
      orderBy: { type: 'asc' },
    }),
  ]);

  if (!hasCompletePlayerSave(character.playerState)) {
    await prisma.$transaction(async (tx) => {
      await syncPlayerStateSnapshot(tx, characterId);
    });
    character = await prisma.character.findFirst({
      where: { userId: authorizedUser.id },
      include: CHARACTER_GAME_DATA_INCLUDE,
    });
    if (!character) {
      return { success: true, status: 'NO_CHARACTER', user: authorizedUser };
    }
  }

  return {
    success: true,
    status: 'READY',
    user: authorizedUser,
    data: toServerGameData(character, inventoryItems, inventoryMonsters, weaponMaterials),
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
    await prisma.$transaction(async (tx) => {
      await updatePlayerSaveBlob(tx, character.id, (save) => {
        const jobData = getJobData(jobId);
        const unlock = getJobUnlockStatus({ jobs: save.player.jobs } as CharacterData, jobData);
        if (!unlock.unlocked) throw new Error(`Job ${jobId} is locked`);
        if (!save.player.jobs.some((job) => job.jobId === jobId)) {
          save.player.jobs.push({ jobId, level: 1, exp: 0 });
        }
        save.player.currentJobId = jobId;
      });
    });
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
  const initialStats = getJobBaseStatsAtLevel(mds.getJob(jobId), 1);
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const starterWeapon = mds.getItem(getStarterWeaponId(jobId));
    const createdWeapon = starterWeapon
      ? await tx.item.create({ data: itemCreateDataFromMaster(starterWeapon, userId), select: { id: true } })
      : null;

    const initialSave = emptyPlayerSave();
    initialSave.player.name = trimmedName;
    initialSave.player.currentJobId = jobId;
    initialSave.player.jobs = [{ jobId, level: 1, exp: 0 }];
    initialSave.player.equipmentIds.weapon = createdWeapon?.id ?? null;
    initialSave.weaponMaterials = INITIAL_WEAPON_MATERIALS.map((material) => ({ ...material }));

    await tx.character.create({
      data: {
        name: trimmedName,
        userId,
        hp: initialStats.hp,
        atk: initialStats.atk,
        def: initialStats.def,
        spd: initialStats.spd,
        critRate: initialStats.critRate,
        critDmg: initialStats.critDmg,
        effectHit: initialStats.effectHit,
        effectRes: initialStats.effectRes,
        playerState: playerSaveToJson(initialSave),
      },
      select: { id: true },
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

export async function fetchPlayerAction(characterId: string): Promise<FetchPlayerActionResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return fetchPlayerForUser(toServerUser(session.user), characterId);
}

export async function fetchPlayerForUser(
  user: ServerGameUser,
  characterId: string,
): Promise<FetchPlayerActionResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    include: CHARACTER_GAME_DATA_INCLUDE,
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  const [inventoryItems, inventoryMonsters] = await Promise.all([
    prisma.item.findMany({
      where: { ownerId: authorizedUser.id },
      orderBy: { id: 'desc' },
    }),
    prisma.monster.findMany({
      where: { characterId: character.id },
      include: { soulShard: true, spiritCore: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  return {
    success: true,
    data: toServerGameData(character, inventoryItems, inventoryMonsters).player,
  };
}

export async function processGrowthAction(characterId: string, type: GrowthActionType): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return processGrowthForUser(toServerUser(session.user), characterId, type);
}

export async function processGrowthForUser(
  user: ServerGameUser,
  characterId: string,
  type: GrowthActionType,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    select: { id: true },
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  if (type === 'CHANGE_JOB') {
    return { success: false, error: '転職は changeJobAction(characterId, jobId) を使用してください' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await updatePlayerSaveBlob(tx, character.id, (save) => {
        const current = save.player.necroStatus;
        if (current.level < 99) throw new Error('ランクアップにはLv.99到達が必要です。');
        save.player.necroStatus = {
          level: 1,
          rank: Math.min(10, current.rank + 1),
          maxCost: current.maxCost + 5,
          baseStatsBonus: current.baseStatsBonus + 0.5,
          exp: 0,
        };
      });
    });
  } catch (error) {
    return { success: false, error: rankUpErrorMessage(error) };
  }

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function soulStoneAction(monsterId: string): Promise<SoulStoneActionResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return soulStoneForUser(toServerUser(session.user), monsterId);
}

export async function soulStoneForUser(
  user: ServerGameUser,
  monsterId: string,
): Promise<SoulStoneActionResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const monster = await prisma.monster.findFirst({
    where: { id: monsterId, character: { is: { userId: authorizedUser.id } } },
    select: {
      id: true,
      characterId: true,
      name: true,
      tribe: true,
      atk: true,
      effectHit: true,
    },
  });
  if (!monster?.characterId) return { success: false, error: '所有していない魔物です' };

  const soulShard = await prisma.$transaction(async (tx) => {
    const created = await tx.soulShard.create({
      data: {
        characterId: monster.characterId,
        originMonster: monster.name,
        atkBonus: Math.floor(monster.atk * 0.1),
        elementDmgBoost: Math.floor((monster.effectHit ?? 0) * 0.1),
        specialAbility: deriveSoulShardAbility(monster.tribe),
      },
    });
    await tx.monster.delete({ where: { id: monster.id } });
    await syncPlayerStateSnapshot(tx, monster.characterId!);
    return created;
  });

  return { success: true, data: toSoulShardData(soulShard) };
}

export async function updatePartyAction(characterId: string, monsterIds: (string | null)[]): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return updatePartyForUser(toServerUser(session.user), characterId, monsterIds);
}

export async function equipShardAction(monsterId: string, shardId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return equipShardForUser(toServerUser(session.user), monsterId, shardId);
}

export async function equipShardForUser(
  user: ServerGameUser,
  monsterId: string,
  shardId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  const monster = await prisma.monster.findFirst({
    where: { id: monsterId, character: { is: { userId: authorizedUser.id } } },
    select: { id: true, characterId: true },
  });
  if (!monster?.characterId) return { success: false, error: '所有していない魔物です' };

  const shard = await prisma.soulShard.findFirst({
    where: { id: shardId, characterId: monster.characterId },
    select: { id: true },
  });
  if (!shard) return { success: false, error: '所有していない魂片です' };

  await prisma.monster.update({
    where: { id: monster.id },
    data: { soulShardId: shard.id },
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
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

export async function rankUpWeaponAction(characterId: string, weaponId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return rankUpWeaponForUser(toServerUser(session.user), characterId, weaponId);
}

export async function reforgeWeaponAction(characterId: string, weaponId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return reforgeWeaponForUser(toServerUser(session.user), characterId, weaponId);
}

export async function dismantleWeaponAction(characterId: string, weaponId: string): Promise<SaveGameStateResult> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { success: false, error: 'ログインが必要です' };
  return dismantleWeaponForUser(toServerUser(session.user), characterId, weaponId);
}

async function spendWeaponMaterialsForUser(
  tx: Prisma.TransactionClient,
  characterId: string,
  costs: WeaponCost[],
) {
  await updatePlayerSaveBlob(tx, characterId, (save) => spendWeaponMaterialsInSave(save, costs));
}

async function findOwnedWeapon(
  tx: Prisma.TransactionClient,
  userId: string,
  weaponId: string,
) {
  const weapon = await tx.item.findFirst({
    where: { id: weaponId, ownerId: userId, type: 'WEAPON' },
  });
  if (!weapon) throw new Error('所有していない武器です');
  return weapon;
}

async function assertOwnedCharacter(
  tx: Prisma.TransactionClient,
  userId: string,
  characterId: string,
) {
  const character = await tx.character.findFirst({
    where: { id: characterId, userId },
    select: { id: true, equipWeaponId: true, playerState: true },
  });
  if (!character) throw new Error('キャラクターが見つかりません');
  return character;
}

export async function rankUpWeaponForUser(
  user: ServerGameUser,
  characterId: string,
  weaponId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  try {
    await prisma.$transaction(async (tx) => {
      const character = await assertOwnedCharacter(tx, authorizedUser.id, characterId);
      const weapon = await findOwnedWeapon(tx, authorizedUser.id, weaponId);
      const item = toItemData(weapon);
      const cost = getRankUpCost(item);
      if (!cost) throw new Error('これ以上共鳴できません');

      await spendWeaponMaterialsForUser(tx, character.id, [cost]);
      await tx.item.update({
        where: { id: weapon.id },
        data: { rank: (item.rank ?? 0) + 1 },
      });
      await syncPlayerStateSnapshot(tx, character.id);
    });
  } catch (error) {
    return { success: false, error: weaponEnhancementErrorMessage(error) };
  }

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function reforgeWeaponForUser(
  user: ServerGameUser,
  characterId: string,
  weaponId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  try {
    await prisma.$transaction(async (tx) => {
      const character = await assertOwnedCharacter(tx, authorizedUser.id, characterId);
      const weapon = await findOwnedWeapon(tx, authorizedUser.id, weaponId);
      const item = toItemData(weapon);
      const targetIlv = getNextReforgeTargetIlv(item);
      if (!targetIlv) throw new Error('これ以上ILvを上げられません');

      await spendWeaponMaterialsForUser(tx, character.id, getReforgeCost(item));
      const reforged = calculateReforgedWeapon(item, targetIlv);
      await tx.item.update({
        where: { id: weapon.id },
        data: {
          ilv: targetIlv,
          atk: calculateWeaponBaseAttack(reforged),
        },
      });
      await syncPlayerStateSnapshot(tx, character.id);
    });
  } catch (error) {
    return { success: false, error: weaponEnhancementErrorMessage(error) };
  }

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}

export async function dismantleWeaponForUser(
  user: ServerGameUser,
  characterId: string,
  weaponId: string,
): Promise<SaveGameStateResult> {
  const authorizedUser = await getAuthorizedUser(user.id);
  if (!authorizedUser) return { success: false, error: 'ログインが必要です' };

  try {
    await prisma.$transaction(async (tx) => {
      const character = await assertOwnedCharacter(tx, authorizedUser.id, characterId);
      const weapon = await findOwnedWeapon(tx, authorizedUser.id, weaponId);
      const equippedWeaponId = readPlayerSave(character.playerState).player.equipmentIds.weapon ?? character.equipWeaponId;
      if (equippedWeaponId === weapon.id) throw new Error('装備中の武器は分解できません');

      const rewards = calculateDismantleRewards(toItemData(weapon));
      if (rewards.length === 0) throw new Error('この武器は分解できません');
      await tx.item.delete({ where: { id: weapon.id } });
      await updatePlayerSaveBlob(tx, character.id, undefined, { weaponMaterialAdditions: rewards });
    });
  } catch (error) {
    return { success: false, error: weaponEnhancementErrorMessage(error) };
  }

  return toReadyResult(await loadCharacterForUser(authorizedUser));
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
    select: { id: true, necroMaxCost: true, playerState: true },
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
  const maxCost = hasCompletePlayerSave(character.playerState)
    ? readPlayerSave(character.playerState).player.necroStatus.maxCost
    : character.necroMaxCost;
  if (totalCost > maxCost) {
    return { success: false, error: '編成コストが上限を超えています' };
  }

  await prisma.$transaction(async (tx) => {
    await updatePlayerSaveBlob(tx, characterId, (save) => {
      save.player.partyMonsterIds = ids as PlayerSaveV1['player']['partyMonsterIds'];
    });
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

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    select: { id: true },
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };

  const item = await prisma.item.findFirst({
    where: { id: itemId, ownerId: authorizedUser.id },
    select: { id: true, type: true },
  });
  if (!item) return { success: false, error: '所有していない装備です' };
  if (item.type !== expectedType) return { success: false, error: 'このスロットには装備できません' };

  await prisma.$transaction(async (tx) => {
    await updatePlayerSaveBlob(tx, characterId, (save) => {
      save.player.equipmentIds[typedSlot as keyof PlayerSaveV1['player']['equipmentIds']] = item.id;
    });
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

  await prisma.$transaction(async (tx) => {
    await updatePlayerSaveBlob(tx, characterId, (save) => {
      save.player.equipmentIds[typedSlot as keyof PlayerSaveV1['player']['equipmentIds']] = null;
    });
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

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: authorizedUser.id },
    select: { id: true, clearedStages: true, playerState: true },
  });
  if (!character) return { success: false, error: 'キャラクターが見つかりません' };
  if (!isAbyssalResidueUnlocked(getEffectiveClearedStages(character))) {
    return { success: false, error: '深淵の残滓は第2章到達後に解放されます' };
  }

  const residue = await prisma.abyssalResidue.findFirst({
    where: { id: residueId, characterId },
    select: { id: true, itemId: true },
  });
  if (!residue) return { success: false, error: '所有していない残滓です' };
  if (residue.itemId !== RESIDUE_SLOT_ORDER[slotIndex]) {
    return { success: false, error: 'この残滓は選択中のスロットに装備できません' };
  }

  await prisma.$transaction(async (tx) => {
    await updatePlayerSaveBlob(tx, characterId, (save) => {
      const slots = [...save.player.equippedResidueIds] as PlayerSaveV1['player']['equippedResidueIds'];
      slots[slotIndex] = residue.id;
      save.player.equippedResidueIds = slots;
    });
  });

  return toReadyResult(await loadCharacterForUser(authorizedUser));
}
