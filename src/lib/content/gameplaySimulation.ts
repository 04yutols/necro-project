import { BattleEngine, type BattleEngineMasterData } from '../../logic/BattleEngine';
import { buildTurnOrder, type TurnOrderEntry } from '../../logic/TurnOrderSystem';
import { applyEnemyStatScale } from '../../logic/EnemyScaling';
import { MasterDataService } from '../../services/MasterDataService';
import type { BattleLog, CharacterData, EnemyData, MonsterData, SkillData, StageData } from '../../types/game';

export type MetricStatus = 'PASS' | 'WARN' | 'FAIL';

export type TargetRange = { min: number; max: number };

export type GameplaySimulationTargets = {
  ttkTurns: TargetRange;
  incomingDamagePct: TargetRange;
  aoeValue: TargetRange;
  partyCost: TargetRange;
};

export type GameplaySimulationConfig = {
  player: CharacterData;
  party: [MonsterData | null, MonsterData | null, MonsterData | null];
  enemies: MonsterData[];
  skill?: SkillData;
  maxTurns?: number;
  targets?: Partial<GameplaySimulationTargets>;
};

export type SimulationMetric = {
  value: number;
  target: TargetRange;
  status: MetricStatus;
  summary: string;
};

export type GameplaySimulationReport = {
  engine: 'BattleEngine';
  deterministicRng: number;
  metrics: {
    ttkTurns: SimulationMetric;
    incomingDamagePct: SimulationMetric;
    aoeValue: SimulationMetric;
    partyCost: SimulationMetric;
  };
  actionOrder: Array<Pick<TurnOrderEntry, 'id' | 'name' | 'side' | 'spd' | 'currentAv' | 'actionDelay'>>;
  turns: Array<{ turn: number; action: string; dealt: number; incoming: number; targetHp: number }>;
  overall: MetricStatus;
  findings: Array<{ level: MetricStatus; field: string; message: string }>;
};

export type StageGameplaySimulationReport = GameplaySimulationReport & {
  stageId: string;
  waves: Array<{ label: string; role: StageData['waves'][number]['role']; report: GameplaySimulationReport }>;
};

const DEFAULT_TARGETS: GameplaySimulationTargets = {
  ttkTurns: { min: 2, max: 8 },
  incomingDamagePct: { min: 5, max: 75 },
  aoeValue: { min: 2, max: 3.2 },
  partyCost: { min: 0, max: 6 },
};

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function metricStatus(value: number, target: TargetRange): MetricStatus {
  if (value >= target.min && value <= target.max) return 'PASS';
  const width = Math.max(1, target.max - target.min);
  const distance = value < target.min ? target.min - value : value - target.max;
  return distance / width <= 0.25 ? 'WARN' : 'FAIL';
}

function makeMetric(value: number, target: TargetRange, label: string): SimulationMetric {
  const status = metricStatus(value, target);
  return {
    value: Number(value.toFixed(2)),
    target,
    status,
    summary: `${label}: ${Number(value.toFixed(2))}（目標 ${target.min}〜${target.max}）`,
  };
}

function severity(status: MetricStatus): number {
  return status === 'FAIL' ? 2 : status === 'WARN' ? 1 : 0;
}

function draftMasterData(skill: SkillData | undefined): BattleEngineMasterData {
  const base = MasterDataService.getInstance();
  return {
    getJob: id => base.getJob(id),
    getEnemy: id => base.getEnemy(id),
    getSkill: id => skill?.id === id ? skill : base.getSkill(id),
  };
}

function damageFrom(logs: BattleLog[], action: string): number {
  return logs.filter(log => log.action === action).reduce((sum, log) => sum + (log.damage ?? 0), 0);
}

function incomingFrom(logs: BattleLog[]): number {
  return logs.filter(log => log.action === 'ENEMY_ATTACK').reduce((sum, log) => sum + (log.damage ?? 0), 0);
}

