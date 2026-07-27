import type {
  BaseStats,
  AbyssalResidueData,
  BattleLog,
  CharacterData,
  DropEntry,
  EnemyData,
  ItemData,
  MonsterData,
  SkillData,
  StageData,
} from '../types/game';
import { MasterDataService } from '../services/MasterDataService';
import { RewardService, type StageDropResult } from '../services/RewardService';
import { getStageDropTableForResidueUnlock } from './AbyssalResidueUnlockSystem';
import { BattleEngine } from './BattleEngine';
import { calculateEnergyState } from './EnergySystem';
import { BattleSession } from './BattleSession';
import { getJobBaseStatsAtLevel } from './JobGrowthSystem';
import { resolveUnlockedJobSkills } from './JobSystem';
import {
  applyNecroToMonster,
  calcNecroMaxCost,
  deriveNecroRank,
} from './NecroGrowthSystem';
import {
  getNecromanceRateForEnemy,
  getStageNecromanceCandidateEnemyIds,
} from './NecromanceCaptureSystem';
import { hydrateMonsterEnergy } from './MonsterEnergySystem';
import { createSeededRandom, deriveSeed } from './SeededRandom';
import { calculateCharacterStatProfile, type StatBreakdown } from './StatSystem';
import { getYomiFloorNumber } from './YomiFloors';

export const BOT_PROFILE_NAMES = ['starter', 'ch1_mid', 'ch1_end', 'endgame', 'yomi_entry', 'yomi_deep'] as const;
export const BOT_POLICY_NAMES = ['basic_only', 'skill_first', 'weakness_first'] as const;
export const BOT_JOB_IDS = ['warrior', 'mage', 'dark_priest', 'rogue'] as const;
export const BOT_STAGE_SUITE_NAMES = ['chapter1', 'yomi', 'all'] as const;

export type BotProfileName = typeof BOT_PROFILE_NAMES[number];
export type BotPolicyName = typeof BOT_POLICY_NAMES[number];
export type BotJobId = typeof BOT_JOB_IDS[number];
export type BotStageSuiteName = typeof BOT_STAGE_SUITE_NAMES[number];

export interface BotResidueSpec {
  mainStat: { type: string; value: number };
  subOptions?: Array<{ type: string; value: number }>;
}

export interface BotBuildOverrides {
  jobLevel?: number;
  necroLevel?: number;
  weaponId?: string;
  partyMonsterIds?: string[];
  residues?: BotResidueSpec[];
  statAdjustmentsPct?: Partial<Record<keyof BaseStats, number>>;
}

export const BOT_SIMULATION_LIMITS = {
  maxIterations: 500,
  maxSampleRuns: 20,
  minRounds: 1,
  maxRounds: 500,
} as const;

export interface BotSimulationScenario {
  stageId: string;
  profile: BotProfileName;
  policy: BotPolicyName;
  jobId?: BotJobId;
  iterations: number;
  seed: string | number;
  maxRounds?: number;
  firstClear?: boolean;
  sampleRuns?: number;
  build?: BotBuildOverrides;
}

export interface BotResolvedProfile {
  name: BotProfileName;
  jobId: BotJobId;
  jobLevel: number;
  necroLevel: number;
  weaponId: string;
  partyMonsterIds: string[];
  ownedMonsterMasterIds: string[];
  clearedStages: string[];
  residues: BotResidueSpec[];
  statAdjustmentsPct: Partial<Record<keyof BaseStats, number>>;
}

export interface BotRunResult {
  iteration: number;
  seed: string;
  outcome: 'VICTORY' | 'DEFEAT' | 'TIMEOUT';
  wavesCleared: number;
  totalWaves: number;
  rounds: number;
  actions: number;
  playerHp: number;
  playerMaxHp: number;
  remainingHpPct: number;
  alivePartyMembers: number;
  remainingPartyHpPct: number;
  damageDealt: number;
  damageTaken: number;
  criticalHits: number;
  weaknessHits: number;
  skillUses: number;
  demonActivations: number;
  demonUltimates: number;
  logs: string[];
}

export interface NumberDistribution {
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
}

export interface ConfidenceInterval {
  low: number;
  high: number;
}

export interface BotDifficultyReport {
  runs: number;
  wins: number;
  losses: number;
  timeouts: number;
  clearRate: number;
  clearRate95: ConfidenceInterval;
  rounds: NumberDistribution;
  actions: NumberDistribution;
  remainingHpPct: NumberDistribution;
  alivePartyMembers: NumberDistribution;
  remainingPartyHpPct: NumberDistribution;
  damageDealt: NumberDistribution;
  damageTaken: NumberDistribution;
  criticalHits: number;
  weaknessHits: number;
  skillUses: number;
  demonActivations: number;
  demonUltimates: number;
}

export interface BotDropObservation {
  key: string;
  configuredRate: number | null;
  eligibleRuns: number;
  hitRuns: number;
  dropCount: number;
  observedRate: number;
  observedRate95: ConfidenceInterval;
  configuredRateInside95: boolean | null;
}

export interface BotBatchReport {
  version: 1;
  generatedAt: string;
  scenario: Omit<BotSimulationScenario, 'jobId' | 'maxRounds' | 'firstClear' | 'sampleRuns'> & {
    jobId: BotJobId;
    maxRounds: number;
    firstClear: boolean;
    sampleRuns: number;
  };
  resolvedProfile: BotResolvedProfile;
  stage: Pick<StageData, 'id' | 'nameJa' | 'chapter' | 'difficulty' | 'waveCount'>;
  difficulty: BotDifficultyReport;
  series: {
    outcomes: BotRunResult['outcome'][];
    rounds: number[];
    actions: number[];
    remainingHpPct: number[];
    alivePartyMembers: number[];
    remainingPartyHpPct: number[];
    damageDealt: number[];
    damageTaken: number[];
  };
  drops: BotDropObservation[];
  samples: BotRunResult[];
  warnings: string[];
}

