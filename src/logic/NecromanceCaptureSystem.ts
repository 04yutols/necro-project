import type { BaseStats, EnemyData, EnemyTier, MonsterData, StageData } from '../types/game';

export const NECROMANCE_RATE_BY_TIER: Record<EnemyTier, number> = {
  MINION: 0.12,
  ELITE: 0.04,
  BOSS: 0.001,
};

const NECROMANCE_COST_BY_TIER: Record<EnemyTier, number> = {
  MINION: 1,
  ELITE: 2,
  BOSS: 4,
};

export interface NecromanceRollResult {
  enemyId: string;
  rate: number;
  roll: number;
  monster: MonsterData;
}

export interface RollStageNecromanceInput {
  stage: Pick<StageData, 'waves'>;
  enemies: Record<string, EnemyData>;
  ownedMonsterMasterIds?: readonly (string | null | undefined)[];
  rng?: () => number;
  idFactory?: (enemyId: string) => string;
}

function secureUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (!getRandomValues) {
    throw new Error('Necromance monster IDs require Web Crypto API.');
  }

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createNecromancedMonsterId(enemyId: string): string {
  return `necro_${enemyId}_${secureUuid()}`;
}

export function getNecromanceRateForTier(tier: EnemyTier): number {
  return NECROMANCE_RATE_BY_TIER[tier] ?? 0;
}

function clampRate(rate: number): number {
  return Math.max(0, Math.min(1, rate));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveAllyStats(enemy: EnemyData): BaseStats {
  return {
    ...enemy.stats,
    ...(enemy.necromance?.allyStats ?? {}),
  };
}

export function getNecromanceRateForEnemy(enemy: EnemyData): number {
  const customRate = enemy.necromance?.captureRate;
  return clampRate(isFiniteNumber(customRate) ? customRate : getNecromanceRateForTier(enemy.tier));
}

export function getNecromanceCostForEnemy(enemy: EnemyData): number {
  const customCost = enemy.necromance?.allyCost;
  if (isFiniteNumber(customCost) && customCost >= 1) {
    return Math.floor(customCost);
  }
  return NECROMANCE_COST_BY_TIER[enemy.tier] ?? 1;
}

export function getStageNecromanceCandidateEnemyIds(stage: Pick<StageData, 'waves'>): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const wave of stage.waves ?? []) {
    for (const enemyId of wave.enemyIds ?? []) {
      if (seen.has(enemyId)) continue;
      seen.add(enemyId);
      ids.push(enemyId);
    }
  }

  return ids;
}

export function createNecromancedMonster(enemy: EnemyData, idFactory: (enemyId: string) => string = createNecromancedMonsterId): MonsterData {
  return {
    id: idFactory(enemy.id),
    masterId: enemy.id,
    name: enemy.nameJa || enemy.name,
    tribe: enemy.tribe,
    cost: getNecromanceCostForEnemy(enemy),
    stats: resolveAllyStats(enemy),
    resistances: { ...enemy.resistances },
    skillIds: [...(enemy.necromance?.skillIds ?? [])],
    tier: enemy.tier,
    weaknesses: [...(enemy.weaknesses ?? [])],
  };
}

export function getOwnedMonsterMasterIds(monsters: readonly Pick<MonsterData, 'id' | 'masterId'>[]): string[] {
  return monsters
    .map((monster) => monster.masterId ?? monster.id)
    .filter((id): id is string => Boolean(id));
}

export function rollStageNecromance({
  stage,
  enemies,
  ownedMonsterMasterIds = [],
  rng = Math.random,
  idFactory = createNecromancedMonsterId,
}: RollStageNecromanceInput): NecromanceRollResult[] {
  const owned = new Set(ownedMonsterMasterIds.filter((id): id is string => Boolean(id)));
  const results: NecromanceRollResult[] = [];

  for (const enemyId of getStageNecromanceCandidateEnemyIds(stage)) {
    if (owned.has(enemyId)) continue;
    const enemy = enemies[enemyId];
    if (!enemy) continue;

    const rate = getNecromanceRateForEnemy(enemy);
    const roll = rng();
    if (roll >= rate) continue;

    const monster = createNecromancedMonster(enemy, idFactory);
    owned.add(enemyId);
    results.push({ enemyId, rate, roll, monster });
  }

  return results;
}