function actionOrder(config: GameplaySimulationConfig): GameplaySimulationReport['actionOrder'] {
  const actors = [
    { id: config.player.id, name: config.player.name, side: 'PLAYER' as const, spd: config.player.stats.spd, currentAv: 10000 / Math.max(1, config.player.stats.spd) },
    ...config.party.flatMap((monster, index) => monster ? [{ id: monster.id, name: monster.name, side: 'ALLY' as const, spd: monster.stats.spd, currentAv: 10000 / Math.max(1, monster.stats.spd) + index * 0.001 }] : []),
    ...config.enemies.map((enemy, index) => ({ id: enemy.id, name: enemy.name, side: 'ENEMY' as const, spd: enemy.stats.spd, currentAv: 10000 / Math.max(1, enemy.stats.spd) + index * 0.001 })),
  ];
  return buildTurnOrder(actors).map(({ id, name, side, spd, currentAv, actionDelay }) => ({ id, name, side, spd, currentAv, actionDelay }));
}

/**
 * Runs authored data through the production BattleEngine. No synthetic damage formula is used here.
 * RNG=0.999 avoids random critical/status procs while keeping all runtime defense/resistance/resource logic.
 */
export function runGameplaySimulation(config: GameplaySimulationConfig): GameplaySimulationReport {
  if (config.enemies.length === 0) throw new Error('Gameplay simulation requires at least one enemy.');
  if (config.party.length !== 3) throw new Error('Part 1 party must contain exactly three monster slots.');
  const targets: GameplaySimulationTargets = {
    ...DEFAULT_TARGETS,
    ...config.targets,
  };
  const player = clone(config.player);
  const party = clone(config.party);
  const enemies = clone(config.enemies);
  const primary = enemies[0];
  const engine = new BattleEngine(player, party, 'NONE', undefined, undefined, {
    masterData: draftMasterData(config.skill),
    rng: () => 0.999,
  });
  const maxTurns = Math.max(1, config.maxTurns ?? 50);
  const turns: GameplaySimulationReport['turns'] = [];
  let incoming = 0;
  let turn = 0;

  while ((engine.getEnemyCurrentHp(primary.id) ?? primary.stats.hp) > 0 && turn < maxTurns) {
    turn += 1;
    const canUseSkill = Boolean(config.skill && player.currentEnergy >= config.skill.mpCost);
    const action = canUseSkill ? 'MAGIC_SKILL' : 'PHYSICAL_ATTACK';
    const logs = engine.simulateAction(action, primary, canUseSkill ? config.skill?.id : undefined, enemies);
    const dealt = damageFrom(logs, action);
    const received = incomingFrom(logs);
    incoming += received;
    turns.push({ turn, action, dealt, incoming: received, targetHp: engine.getEnemyCurrentHp(primary.id) ?? primary.stats.hp });
    if (dealt <= 0 && received <= 0) break;
  }

  const aoeEnemies = enemies.map((enemy, index) => ({ ...clone(enemy), id: `${enemy.id}_aoe_${index}` }));
  while (aoeEnemies.length < 3) {
    const source = aoeEnemies[0];
    aoeEnemies.push({ ...clone(source), id: `${source.id}_clone_${aoeEnemies.length}`, name: `${source.name} ${aoeEnemies.length + 1}` });
  }
  const aoePlayer = clone(config.player);
  const aoeEngine = new BattleEngine(aoePlayer, clone(config.party), 'NONE', undefined, undefined, {
    masterData: draftMasterData(config.skill),
    rng: () => 0.999,
  });
  const aoeAction = config.skill?.targetType === 'ALL_ENEMIES' && aoePlayer.currentEnergy >= config.skill.mpCost ? 'MAGIC_SKILL' : 'PHYSICAL_ATTACK';
  const aoeLogs = aoeEngine.simulateAction(aoeAction, aoeEnemies[0], aoeAction === 'MAGIC_SKILL' ? config.skill?.id : undefined, aoeEnemies.slice(0, 3));
  const damages = aoeLogs.filter(log => log.action === aoeAction).map(log => log.damage ?? 0);
  const aoeValue = damages.length > 0 ? damages.reduce((sum, value) => sum + value, 0) / Math.max(1, damages[0]) : 0;

  const totalHp = config.player.stats.hp + config.party.reduce((sum, monster) => sum + (monster?.stats.hp ?? 0), 0);
  const partyCost = config.party.reduce((sum, monster) => sum + (monster?.cost ?? 0), 0);
  const metrics = {
    ttkTurns: makeMetric(turn, targets.ttkTurns, 'TTK（行動回数）'),
    incomingDamagePct: makeMetric(totalHp > 0 ? incoming / totalHp * 100 : 0, targets.incomingDamagePct, '累積被ダメージ率'),
    aoeValue: makeMetric(aoeValue, targets.aoeValue, 'AoE価値（単体比）'),
    partyCost: makeMetric(partyCost, targets.partyCost, '編成コスト'),
  };
  const overall = Object.values(metrics).map(metric => metric.status).sort((a, b) => severity(b) - severity(a))[0] ?? 'PASS';
  const findings = Object.entries(metrics)
    .filter(([, metric]) => metric.status !== 'PASS')
    .map(([field, metric]) => ({ level: metric.status, field, message: metric.summary }));

  return {
    engine: 'BattleEngine',
    deterministicRng: 0.999,
    metrics,
    actionOrder: actionOrder(config),
    turns,
    overall,
    findings,
  };
}