export interface BotSimulationCatalog {
  stages: Array<Pick<StageData, 'id' | 'nameJa' | 'chapter' | 'difficulty' | 'waveCount'>>;
  profiles: readonly BotProfileName[];
  policies: readonly BotPolicyName[];
  jobs: readonly BotJobId[];
  suites: Record<BotStageSuiteName, string[]>;
  yomiDepthBands: Record<string, string[]>;
  limits: typeof BOT_SIMULATION_LIMITS;
}

export interface BotSensitivityRequest {
  scenario: BotSimulationScenario;
  stats: Array<keyof BaseStats>;
  deltasPct: number[];
}

export interface BotSensitivityVariant {
  stat: keyof BaseStats;
  deltaPct: number;
  clearRate: number;
  clearRateDelta: number;
  roundsP95: number;
  roundsP95Delta: number;
  remainingHpPctMean: number;
  remainingHpPctMeanDelta: number;
}

export interface BotSensitivityReport {
  generatedAt: string;
  baseline: BotBatchReport;
  variants: BotSensitivityVariant[];
}

const PROFILE_SETTINGS: Record<BotProfileName, Pick<BotResolvedProfile, 'jobLevel' | 'necroLevel'>> = {
  starter: { jobLevel: 1, necroLevel: 1 },
  ch1_mid: { jobLevel: 8, necroLevel: 8 },
  ch1_end: { jobLevel: 15, necroLevel: 30 },
  endgame: { jobLevel: 50, necroLevel: 200 },
  yomi_entry: { jobLevel: 25, necroLevel: 60 },
  yomi_deep: { jobLevel: 50, necroLevel: 200 },
};

const STARTER_WEAPONS: Record<BotJobId, string> = {
  warrior: 'bone_cleaver',
  mage: 'apprentice_cinder_staff',
  dark_priest: 'mourning_bell_crozier',
  rogue: 'grave_thorn_dagger',
};

const PARTY_MONSTER_IDS = ['goblin', 'skeleton', 'zombie'] as const;

function cloneStats(stats: BaseStats): BaseStats {
  return { ...stats };
}

function cloneMonster(monster: MonsterData): MonsterData {
  return {
    ...monster,
    stats: cloneStats(monster.stats),
    resistances: { ...monster.resistances },
    skillIds: monster.skillIds ? [...monster.skillIds] : undefined,
    weaknesses: monster.weaknesses ? [...monster.weaknesses] : undefined,
    gimmicks: monster.gimmicks?.map(gimmick => ({ ...gimmick })),
    statusEffects: monster.statusEffects?.map(effect => ({
      ...effect,
      stacks: effect.stacks?.map(stack => ({ ...stack })),
    })),
  };
}

function allChapterOneStageIds(mds: MasterDataService): string[] {
  return Object.values(mds.getAllStages())
    .filter(stage => stage.chapter === 1 && !stage.id.startsWith('yomi_'))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(stage => stage.id);
}

function yomiStageIds(mds: MasterDataService, maxFloor = Number.POSITIVE_INFINITY): string[] {
  return Object.values(mds.getAllStages())
    .filter(stage => {
      const floor = getYomiFloorNumber(stage.id);
      return floor !== null && floor <= maxFloor;
    })
    .sort((a, b) => (getYomiFloorNumber(a.id) ?? 0) - (getYomiFloorNumber(b.id) ?? 0))
    .map(stage => stage.id);
}

function midChapterOneStageIds(mds: MasterDataService): string[] {
  return Object.values(mds.getAllStages())
    .filter(stage => stage.chapter === 1 && (stage.sortOrder ?? Number.POSITIVE_INFINITY) <= 140)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(stage => stage.id);
}

export function resolveBotProfile(
  profileName: BotProfileName,
  jobId: BotJobId = 'warrior',
  mds: MasterDataService = MasterDataService.getInstance(),
  build: BotBuildOverrides = {},
): BotResolvedProfile {
  const setting = PROFILE_SETTINGS[profileName];
  const weaponId = profileName === 'starter' || profileName === 'ch1_mid'
    ? STARTER_WEAPONS[jobId]
    : profileName === 'ch1_end'
      ? 'spirit_silver_saber'
      : 'grudge_manifest';
  const chapterOneClears = allChapterOneStageIds(mds);
  const clearedStages = profileName === 'starter'
    ? []
    : profileName === 'ch1_mid'
      ? midChapterOneStageIds(mds)
      : profileName === 'yomi_deep'
        ? [...chapterOneClears, ...yomiStageIds(mds, 15)]
        : chapterOneClears;
  const partyMonsterIds = build.partyMonsterIds ?? [...PARTY_MONSTER_IDS];
  const ownedMonsterMasterIds = new Set<string>(partyMonsterIds);
  for (const stageId of clearedStages) {
    const stage = mds.getStage(stageId);
    for (const entry of stage?.rewards.firstClearGuaranteed ?? []) {
      if (entry.type === 'MONSTER' && entry.monsterId) ownedMonsterMasterIds.add(entry.monsterId);
    }
  }

  return {
    name: profileName,
    jobId,
    jobLevel: build.jobLevel ?? setting.jobLevel,
    necroLevel: build.necroLevel ?? setting.necroLevel,
    weaponId: build.weaponId ?? weaponId,
    partyMonsterIds: [...partyMonsterIds],
    ownedMonsterMasterIds: [...ownedMonsterMasterIds],
    clearedStages,
    residues: (build.residues ?? []).map(residue => ({
      mainStat: { ...residue.mainStat },
      subOptions: residue.subOptions?.map(option => ({ ...option })),
    })),
    statAdjustmentsPct: { ...(build.statAdjustmentsPct ?? {}) },
  };
}

