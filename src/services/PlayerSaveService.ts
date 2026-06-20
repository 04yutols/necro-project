import { Prisma } from '@prisma/client';
import type {
  BaseStats,
  CharacterData,
  EquipmentSlots,
  JobData,
  NecroStatus,
  PassiveBonuses,
  ResidueMatData,
  Resistances,
  UserJobState,
  WeaponMaterialData,
  WeaponMaterialType,
} from '../types/game';
import {
  MIN_SUPPORTED_PLAYER_SAVE_SCHEMA_VERSION,
  PLAYER_SAVE_SCHEMA_VERSION,
  type PlayerSaveV1,
} from '../types/playerSave';
import { MasterDataService } from './MasterDataService';
import { calculateEnergyState } from '../logic/EnergySystem';
import { getJobBaseStatsAtLevel } from '../logic/JobGrowthSystem';
import { levelFromTotalExp } from '../logic/ExperienceSystem';
import { getJobUnlockStatus } from '../logic/JobSystem';

const EMPTY_EQUIPMENT_IDS: PlayerSaveV1['player']['equipmentIds'] = {
  weapon: null,
  sub: null,
  head: null,
  body: null,
  arms: null,
  legs: null,
  acc1: null,
  acc2: null,
};

export function emptyPlayerSave(): PlayerSaveV1 {
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
      equipmentIds: { ...EMPTY_EQUIPMENT_IDS },
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

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function mergeStringArrays(...values: unknown[]): string[] {
  const merged = new Set<string>();
  for (const value of values) {
    for (const item of normalizeStringArray(value)) {
      merged.add(item);
    }
  }
  return Array.from(merged);
}

export function getEffectiveClearedStages(character: { clearedStages?: unknown; playerState?: unknown }): string[] {
  return mergeStringArrays(
    character.clearedStages,
    readPlayerSave(character.playerState).player.clearedStages,
  );
}

export function normalizeJobs(
  value: unknown,
  fallback: UserJobState[] = [{ jobId: 'warrior', level: 1, exp: 0 }],
): UserJobState[] {
  if (!Array.isArray(value)) return fallback.map((job) => ({ ...job }));
  const jobs = value
    .filter(isRecord)
    .map((job) => ({
      jobId: typeof job.jobId === 'string' ? job.jobId : '',
      level: Math.max(1, normalizePositiveInt(job.level, 1)),
      exp: normalizePositiveInt(job.exp),
    }))
    .filter((job) => job.jobId.length > 0);
  return jobs.length > 0 ? jobs : fallback.map((job) => ({ ...job }));
}

export function normalizePassives(
  value: unknown,
  fallback: PassiveBonuses = emptyPlayerSave().player.passives,
): PassiveBonuses {
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

export function normalizeNecroStatus(
  value: unknown,
  fallback: NecroStatus = emptyPlayerSave().player.necroStatus,
): NecroStatus {
  const source = isRecord(value) ? value : {};
  return {
    level: Math.max(1, normalizePositiveInt(source.level, fallback.level)),
    rank: Math.max(1, normalizePositiveInt(source.rank, fallback.rank)),
    maxCost: Math.max(1, normalizePositiveInt(source.maxCost, fallback.maxCost)),
    baseStatsBonus: Number.isFinite(Number(source.baseStatsBonus)) ? Number(source.baseStatsBonus) : fallback.baseStatsBonus,
    exp: normalizePositiveInt(source.exp, fallback.exp ?? 0),
  };
}

export function normalizeWeaponMaterials(value: unknown): WeaponMaterialData[] {
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

const RESIDUE_MATERIAL_RARITIES = new Set<ResidueMatData['rarity']>(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);

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

export function normalizeResidueMaterials(value: unknown): ResidueMatData[] {
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

export function mergeWeaponMaterials(
  current: WeaponMaterialData[],
  additions: { type: WeaponMaterialType; name: string; quantity: number }[],
): WeaponMaterialData[] {
  return normalizeWeaponMaterials([...current, ...additions]);
}

export function mergeResidueMaterials(current: ResidueMatData[], additions: ResidueMatData[]): ResidueMatData[] {
  return normalizeResidueMaterials([...current, ...additions]);
}

function normalizeEquipmentIds(
  value: unknown,
  fallback: PlayerSaveV1['player']['equipmentIds'] = EMPTY_EQUIPMENT_IDS,
): PlayerSaveV1['player']['equipmentIds'] {
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

export class PlayerSaveSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerSaveSchemaError';
  }
}

type RawPlayerSaveState = Record<string, unknown>;
type PlayerSaveMigration = (state: RawPlayerSaveState) => RawPlayerSaveState;

const PLAYER_SAVE_MIGRATIONS: Record<number, PlayerSaveMigration> = {
  1: (state) => ({
    ...state,
    schemaVersion: 2,
  }),
};

function readSchemaVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value;
}

export function migratePlayerSaveSchema(playerState: unknown): RawPlayerSaveState {
  if (!isRecord(playerState)) {
    throw new PlayerSaveSchemaError('playerState is missing or malformed');
  }

  let version = readSchemaVersion(playerState.schemaVersion);
  if (version === null) {
    throw new PlayerSaveSchemaError('playerState.schemaVersion is missing or malformed');
  }
  if (version < MIN_SUPPORTED_PLAYER_SAVE_SCHEMA_VERSION) {
    throw new PlayerSaveSchemaError(`Unsupported playerState schemaVersion: ${version}`);
  }
  if (version > PLAYER_SAVE_SCHEMA_VERSION) {
    throw new PlayerSaveSchemaError(`Future playerState schemaVersion is not supported: ${version}`);
  }

  let migrated: RawPlayerSaveState = { ...playerState };
  while (version < PLAYER_SAVE_SCHEMA_VERSION) {
    const migrate = PLAYER_SAVE_MIGRATIONS[version];
    if (!migrate) {
      throw new PlayerSaveSchemaError(`No migration registered for playerState schemaVersion: ${version}`);
    }
    migrated = migrate(migrated);
    const nextVersion = readSchemaVersion(migrated.schemaVersion);
    if (nextVersion === null || nextVersion <= version) {
      throw new PlayerSaveSchemaError(`Invalid migration result for playerState schemaVersion: ${version}`);
    }
    version = nextVersion;
  }

  return migrated;
}

export function readPlayerSave(playerState: unknown, fallback: PlayerSaveV1 = emptyPlayerSave()): PlayerSaveV1 {
  const migrated = migratePlayerSaveSchema(playerState);
  const player = isRecord(migrated.player) ? migrated.player : {};
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: typeof player.name === 'string' ? player.name : fallback.player.name,
      currentJobId: typeof player.currentJobId === 'string' ? player.currentJobId : fallback.player.currentJobId,
      gold: normalizePositiveInt(player.gold, fallback.player.gold),
      clearedStages: Array.isArray(player.clearedStages)
        ? normalizeStringArray(player.clearedStages)
        : [...fallback.player.clearedStages],
      jobs: normalizeJobs(player.jobs, fallback.player.jobs),
      passives: normalizePassives(player.passives, fallback.player.passives),
      necroStatus: normalizeNecroStatus(player.necroStatus, fallback.player.necroStatus),
      equipmentIds: normalizeEquipmentIds(player.equipmentIds, fallback.player.equipmentIds),
      partyMonsterIds: normalizeNullableTuple(player.partyMonsterIds, 3, fallback.player.partyMonsterIds),
      equippedResidueIds: normalizeNullableTuple(player.equippedResidueIds, 5, fallback.player.equippedResidueIds),
    },
    weaponMaterials: Array.isArray(migrated.weaponMaterials)
      ? normalizeWeaponMaterials(migrated.weaponMaterials)
      : normalizeWeaponMaterials(fallback.weaponMaterials),
    residueMaterials: Array.isArray(migrated.residueMaterials)
      ? normalizeResidueMaterials(migrated.residueMaterials)
      : normalizeResidueMaterials(fallback.residueMaterials),
    transmutationPoints: typeof migrated.transmutationPoints === 'number'
      ? normalizePositiveInt(migrated.transmutationPoints)
      : fallback.transmutationPoints,
  };
}