function enemyToMonster(enemy: EnemyData): MonsterData {
  return {
    id: enemy.id,
    name: enemy.nameJa || enemy.name,
    tribe: enemy.tribe,
    cost: 0,
    stats: clone(enemy.stats),
    resistances: clone(enemy.resistances),
    weaknesses: clone(enemy.weaknesses),
    tier: enemy.tier,
    shieldHp: enemy.shieldHp,
    maxShieldHp: enemy.maxShieldHp,
    gimmicks: clone(enemy.gimmicks),
    currentEnergy: 0,
    maxEnergy: 0,
  };
}

/** Evaluates every combat wave in a real StageData definition and aggregates its target gates. */
export function runStageGameplaySimulation(
  stage: StageData,
  enemyMaster: Record<string, EnemyData>,
  config: Omit<GameplaySimulationConfig, 'enemies'>,
): StageGameplaySimulationReport {
  const waves = stage.waves.map(wave => {
    const enemies = wave.enemyIds.map(id => {
      const enemy = enemyMaster[id];
      if (!enemy) throw new Error(`Stage ${stage.id} references missing enemy ${id}.`);
      return enemyToMonster(wave.statScale ? applyEnemyStatScale(enemy, wave.statScale) : enemy);
    });
    return { label: wave.label, role: wave.role, report: runGameplaySimulation({ ...config, enemies }) };
  });
  if (waves.length === 0) throw new Error(`Stage ${stage.id} has no combat waves.`);
  const targetDefaults: GameplaySimulationTargets = {
    ...DEFAULT_TARGETS,
    ttkTurns: config.targets?.ttkTurns ?? {
      min: DEFAULT_TARGETS.ttkTurns.min * waves.length,
      max: DEFAULT_TARGETS.ttkTurns.max * waves.length,
    },
    incomingDamagePct: config.targets?.incomingDamagePct ?? {
      min: DEFAULT_TARGETS.incomingDamagePct.min * waves.length,
      max: DEFAULT_TARGETS.incomingDamagePct.max * waves.length,
    },
    ...config.targets,
  };
  const totalTtk = waves.reduce((sum, wave) => sum + wave.report.metrics.ttkTurns.value, 0);
  const totalIncoming = waves.reduce((sum, wave) => sum + wave.report.metrics.incomingDamagePct.value, 0);
  const avgAoe = waves.reduce((sum, wave) => sum + wave.report.metrics.aoeValue.value, 0) / waves.length;
  const partyCost = waves[0].report.metrics.partyCost.value;
  const metrics = {
    ttkTurns: makeMetric(totalTtk, targetDefaults.ttkTurns, 'Stage TTK（全WAVE行動回数）'),
    incomingDamagePct: makeMetric(totalIncoming, targetDefaults.incomingDamagePct, 'Stage累積被ダメージ率'),
    aoeValue: makeMetric(avgAoe, targetDefaults.aoeValue, 'Stage平均AoE価値'),
    partyCost: makeMetric(partyCost, targetDefaults.partyCost, '編成コスト'),
  };
  const overall = Object.values(metrics).map(metric => metric.status).sort((a, b) => severity(b) - severity(a))[0] ?? 'PASS';
  return {
    engine: 'BattleEngine', deterministicRng: 0.999, stageId: stage.id, waves,
    metrics, actionOrder: waves[0].report.actionOrder,
    turns: waves.flatMap((wave, waveIndex) => wave.report.turns.map(turn => ({ ...turn, turn: waveIndex * 1000 + turn.turn }))),
    overall,
    findings: Object.entries(metrics)
      .filter(([, metric]) => metric.status !== 'PASS')
      .map(([field, metric]) => ({ level: metric.status, field, message: metric.summary })),
  };
}