function buildCombatants(
  profile: BotResolvedProfile,
  mds: MasterDataService,
): { player: CharacterData; party: MonsterData[]; playerStatProfile: StatBreakdown } {
  const job = mds.getJob(profile.jobId);
  if (!job) throw new Error(`Unknown job: ${profile.jobId}`);
  const baseStats = getJobBaseStatsAtLevel(job, profile.jobLevel);
  const energy = calculateEnergyState(job, profile.jobLevel);
  const weapon = mds.getItem(profile.weaponId);
  if (!weapon) throw new Error(`Unknown weapon: ${profile.weaponId}`);

  const player: CharacterData = {
    id: `bot-player-${profile.name}-${profile.jobId}`,
    name: 'Botアルド',
    currentJobId: profile.jobId,
    category: job.category,
    baseStats: cloneStats(baseStats),
    stats: cloneStats(baseStats),
    passives: {
      passiveAtkBonus: 0,
      passiveDefBonus: 0,
      passiveSpdBonus: 0,
      passiveCritRateBonus: 0,
      passiveCritDmgBonus: 0,
      passiveHpBonus: 0,
    },
    equipment: {
      weapon: { ...weapon },
      sub: null,
      head: null,
      body: null,
      arms: null,
      legs: null,
      acc1: null,
      acc2: null,
    },
    baseResistances: {},
    jobs: [{ jobId: profile.jobId, level: profile.jobLevel, exp: 0 }],
    isAwakened: false,
    clearedStages: [...profile.clearedStages],
    gold: 0,
    currentEnergy: energy.currentEnergy,
    maxEnergy: energy.maxEnergy,
    elementDmgBoosts: {},
    necroLevel: profile.necroLevel,
    statusEffects: [],
  };

  const residues: AbyssalResidueData[] = profile.residues.map((residue, index) => ({
    id: `bot-residue-${index}`,
    name: `Bot残滓${index + 1}`,
    itemId: `bot-residue-${index}`,
    rarity: 'LEGENDARY',
    mainStat: { ...residue.mainStat },
    subOptions: residue.subOptions?.map(option => ({ ...option })) ?? [],
    level: 20,
    exp: 0,
    maxExp: 0,
  }));
  const baseProfile = calculateCharacterStatProfile(player, residues);
  const adjustedTotal = { ...baseProfile.total };
  for (const key of Object.keys(profile.statAdjustmentsPct) as Array<keyof BaseStats>) {
    const adjustment = profile.statAdjustmentsPct[key] ?? 0;
    adjustedTotal[key] = Math.max(
      key === 'def' || key === 'critRate' || key === 'critDmg' || key === 'effectHit' || key === 'effectRes' ? 0 : 1,
      Number((adjustedTotal[key] * (1 + adjustment / 100)).toFixed(1)),
    );
  }
  const playerStatProfile: StatBreakdown = { ...baseProfile, total: adjustedTotal };
  player.stats = { ...adjustedTotal };
  player.baseStats = { ...baseStats };
  player.elementDmgBoosts = { ...baseProfile.elementDmgBoosts };

  const necroConfig = mds.getNecroConfig();
  const party = profile.partyMonsterIds.map(id => {
    const master = mds.getMonster(id);
    if (!master) throw new Error(`Unknown monster: ${id}`);
    return hydrateMonsterEnergy(applyNecroToMonster(cloneMonster(master), profile.necroLevel, necroConfig));
  });

  return { player, party, playerStatProfile };
}

function enemyToRuntime(enemy: EnemyData, waveIndex: number, enemyIndex: number): MonsterData {
  return {
    id: `wave-${waveIndex}:${enemyIndex}:${enemy.id}`,
    masterId: enemy.id,
    name: enemy.nameJa || enemy.name,
    tribe: enemy.tribe,
    cost: 0,
    tier: enemy.tier,
    stats: cloneStats(enemy.stats),
    resistances: { ...enemy.resistances },
    currentEnergy: 0,
    maxEnergy: 1,
    weaknesses: [...enemy.weaknesses],
    shieldHp: enemy.shieldHp,
    maxShieldHp: enemy.maxShieldHp ?? enemy.shieldHp,
    shieldBroken: (enemy.shieldHp ?? 0) <= 0,
    gimmicks: enemy.gimmicks?.map(gimmick => ({ ...gimmick })),
    statusEffects: [],
  };
}

function currentHp(engine: BattleEngine, enemy: MonsterData): number {
  return engine.getEnemyCurrentHp(enemy.id) ?? enemy.stats.hp;
}

function aliveEnemies(engine: BattleEngine, enemies: MonsterData[]): MonsterData[] {
  return enemies.filter(enemy => currentHp(engine, enemy) > 0);
}

function mergeSummons(enemies: MonsterData[], engine: BattleEngine): MonsterData[] {
  const byId = new Map(enemies.map(enemy => [enemy.id, enemy]));
  for (const summon of engine.getSummonedEnemies()) byId.set(summon.id, summon);
  engine.consumePendingSummons();
  return [...byId.values()];
}

function pickTarget(engine: BattleEngine, enemies: MonsterData[]): MonsterData | null {
  return BattleSession.pickTarget(enemies, {
    isAlive: enemy => currentHp(engine, enemy) > 0,
    getTier: enemy => enemy.tier,
    getHp: enemy => currentHp(engine, enemy),
  });
}

function scoreSkill(skill: SkillData, target: MonsterData, enemyCount: number, weaknessFirst: boolean): number {
  const hitsWeakness = skill.element && skill.element !== 'NONE'
    && (target.weaknesses?.includes(skill.element) || (target.resistances[skill.element] ?? 0) < 0);
  const weaknessScore = weaknessFirst && hitsWeakness ? 10_000 : 0;
  const aoeScore = skill.targetType === 'ALL_ENEMIES' ? Math.max(1, enemyCount) : 1;
  return weaknessScore + skill.power * aoeScore - skill.mpCost * 0.001;
}