export function clonePlayerSave(save: PlayerSaveV1): PlayerSaveV1 {
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: save.player.name,
      currentJobId: save.player.currentJobId,
      gold: save.player.gold,
      clearedStages: [...save.player.clearedStages],
      jobs: save.player.jobs.map((job) => ({ ...job })),
      passives: { ...save.player.passives },
      necroStatus: { ...save.player.necroStatus },
      equipmentIds: { ...save.player.equipmentIds },
      partyMonsterIds: [...save.player.partyMonsterIds],
      equippedResidueIds: [...save.player.equippedResidueIds],
    },
    weaponMaterials: save.weaponMaterials.map((material) => ({ ...material })),
    residueMaterials: save.residueMaterials.map((material) => ({ ...material })),
    transmutationPoints: save.transmutationPoints,
  };
}

export function playerSaveToJson(save: PlayerSaveV1): Prisma.InputJsonValue {
  return {
    schemaVersion: PLAYER_SAVE_SCHEMA_VERSION,
    player: {
      name: save.player.name,
      currentJobId: save.player.currentJobId,
      gold: normalizePositiveInt(save.player.gold),
      clearedStages: [...save.player.clearedStages],
      jobs: normalizeJobs(save.player.jobs).map((job) => ({
        jobId: job.jobId,
        level: job.level,
        exp: job.exp,
      })),
      passives: { ...normalizePassives(save.player.passives) },
      necroStatus: { ...normalizeNecroStatus(save.player.necroStatus) },
      equipmentIds: { ...normalizeEquipmentIds(save.player.equipmentIds) },
      partyMonsterIds: [...normalizeNullableTuple(save.player.partyMonsterIds, 3, [null, null, null])],
      equippedResidueIds: [...normalizeNullableTuple(save.player.equippedResidueIds, 5, [null, null, null, null, null])],
    },
    weaponMaterials: normalizeWeaponMaterials(save.weaponMaterials).map((material) => ({
      type: material.type,
      name: material.name,
      quantity: material.quantity,
    })),
    residueMaterials: normalizeResidueMaterials(save.residueMaterials).map((material) => ({
      id: material.id,
      name: material.name,
      quantity: material.quantity,
      expValue: material.expValue,
      rarity: material.rarity,
    })),
    transmutationPoints: normalizePositiveInt(save.transmutationPoints),
  };
}