function pickPlayerSkill(
  player: CharacterData,
  target: MonsterData,
  enemyCount: number,
  policy: BotPolicyName,
  mds: MasterDataService,
): SkillData | null {
  if (policy === 'basic_only') return null;
  const job = mds.getJob(player.currentJobId);
  const jobLevel = player.jobs.find(state => state.jobId === player.currentJobId)?.level ?? 1;
  if (!job) return null;
  const weaknessFirst = policy === 'weakness_first';
  return resolveUnlockedJobSkills(job, jobLevel, mds.getAllSkills())
    .filter(skill => !skill.isUltimate && skill.type !== 'HEAL' && skill.mpCost <= player.currentEnergy)
    .sort((a, b) => scoreSkill(b, target, enemyCount, weaknessFirst) - scoreSkill(a, target, enemyCount, weaknessFirst))[0] ?? null;
}

function pickMonsterSkill(
  monster: MonsterData,
  target: MonsterData,
  enemyCount: number,
  policy: BotPolicyName,
  mds: MasterDataService,
): SkillData | null {
  if (policy === 'basic_only') return null;
  const weaknessFirst = policy === 'weakness_first';
  return (monster.skillIds ?? [])
    .map(id => mds.getSkill(id))
    .filter((skill): skill is SkillData => Boolean(skill))
    .filter(skill => !skill.isUltimate && skill.type !== 'HEAL' && skill.mpCost <= monster.currentEnergy)
    .sort((a, b) => scoreSkill(b, target, enemyCount, weaknessFirst) - scoreSkill(a, target, enemyCount, weaknessFirst))[0] ?? null;
}

function classifyLogs(logs: BattleLog[], enemyNames: Set<string>) {
  let damageDealt = 0;
  let damageTaken = 0;
  let criticalHits = 0;
  let weaknessHits = 0;
  let skillUses = 0;
  let demonUltimates = 0;

  for (const log of logs) {
    const damage = Math.max(0, log.damage ?? 0);
    if (enemyNames.has(log.targetName) && log.action !== 'ENEMY_ATTACK') damageDealt += damage;
    if (
      log.action === 'ENEMY_ATTACK'
      || log.action === 'DEMON_SELF_DAMAGE'
      || (log.action === 'AILMENT_TICK' && !enemyNames.has(log.targetName))
    ) damageTaken += damage;
    if (log.isCritical) criticalHits += 1;
    if (log.isWeakness) weaknessHits += 1;
    if (log.action === 'MAGIC_SKILL' || log.action === 'MONSTER_SKILL') skillUses += 1;
    if (log.action === 'DEMON_ULTIMATE') demonUltimates += 1;
  }

  return { damageDealt, damageTaken, criticalHits, weaknessHits, skillUses, demonUltimates };
}

export function runBotBattle(
  stage: StageData,
  resolvedProfile: BotResolvedProfile,
  policy: BotPolicyName,
  seed: string,
  iteration: number,
  maxRounds: number,
  mds: MasterDataService = MasterDataService.getInstance(),
): BotRunResult {
  const { player, party, playerStatProfile } = buildCombatants(resolvedProfile, mds);
  const rng = createSeededRandom(seed);
  const engine = new BattleEngine(
    player,
    party,
    stage.areaGimmick ?? 'NONE',
    { isDemonMode: false, gauge: 0, actionsRemaining: 0, ultimateUsed: false, form: null },
    undefined,
    rng,
    playerStatProfile,
  );
  let rounds = 0;
  let actions = 0;
  let wavesCleared = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let criticalHits = 0;
  let weaknessHits = 0;
  let skillUses = 0;
  let demonActivations = 0;
  let demonUltimates = 0;
  const logLines: string[] = [];

  const consumeLogs = (logs: BattleLog[], enemies: MonsterData[]) => {
    const stats = classifyLogs(logs, new Set(enemies.map(enemy => enemy.name)));
    damageDealt += stats.damageDealt;
    damageTaken += stats.damageTaken;
    criticalHits += stats.criticalHits;
    weaknessHits += stats.weaknessHits;
    skillUses += stats.skillUses;
    demonUltimates += stats.demonUltimates;
    for (const log of logs) {
      if (logLines.length < 120) logLines.push(`W${wavesCleared + 1}/T${rounds} ${log.description}`);
    }
  };

  let outcome: BotRunResult['outcome'] = 'TIMEOUT';

  const sessionWaves = BattleSession.buildWaves(stage, enemyId => mds.getEnemy(enemyId));
  waveLoop:
  for (let waveIndex = 0; waveIndex < sessionWaves.length; waveIndex += 1) {
    const wave = sessionWaves[waveIndex];
    engine.setEnemyStatScale(wave.statScale);
    let enemies = wave.enemies.map((enemy, enemyIndex) => enemyToRuntime(enemy, waveIndex, enemyIndex));

    while (rounds < maxRounds) {
      if (aliveEnemies(engine, enemies).length === 0) {
        wavesCleared += 1;
        continue waveLoop;
      }
      if (engine.getRuntimeSnapshot().playerHp <= 0) {
        outcome = 'DEFEAT';
        break waveLoop;
      }

      rounds += 1;
      let target = pickTarget(engine, enemies);
      if (!target) {
        wavesCleared += 1;
        continue waveLoop;
      }

      if (policy !== 'basic_only' && engine.getDemonGauge() >= 100 && engine.activateDemonMode()) {
        demonActivations += 1;
      }

      const demon = engine.getDemonRuntimeState();
      if (demon?.isDemonMode && !demon.ultimateUsed) {
        const logs = engine.simulateUltimateSkill(target);
        actions += 1;
        consumeLogs(logs, enemies);
      } else {
        const playerSkill = pickPlayerSkill(player, target, aliveEnemies(engine, enemies).length, policy, mds);
        const logs = engine.simulateAction(
          playerSkill ? 'MAGIC_SKILL' : 'PHYSICAL_ATTACK',
          target,
          playerSkill?.id,
          enemies,
        );
        actions += 1;
        consumeLogs(logs, enemies);
      }

      enemies = mergeSummons(enemies, engine);
      if (engine.getRuntimeSnapshot().playerHp <= 0) {
        outcome = 'DEFEAT';
        break waveLoop;
      }
      if (aliveEnemies(engine, enemies).length === 0) {
        wavesCleared += 1;
        continue waveLoop;
      }

      for (const monster of party) {
        if ((engine.getMonsterCurrentHp(monster.id) ?? monster.stats.hp) <= 0) continue;
        target = pickTarget(engine, enemies);
        if (!target) break;
        const monsterSkill = pickMonsterSkill(monster, target, aliveEnemies(engine, enemies).length, policy, mds);
        const logs = engine.simulateMonsterAction(monster.id, target, enemies, monsterSkill?.id);
        actions += 1;
        consumeLogs(logs, enemies);
        enemies = mergeSummons(enemies, engine);
        if (engine.getRuntimeSnapshot().playerHp <= 0) {
          outcome = 'DEFEAT';
          break waveLoop;
        }
        if (aliveEnemies(engine, enemies).length === 0) break;
      }

      if (aliveEnemies(engine, enemies).length === 0) {
        wavesCleared += 1;
        continue waveLoop;
      }
    }

    if (rounds >= maxRounds) break;
  }

  if (wavesCleared === stage.waves.length) outcome = 'VICTORY';
  const snapshot = engine.getRuntimeSnapshot();
  const partyHp = party.map(monster => Math.max(0, engine.getMonsterCurrentHp(monster.id) ?? monster.stats.hp));
  const partyMaxHp = party.reduce((sum, monster) => sum + monster.stats.hp, 0);
  const remainingPartyHp = partyHp.reduce((sum, hp) => sum + hp, 0);
  return {
    iteration,
    seed,
    outcome,
    wavesCleared,
    totalWaves: stage.waves.length,
    rounds,
    actions,
    playerHp: snapshot.playerHp,
    playerMaxHp: snapshot.playerMaxHp,
    remainingHpPct: snapshot.playerMaxHp > 0 ? (snapshot.playerHp / snapshot.playerMaxHp) * 100 : 0,
    alivePartyMembers: partyHp.filter(hp => hp > 0).length,
    remainingPartyHpPct: partyMaxHp > 0 ? (remainingPartyHp / partyMaxHp) * 100 : 0,
    damageDealt,
    damageTaken,
    criticalHits,
    weaknessHits,
    skillUses,
    demonActivations,
    demonUltimates,
    logs: logLines,
  };
}

export function wilsonInterval(successes: number, trials: number, z = 1.959963984540054): ConfidenceInterval {
  if (trials <= 0) return { low: 0, high: 0 };
  const n = Math.max(1, Math.floor(trials));
  const p = Math.max(0, Math.min(n, successes)) / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function distribution(values: number[]): NumberDistribution {
  if (values.length === 0) return { mean: 0, min: 0, max: 0, p50: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => sorted[Math.floor((sorted.length - 1) * q)];
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: quantile(0.5),
    p95: quantile(0.95),
  };
}

function configuredDropKey(entry: DropEntry): string {
  switch (entry.type) {
    case 'WEAPON': return `WEAPON:${entry.itemId ?? 'UNKNOWN'}:${entry.rarity ?? 'UNKNOWN'}`;
    case 'CONSUMABLE': return `CONSUMABLE:${entry.itemId ?? 'UNKNOWN'}`;
    case 'RESIDUE': return `RESIDUE:${entry.rarity ?? 'COMMON'}`;
    case 'MATERIAL': return `MATERIAL:${entry.itemId ?? 'UNKNOWN'}`;
    case 'WEAPON_MATERIAL': return `WEAPON_MATERIAL:${entry.weaponMaterialType ?? entry.itemId ?? 'UNKNOWN'}`;
    case 'MONSTER': return `MONSTER:${entry.monsterId ?? 'UNKNOWN'}`;
    default: return `UNKNOWN:${entry.itemId ?? entry.monsterId ?? 'UNKNOWN'}`;
  }
}

function addConfiguredRate(target: Map<string, number>, key: string, rate: number): void {
  const normalized = Math.max(0, Math.min(1, rate));
  const existing = target.get(key) ?? 0;
  target.set(key, 1 - (1 - existing) * (1 - normalized));
}

function ownedMonsterIdsForClearedStages(
  profile: BotResolvedProfile,
  clearedStages: string[],
  mds: MasterDataService,
): string[] {
  const owned = new Set(profile.partyMonsterIds);
  for (const stageId of clearedStages) {
    const clearedStage = mds.getStage(stageId);
    for (const entry of clearedStage?.rewards.firstClearGuaranteed ?? []) {
      if (entry.type === 'MONSTER' && entry.monsterId) owned.add(entry.monsterId);
    }
  }
  return [...owned];
}

function buildConfiguredRates(
  stage: StageData,
  clearedStages: string[],
  firstClear: boolean,
  profile: BotResolvedProfile,
  mds: MasterDataService,
): Map<string, number> {
  const rates = new Map<string, number>();
  const owned = new Set(ownedMonsterIdsForClearedStages(profile, clearedStages, mds));
  if (firstClear) {
    for (const entry of stage.rewards.firstClearGuaranteed ?? []) {
      addConfiguredRate(rates, configuredDropKey({ ...entry, rate: 1 }), 1);
      if (entry.type === 'MONSTER' && entry.monsterId) owned.add(entry.monsterId);
    }
  }
  for (const entry of getStageDropTableForResidueUnlock(stage, clearedStages)) {
    addConfiguredRate(rates, configuredDropKey(entry), entry.rate);
  }
  for (const enemyId of getStageNecromanceCandidateEnemyIds(stage)) {
    if (owned.has(enemyId)) continue;
    const enemy = mds.getEnemy(enemyId);
    if (!enemy) continue;
    rates.set(`NECROMANCE:${enemyId}`, getNecromanceRateForEnemy(enemy, deriveNecroRank(profile.necroLevel), mds.getNecroConfig()));
  }
  return rates;
}

function findMasterId(item: ItemData, allItems: Record<string, ItemData>): string {
  return Object.keys(allItems).find(id => item.id === id || item.id.startsWith(`${id}_`)) ?? item.id;
}

function countDropResult(result: StageDropResult, mds: MasterDataService): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (key: string, quantity = 1) => counts.set(key, (counts.get(key) ?? 0) + quantity);
  const allItems = mds.getAllItems();
  const allMaterials = mds.getAllMaterials();

  for (const item of result.weapons) {
    add(`WEAPON:${findMasterId(item, allItems)}:${item.weaponRarity ?? item.rarity ?? 'UNKNOWN'}`);
  }
  for (const item of result.consumables) add(`CONSUMABLE:${findMasterId(item, allItems)}`, item.quantity ?? 1);
  for (const residue of result.residues) add(`RESIDUE:${residue.rarity}`);
  for (const material of result.materials) {
    const id = Object.keys(allMaterials).find(candidate => material.id === candidate || material.id.startsWith(`${candidate}_`)) ?? material.id;
    add(`MATERIAL:${id}`, material.quantity ?? 1);
  }
  for (const material of result.weaponMaterials) add(`WEAPON_MATERIAL:${material.type}`, material.quantity);
  for (const monster of result.monsters) add(`MONSTER:${monster.masterId ?? monster.id}`);
  return counts;
}