export function hasCompletePlayerSave(playerState: unknown): boolean {
  try {
    const migrated = migratePlayerSaveSchema(playerState);
    return migrated.schemaVersion === PLAYER_SAVE_SCHEMA_VERSION
      && isRecord(migrated.player)
      && Array.isArray(migrated.player.clearedStages)
      && Array.isArray(migrated.player.jobs)
      && isRecord(migrated.player.necroStatus)
      && isRecord(migrated.player.passives)
      && isRecord(migrated.player.equipmentIds)
      && Array.isArray(migrated.player.partyMonsterIds)
      && Array.isArray(migrated.player.equippedResidueIds)
      && Array.isArray(migrated.weaponMaterials)
      && Array.isArray(migrated.residueMaterials)
      && typeof migrated.transmutationPoints === 'number';
  } catch {
    return false;
  }
}

export function toBaseStats(row: Partial<BaseStats> | null | undefined): BaseStats {
  return {
    hp: Number(row?.hp ?? 0),
    atk: Number(row?.atk ?? 0),
    def: Number(row?.def ?? 0),
    spd: Number(row?.spd ?? 0),
    critRate: Number(row?.critRate ?? 5),
    critDmg: Number(row?.critDmg ?? 150),
    effectHit: Number(row?.effectHit ?? 0),
    effectRes: Number(row?.effectRes ?? 0),
  };
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

type JobResolver = (jobId: string) => JobData | undefined;

export function setJobLevelInSave(
  save: PlayerSaveV1,
  jobId: string,
  newLevel: number,
  getJob: JobResolver,
): PlayerSaveV1 {
  const jobs = save.player.jobs.map((job) => ({ ...job }));
  const index = jobs.findIndex((job) => job.jobId === jobId);
  const oldLevel = index >= 0 ? jobs[index].level : 0;
  const level = Math.max(1, Math.floor(Number.isFinite(newLevel) ? newLevel : 1));

  if (index >= 0) {
    jobs[index] = { ...jobs[index], level };
  } else {
    jobs.push({ jobId, level, exp: 0 });
  }

  const nextSave: PlayerSaveV1 = {
    ...save,
    player: {
      ...save.player,
      jobs,
    },
  };
  const bonus = sumLevelBonuses(getJob(jobId), oldLevel, level);
  return hasPassiveBonus(bonus) ? addPassiveBonusToSave(nextSave, bonus) : nextSave;
}

export function applyJobExpGainToSave(
  save: PlayerSaveV1,
  expGain: number,
  getJob: JobResolver,
): PlayerSaveV1 {
  const currentJobId = save.player.currentJobId || 'warrior';
  const jobs = save.player.jobs.map((job) => ({ ...job }));
  const index = jobs.findIndex((job) => job.jobId === currentJobId);
  const currentJob = index >= 0 ? jobs[index] : { jobId: currentJobId, level: 1, exp: 0 };
  const newExp = currentJob.exp + normalizePositiveInt(expGain);
  const newLevel = levelFromTotalExp(newExp);

  if (index >= 0) {
    jobs[index] = { ...currentJob, exp: newExp, level: newLevel };
  } else {
    jobs.push({ ...currentJob, exp: newExp, level: newLevel });
  }

  let nextSave: PlayerSaveV1 = {
    ...save,
    player: {
      ...save.player,
      jobs,
    },
  };
  if (newLevel > currentJob.level) {
    const bonus = sumLevelBonuses(getJob(currentJobId), currentJob.level, newLevel);
    if (hasPassiveBonus(bonus)) {
      nextSave = addPassiveBonusToSave(nextSave, bonus);
    }
  }
  return nextSave;
}

export function changeJobInSave(
  save: PlayerSaveV1,
  character: any,
  nextJobId: string,
  jobData: JobData,
): PlayerSaveV1 {
  const unlock = getJobUnlockStatus(toCharacterDataForSave(character, save), jobData);
  if (!unlock.unlocked) throw new Error(`Job ${nextJobId} is locked`);

  const jobs = save.player.jobs.map((job) => ({ ...job }));
  if (!jobs.some((job) => job.jobId === nextJobId)) {
    jobs.push({ jobId: nextJobId, level: 1, exp: 0 });
  }

  return {
    ...save,
    player: {
      ...save.player,
      currentJobId: nextJobId,
      jobs,
    },
  };
}

export function rankUpNecroInSave(save: PlayerSaveV1): PlayerSaveV1 {
  const current = save.player.necroStatus;
  if (current.level < 99) throw new Error('ランクアップにはLv.99到達が必要です。');
  return {
    ...save,
    player: {
      ...save.player,
      necroStatus: {
        level: 1,
        rank: Math.min(10, current.rank + 1),
        maxCost: current.maxCost + 5,
        baseStatsBonus: current.baseStatsBonus + 0.5,
        exp: 0,
      },
    },
  };
}

export async function lockCharacterForUpdate(tx: Prisma.TransactionClient, characterId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Character" WHERE id = ${characterId} FOR UPDATE
  `;
}

type PlayerSaveUpdater = (
  save: PlayerSaveV1,
  context: { character: any },
) => PlayerSaveV1 | void;

export type PlayerSaveReferenceScope = 'equipment' | 'party' | 'residue';

const ALL_REFERENCE_SCOPES: PlayerSaveReferenceScope[] = ['equipment', 'party', 'residue'];

export interface UpdatePlayerSaveOptions {
  residueMaterialAdditions?: ResidueMatData[];
  weaponMaterialAdditions?: { type: WeaponMaterialType; name: string; quantity: number }[];
  cleanReferences?: boolean;
  cleanReferenceScopes?: PlayerSaveReferenceScope[];
}

export async function updatePlayerSaveSnapshot(
  tx: Prisma.TransactionClient,
  characterId: string,
  updater?: PlayerSaveUpdater,
  options: UpdatePlayerSaveOptions = {},
): Promise<PlayerSaveV1> {
  await lockCharacterForUpdate(tx, characterId);
  const character = await tx.character.findUnique({
    where: { id: characterId },
    select: { id: true, userId: true, playerState: true },
  });
  if (!character) throw new Error('キャラクターが見つかりません');

  let nextSave = readPlayerSave(character.playerState);

  if (options.weaponMaterialAdditions?.length) {
    nextSave = {
      ...nextSave,
      weaponMaterials: mergeWeaponMaterials(nextSave.weaponMaterials, options.weaponMaterialAdditions),
    };
  }
  if (options.residueMaterialAdditions?.length) {
    nextSave = {
      ...nextSave,
      residueMaterials: mergeResidueMaterials(nextSave.residueMaterials, options.residueMaterialAdditions),
    };
  }

  if (updater) {
    const draft = clonePlayerSave(nextSave);
    nextSave = updater(draft, { character }) ?? draft;
  }

  nextSave = options.cleanReferences === false
    ? normalizePlayerSave(nextSave)
    : await cleanPlayerSaveReferences(tx, character, nextSave, options.cleanReferenceScopes);

  await tx.character.update({
    where: { id: characterId },
    data: {
      playerState: playerSaveToJson(nextSave),
      saveVersion: PLAYER_SAVE_SCHEMA_VERSION,
    },
  });
  return nextSave;
}

export function normalizePlayerSave(save: PlayerSaveV1): PlayerSaveV1 {
  return readPlayerSave(playerSaveToJson(save));
}

async function cleanPlayerSaveReferences(
  tx: Prisma.TransactionClient,
  character: any,
  save: PlayerSaveV1,
  scopes: PlayerSaveReferenceScope[] = ALL_REFERENCE_SCOPES,
): Promise<PlayerSaveV1> {
  const normalized = normalizePlayerSave(save);
  const scopeSet = new Set(scopes);
  const [itemRows, monsterRows, residueRows] = await Promise.all([
    scopeSet.has('equipment') && character.userId
      ? tx.item.findMany({ where: { ownerId: character.userId }, select: { id: true } })
      : Promise.resolve(undefined),
    scopeSet.has('party')
      ? tx.monster.findMany({ where: { characterId: character.id }, select: { id: true } })
      : Promise.resolve(undefined),
    scopeSet.has('residue')
      ? tx.abyssalResidue.findMany({ where: { characterId: character.id }, select: { id: true } })
      : Promise.resolve(undefined),
  ]);
  return cleanPlayerSaveReferencesWithIds(normalized, {
    scopes,
    characterName: character.name,
    itemIds: itemRows?.map((row) => row.id),
    monsterIds: monsterRows?.map((row) => row.id),
    residueIds: residueRows?.map((row) => row.id),
  });
}

export interface PlayerSaveReferenceIds {
  itemIds?: Iterable<string>;
  monsterIds?: Iterable<string>;
  residueIds?: Iterable<string>;
  characterName?: string | null;
  scopes?: PlayerSaveReferenceScope[];
}

function toStringSet(ids: Iterable<string> | undefined): Set<string> {
  return new Set(ids ?? []);
}

export function cleanPlayerSaveReferencesWithIds(
  save: PlayerSaveV1,
  references: PlayerSaveReferenceIds,
): PlayerSaveV1 {
  const normalized = normalizePlayerSave(save);
  const scopeSet = new Set(references.scopes ?? ALL_REFERENCE_SCOPES);
  const itemIds = toStringSet(references.itemIds);
  const monsterIds = toStringSet(references.monsterIds);
  const residueIds = toStringSet(references.residueIds);
  const equipmentIds = scopeSet.has('equipment')
    ? Object.fromEntries(
        Object.entries(normalized.player.equipmentIds).map(([slot, itemId]) => [
          slot,
          itemId && itemIds.has(itemId) ? itemId : null,
        ]),
      ) as PlayerSaveV1['player']['equipmentIds']
    : { ...normalized.player.equipmentIds };
  const currentJobId = normalized.player.currentJobId || normalized.player.jobs[0]?.jobId || 'warrior';
  const jobs = normalizeJobs(normalized.player.jobs);
  if (!jobs.some((job) => job.jobId === currentJobId)) {
    jobs.push({ jobId: currentJobId, level: 1, exp: 0 });
  }

  return {
    ...normalized,
    player: {
      ...normalized.player,
      name: normalized.player.name || references.characterName || 'アルド',
      currentJobId,
      jobs,
      equipmentIds,
      partyMonsterIds: scopeSet.has('party')
        ? normalized.player.partyMonsterIds.map((monsterId) =>
            monsterId && monsterIds.has(monsterId) ? monsterId : null,
          ) as PlayerSaveV1['player']['partyMonsterIds']
        : [...normalized.player.partyMonsterIds] as PlayerSaveV1['player']['partyMonsterIds'],
      equippedResidueIds: scopeSet.has('residue')
        ? normalized.player.equippedResidueIds.map((residueId) =>
            residueId && residueIds.has(residueId) ? residueId : null,
          ) as PlayerSaveV1['player']['equippedResidueIds']
        : [...normalized.player.equippedResidueIds] as PlayerSaveV1['player']['equippedResidueIds'],
    },
  };
}

export function spendWeaponMaterialsInSave(
  save: PlayerSaveV1,
  costs: { type: WeaponMaterialType; quantity: number }[],
): PlayerSaveV1 {
  const byType = new Map(save.weaponMaterials.map((material) => [material.type, { ...material }]));
  for (const cost of costs) {
    const material = byType.get(cost.type);
    if (!material || material.quantity < cost.quantity) {
      throw new Error('武器強化素材が不足しています');
    }
    material.quantity -= cost.quantity;
    byType.set(cost.type, material);
  }
  return {
    ...save,
    weaponMaterials: Array.from(byType.values()),
  };
}

export function addPassiveBonusToSave(save: PlayerSaveV1, bonus: Partial<PassiveBonuses>): PlayerSaveV1 {
  return {
    ...save,
    player: {
      ...save.player,
      passives: {
        passiveAtkBonus: save.player.passives.passiveAtkBonus + (bonus.passiveAtkBonus ?? 0),
        passiveDefBonus: save.player.passives.passiveDefBonus + (bonus.passiveDefBonus ?? 0),
        passiveSpdBonus: save.player.passives.passiveSpdBonus + (bonus.passiveSpdBonus ?? 0),
        passiveCritRateBonus: save.player.passives.passiveCritRateBonus + (bonus.passiveCritRateBonus ?? 0),
        passiveCritDmgBonus: save.player.passives.passiveCritDmgBonus + (bonus.passiveCritDmgBonus ?? 0),
        passiveHpBonus: save.player.passives.passiveHpBonus + (bonus.passiveHpBonus ?? 0),
      },
    },
  };
}

export function toCharacterDataForSave(character: any, save: PlayerSaveV1): CharacterData {
  const masterData = MasterDataService.getInstance();
  const currentJobId = save.player.currentJobId || 'warrior';
  const currentJob = masterData.getJob(currentJobId) ?? masterData.getJob('warrior')!;
  const currentJobLevel = Math.max(1, save.player.jobs.find((job) => job.jobId === currentJobId)?.level ?? 1);
  const energyState = calculateEnergyState(currentJob, currentJobLevel);
  const baseStats = getJobBaseStatsAtLevel(currentJob, currentJobLevel);
  const equipment: EquipmentSlots = {
    weapon: null,
    sub: null,
    head: null,
    body: null,
    arms: null,
    legs: null,
    acc1: null,
    acc2: null,
  };

  return {
    id: character.id,
    name: save.player.name,
    currentJobId,
    category: currentJob.category,
    baseStats,
    necroLevel: save.player.necroStatus.level,
    necroBaseStatsBonus: save.player.necroStatus.baseStatsBonus,
    stats: baseStats,
    passives: save.player.passives,
    equipment,
    baseResistances: {} as Resistances,
    jobs: save.player.jobs,
    isAwakened: false,
    clearedStages: save.player.clearedStages,
    gold: save.player.gold,
    currentEnergy: energyState.currentEnergy,
    maxEnergy: energyState.maxEnergy,
    elementDmgBoosts: {},
  };
}