function rollRewards(
  stage: StageData,
  profile: BotResolvedProfile,
  firstClear: boolean,
  seed: string,
  mds: MasterDataService,
): Map<string, number> {
  const rng = createSeededRandom(seed);
  const rewardService = new RewardService();
  const clearedStages = firstClear
    ? profile.clearedStages.filter(id => id !== stage.id)
    : Array.from(new Set([...profile.clearedStages, stage.id]));
  const ownedBeforeRun = ownedMonsterIdsForClearedStages(profile, clearedStages, mds);
  const drops = rewardService.processStageDropTable(stage, clearedStages, 0, rng, ownedBeforeRun);
  const ownedAfterDrops = [
    ...ownedBeforeRun,
    ...drops.monsters.map(monster => monster.masterId ?? monster.id),
  ];
  const captures = rewardService.processStageNecromance(stage, ownedAfterDrops, deriveNecroRank(profile.necroLevel), rng);
  const counts = countDropResult(drops, mds);
  for (const monster of captures) {
    const key = `NECROMANCE:${monster.masterId ?? monster.id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function getBotSimulationCatalog(
  mds: MasterDataService = MasterDataService.getInstance(),
): BotSimulationCatalog {
  const stages = Object.values(mds.getAllStages())
    .filter(stage => stage.nodeType !== 'SAFE' && stage.waves.length > 0)
    .sort((a, b) => (a.sortOrder ?? Number.POSITIVE_INFINITY) - (b.sortOrder ?? Number.POSITIVE_INFINITY))
    .map(({ id, nameJa, chapter, difficulty, waveCount }) => ({ id, nameJa, chapter, difficulty, waveCount }));
  const playableIds = new Set(stages.map(stage => stage.id));
  const yomi = yomiStageIds(mds).filter(id => playableIds.has(id));
  const chapter1 = allChapterOneStageIds(mds).filter(id => playableIds.has(id));
  const depthBand = (from: number, to: number) => yomi.filter(id => {
    const floor = getYomiFloorNumber(id) ?? 0;
    return floor >= from && floor <= to;
  });
  return {
    stages,
    profiles: BOT_PROFILE_NAMES,
    policies: BOT_POLICY_NAMES,
    jobs: BOT_JOB_IDS,
    suites: {
      chapter1,
      yomi,
      all: stages.map(stage => stage.id),
    },
    yomiDepthBands: {
      'B1-B5': depthBand(1, 5),
      'B6-B10': depthBand(6, 10),
      'B11-B15': depthBand(11, 15),
      'B16-B20': depthBand(16, 20),
    },
    limits: BOT_SIMULATION_LIMITS,
  };
}

const BUILD_STAT_KEYS: Array<keyof BaseStats> = [
  'hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes',
];

function validateBotBuild(build: BotBuildOverrides | undefined, mds: MasterDataService, profileName: BotProfileName): string[] {
  if (build === undefined) return [];
  if (!build || typeof build !== 'object' || Array.isArray(build)) return ['build must be an object.'];
  const errors: string[] = [];
  if (build.jobLevel !== undefined && (!Number.isInteger(build.jobLevel) || build.jobLevel < 1 || build.jobLevel > 99)) {
    errors.push('build.jobLevel must be an integer between 1 and 99.');
  }
  if (build.necroLevel !== undefined && (!Number.isInteger(build.necroLevel) || build.necroLevel < 1 || build.necroLevel > 500)) {
    errors.push('build.necroLevel must be an integer between 1 and 500.');
  }
  if (build.weaponId !== undefined && mds.getItem(build.weaponId)?.type !== 'WEAPON') errors.push('build.weaponId is invalid.');
  if (build.partyMonsterIds !== undefined) {
    if (!Array.isArray(build.partyMonsterIds) || build.partyMonsterIds.length < 1 || build.partyMonsterIds.length > 3) {
      errors.push('build.partyMonsterIds must contain between 1 and 3 monsters.');
    } else {
      if (new Set(build.partyMonsterIds).size !== build.partyMonsterIds.length) errors.push('build.partyMonsterIds must be unique.');
      const monsters = build.partyMonsterIds.map(id => mds.getMonster(id));
      if (monsters.some(monster => !monster)) errors.push('build.partyMonsterIds contains an unknown monster.');
      const necroLevel = build.necroLevel ?? PROFILE_SETTINGS[profileName]?.necroLevel ?? 1;
      const totalCost = monsters.reduce((sum, monster) => sum + (monster?.cost ?? 0), 0);
      if (totalCost > calcNecroMaxCost(necroLevel, mds.getNecroConfig())) {
        errors.push(`build.partyMonsterIds exceeds the necro cost limit (${totalCost}).`);
      }
    }
  }
  if (build.residues !== undefined) {
    if (!Array.isArray(build.residues) || build.residues.length > 5) {
      errors.push('build.residues must contain at most 5 residues.');
    } else {
      build.residues.forEach((residue, index) => {
        const options = [residue?.mainStat, ...(residue?.subOptions ?? [])];
        if (!residue?.mainStat || options.some(option => !option || typeof option.type !== 'string' || !Number.isFinite(option.value))) {
          errors.push(`build.residues[${index}] contains an invalid stat option.`);
        }
      });
    }
  }
  if (build.statAdjustmentsPct !== undefined) {
    if (!build.statAdjustmentsPct || typeof build.statAdjustmentsPct !== 'object' || Array.isArray(build.statAdjustmentsPct)) {
      errors.push('build.statAdjustmentsPct must be an object.');
    } else {
      for (const [key, value] of Object.entries(build.statAdjustmentsPct)) {
        if (!BUILD_STAT_KEYS.includes(key as keyof BaseStats) || !Number.isFinite(value) || value < -90 || value > 1000) {
          errors.push(`build.statAdjustmentsPct.${key} must be between -90 and 1000.`);
        }
      }
    }
  }
  return errors;
}

export function validateBotScenario(input: BotSimulationScenario): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return ['Request body must be an object.'];
  const mds = MasterDataService.getInstance();
  const stage = mds.getStage(input.stageId);
  if (!stage || stage.nodeType === 'SAFE' || stage.waves.length === 0) errors.push('stageId must reference a playable stage.');
  if (!BOT_PROFILE_NAMES.includes(input.profile)) errors.push('profile is invalid.');
  if (!BOT_POLICY_NAMES.includes(input.policy)) errors.push('policy is invalid.');
  if (input.jobId !== undefined && !BOT_JOB_IDS.includes(input.jobId)) errors.push('jobId is invalid.');
  if (!Number.isInteger(input.iterations) || input.iterations < 1 || input.iterations > BOT_SIMULATION_LIMITS.maxIterations) {
    errors.push(`iterations must be an integer between 1 and ${BOT_SIMULATION_LIMITS.maxIterations}.`);
  }
  const maxRounds = input.maxRounds ?? 200;
  if (!Number.isInteger(maxRounds) || maxRounds < BOT_SIMULATION_LIMITS.minRounds || maxRounds > BOT_SIMULATION_LIMITS.maxRounds) {
    errors.push(`maxRounds must be an integer between ${BOT_SIMULATION_LIMITS.minRounds} and ${BOT_SIMULATION_LIMITS.maxRounds}.`);
  }
  const sampleRuns = input.sampleRuns ?? 0;
  if (!Number.isInteger(sampleRuns) || sampleRuns < 0 || sampleRuns > BOT_SIMULATION_LIMITS.maxSampleRuns) {
    errors.push(`sampleRuns must be an integer between 0 and ${BOT_SIMULATION_LIMITS.maxSampleRuns}.`);
  }
  if (typeof input.seed !== 'string' && typeof input.seed !== 'number') errors.push('seed must be a string or number.');
  errors.push(...validateBotBuild(input.build, mds, input.profile));
  return errors;
}

export function simulateBotScenario(
  input: BotSimulationScenario,
  mds: MasterDataService = MasterDataService.getInstance(),
): BotBatchReport {
  const validationErrors = validateBotScenario(input);
  if (validationErrors.length > 0) throw new Error(validationErrors.join(' '));
  const stage = mds.getStage(input.stageId)!;
  const jobId = input.jobId ?? 'warrior';
  const profile = resolveBotProfile(input.profile, jobId, mds, input.build);
  const maxRounds = input.maxRounds ?? 200;
  const sampleRuns = input.sampleRuns ?? 0;
  const firstClear = input.firstClear ?? false;
  const runs: BotRunResult[] = [];
  const samples: BotRunResult[] = [];
  const dropHits = new Map<string, number>();
  const dropCounts = new Map<string, number>();
  let eligibleRewardRuns = 0;

  for (let iteration = 0; iteration < input.iterations; iteration += 1) {
    const battleSeed = deriveSeed(input.seed, input.stageId, input.profile, input.policy, jobId, iteration, 'battle');
    const result = runBotBattle(stage, profile, input.policy, battleSeed, iteration, maxRounds, mds);
    runs.push(result);
    if (samples.length < sampleRuns) samples.push(result);
    if (result.outcome !== 'VICTORY') continue;

    eligibleRewardRuns += 1;
    const rewardSeed = deriveSeed(input.seed, input.stageId, input.profile, input.policy, jobId, iteration, 'reward');
    const counts = rollRewards(stage, profile, firstClear, rewardSeed, mds);
    for (const [key, count] of counts) {
      dropHits.set(key, (dropHits.get(key) ?? 0) + 1);
      dropCounts.set(key, (dropCounts.get(key) ?? 0) + count);
    }
  }

  const wins = runs.filter(run => run.outcome === 'VICTORY').length;
  const losses = runs.filter(run => run.outcome === 'DEFEAT').length;
  const timeouts = runs.filter(run => run.outcome === 'TIMEOUT').length;
  const clearRate = wins / runs.length;
  const difficulty: BotDifficultyReport = {
    runs: runs.length,
    wins,
    losses,
    timeouts,
    clearRate,
    clearRate95: wilsonInterval(wins, runs.length),
    rounds: distribution(runs.map(run => run.rounds)),
    actions: distribution(runs.map(run => run.actions)),
    remainingHpPct: distribution(runs.map(run => run.remainingHpPct)),
    alivePartyMembers: distribution(runs.map(run => run.alivePartyMembers)),
    remainingPartyHpPct: distribution(runs.map(run => run.remainingPartyHpPct)),
    damageDealt: distribution(runs.map(run => run.damageDealt)),
    damageTaken: distribution(runs.map(run => run.damageTaken)),
    criticalHits: runs.reduce((sum, run) => sum + run.criticalHits, 0),
    weaknessHits: runs.reduce((sum, run) => sum + run.weaknessHits, 0),
    skillUses: runs.reduce((sum, run) => sum + run.skillUses, 0),
    demonActivations: runs.reduce((sum, run) => sum + run.demonActivations, 0),
    demonUltimates: runs.reduce((sum, run) => sum + run.demonUltimates, 0),
  };

  const clearedStages = firstClear
    ? profile.clearedStages.filter(id => id !== stage.id)
    : Array.from(new Set([...profile.clearedStages, stage.id]));
  const configuredRates = buildConfiguredRates(stage, clearedStages, firstClear, profile, mds);
  const dropKeys = new Set([...configuredRates.keys(), ...dropCounts.keys()]);
  const drops = [...dropKeys].sort().map((key): BotDropObservation => {
    const configuredRate = configuredRates.get(key) ?? null;
    const hitRuns = dropHits.get(key) ?? 0;
    const observedRate = eligibleRewardRuns > 0 ? hitRuns / eligibleRewardRuns : 0;
    const observedRate95 = wilsonInterval(hitRuns, eligibleRewardRuns);
    return {
      key,
      configuredRate,
      eligibleRuns: eligibleRewardRuns,
      hitRuns,
      dropCount: dropCounts.get(key) ?? 0,
      observedRate,
      observedRate95,
      configuredRateInside95: configuredRate === null || eligibleRewardRuns === 0
        ? null
        : configuredRate >= observedRate95.low && configuredRate <= observedRate95.high,
    };
  });

  const warnings: string[] = [];
  if (clearRate < 0.5) warnings.push(`Low clear rate: ${(clearRate * 100).toFixed(1)}%.`);
  if (timeouts > 0) warnings.push(`Timeouts detected: ${timeouts}/${runs.length}.`);
  for (const drop of drops) {
    if (drop.eligibleRuns >= 30 && drop.configuredRateInside95 === false) {
      warnings.push(`Configured drop rate outside observed 95% interval: ${drop.key}.`);
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    scenario: {
      stageId: input.stageId,
      profile: input.profile,
      policy: input.policy,
      jobId,
      iterations: input.iterations,
      seed: input.seed,
      maxRounds,
      firstClear,
      sampleRuns,
      build: input.build,
    },
    resolvedProfile: profile,
    stage: {
      id: stage.id,
      nameJa: stage.nameJa,
      chapter: stage.chapter,
      difficulty: stage.difficulty,
      waveCount: stage.waveCount,
    },
    difficulty,
    series: {
      outcomes: runs.map(run => run.outcome),
      rounds: runs.map(run => run.rounds),
      actions: runs.map(run => run.actions),
      remainingHpPct: runs.map(run => run.remainingHpPct),
      alivePartyMembers: runs.map(run => run.alivePartyMembers),
      remainingPartyHpPct: runs.map(run => run.remainingPartyHpPct),
      damageDealt: runs.map(run => run.damageDealt),
      damageTaken: runs.map(run => run.damageTaken),
    },
    drops,
    samples,
    warnings,
  };
}

export function validateBotSensitivityRequest(input: BotSensitivityRequest): string[] {
  if (!input || typeof input !== 'object') return ['Request body must be an object.'];
  const errors = validateBotScenario(input.scenario);
  if (!Array.isArray(input.stats) || input.stats.length < 1 || input.stats.length > BUILD_STAT_KEYS.length
    || input.stats.some(stat => !BUILD_STAT_KEYS.includes(stat))) {
    errors.push('stats must contain between 1 and 8 supported combat stats.');
  }
  if (!Array.isArray(input.deltasPct) || input.deltasPct.length < 1 || input.deltasPct.length > 8
    || input.deltasPct.some(delta => !Number.isFinite(delta) || delta < -90 || delta > 1000 || delta === 0)) {
    errors.push('deltasPct must contain between 1 and 8 non-zero values from -90 to 1000.');
  }
  if ((input.stats?.length ?? 0) * (input.deltasPct?.length ?? 0) > 32) {
    errors.push('Sensitivity analysis is limited to 32 variants.');
  }
  return errors;
}

export function simulateBotSensitivity(input: BotSensitivityRequest): BotSensitivityReport {
  const errors = validateBotSensitivityRequest(input);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const baseline = simulateBotScenario(input.scenario);
  const variants: BotSensitivityVariant[] = [];
  for (const stat of input.stats) {
    for (const deltaPct of input.deltasPct) {
      const report = simulateBotScenario({
        ...input.scenario,
        build: {
          ...input.scenario.build,
          statAdjustmentsPct: {
            ...input.scenario.build?.statAdjustmentsPct,
            [stat]: (input.scenario.build?.statAdjustmentsPct?.[stat] ?? 0) + deltaPct,
          },
        },
      });
      variants.push({
        stat,
        deltaPct,
        clearRate: report.difficulty.clearRate,
        clearRateDelta: report.difficulty.clearRate - baseline.difficulty.clearRate,
        roundsP95: report.difficulty.rounds.p95,
        roundsP95Delta: report.difficulty.rounds.p95 - baseline.difficulty.rounds.p95,
        remainingHpPctMean: report.difficulty.remainingHpPct.mean,
        remainingHpPctMeanDelta: report.difficulty.remainingHpPct.mean - baseline.difficulty.remainingHpPct.mean,
      });
    }
  }
  return { generatedAt: new Date().toISOString(), baseline, variants };
}
