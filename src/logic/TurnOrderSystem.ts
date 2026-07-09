import { calcAVDelay } from './StatusAilmentSystem';

export type TurnActorSide = 'PLAYER' | 'ALLY' | 'ENEMY';

export interface TurnOrderActor {
  id: string;
  name: string;
  side: TurnActorSide;
  spd: number;
  currentAv: number;
  tieBreaker?: number;
}

export interface TurnOrderEntry extends TurnOrderActor {
  actionDelay: number;
}

export interface EnemyPhaseSchedule {
  player: TurnOrderActor;
  allies: TurnOrderActor[];
  enemies: TurnOrderActor[];
  nextAlly: TurnOrderActor;
  enemyActions: TurnOrderActor[];
  skippedEnemyTurns: TurnOrderActor[];
  orderPreview: TurnOrderEntry[];
}

export function calculateActionDelay(spd: number): number {
  return Math.max(1, Math.round(10000 / Math.max(1, spd)));
}

export function calculateInitialActionValue(spd: number, initialOffset = 0): number {
  return Math.max(0, calculateActionDelay(spd) + initialOffset);
}

export function applyActionDelay<T extends TurnOrderActor>(actor: T): T {
  return {
    ...actor,
    currentAv: actor.currentAv + calculateActionDelay(actor.spd),
  };
}

export function applyStatusActionDelay<T extends TurnOrderActor>(
  actor: T,
  baseAVDelay: number,
  targetEffectRes: number,
): T {
  return {
    ...actor,
    currentAv: actor.currentAv + calcAVDelay(baseAVDelay, targetEffectRes),
  };
}

export function buildTurnOrder(actors: TurnOrderActor[]): TurnOrderEntry[] {
  return actors
    .map((actor) => ({ ...actor, actionDelay: calculateActionDelay(actor.spd) }))
    .sort((a, b) => {
      if (a.currentAv !== b.currentAv) return a.currentAv - b.currentAv;
      if (a.actionDelay !== b.actionDelay) return a.actionDelay - b.actionDelay;
      return (a.tieBreaker ?? 0) - (b.tieBreaker ?? 0);
    });
}

export function buildTurnOrderPreview(
  actors: TurnOrderActor[],
  maxEntries = 5,
): TurnOrderEntry[] {
  return buildTurnOrder(actors).slice(0, Math.max(0, Math.floor(maxEntries)));
}

export function scheduleEnemiesUntilAlly({
  player,
  allies = [],
  enemies,
  skippedEnemyIds = new Set<string>(),
  maxEnemyActions = Math.max(1, enemies.length * 2),
}: {
  player: TurnOrderActor;
  allies?: TurnOrderActor[];
  enemies: TurnOrderActor[];
  skippedEnemyIds?: Set<string>;
  maxEnemyActions?: number;
}): EnemyPhaseSchedule {
  let nextPlayer = { ...player };
  let nextAllies = allies.map((ally) => ({ ...ally }));
  let nextEnemies = enemies.map((enemy) => ({ ...enemy }));
  const enemyActions: TurnOrderActor[] = [];
  const skippedEnemyTurns: TurnOrderActor[] = [];
  const getAllActors = () => [nextPlayer, ...nextAllies, ...nextEnemies];
  const orderPreview = buildTurnOrderPreview(getAllActors());

  for (let guard = 0; guard < maxEnemyActions; guard++) {
    const nextActor = buildTurnOrder(getAllActors())[0];
    if (!nextActor || nextActor.side === 'PLAYER' || nextActor.side === 'ALLY') break;
    const nextAllyActor = buildTurnOrder([nextPlayer, ...nextAllies])[0];
    if (nextAllyActor && nextActor.currentAv >= nextAllyActor.currentAv) break;

    const enemyIndex = nextEnemies.findIndex((enemy) => enemy.id === nextActor.id);
    if (enemyIndex < 0) break;

    nextEnemies[enemyIndex] = applyActionDelay(nextEnemies[enemyIndex]);
    if (skippedEnemyIds.has(nextActor.id)) {
      skippedEnemyTurns.push(nextActor);
    } else {
      enemyActions.push(nextActor);
    }
  }

  return {
    player: nextPlayer,
    allies: nextAllies,
    enemies: nextEnemies,
    nextAlly: buildTurnOrder([nextPlayer, ...nextAllies])[0] ?? nextPlayer,
    enemyActions,
    skippedEnemyTurns,
    orderPreview,
  };
}

export function scheduleEnemiesUntilPlayer({
  player,
  enemies,
  skippedEnemyIds = new Set<string>(),
  maxEnemyActions = Math.max(1, enemies.length * 2),
}: {
  player: TurnOrderActor;
  enemies: TurnOrderActor[];
  skippedEnemyIds?: Set<string>;
  maxEnemyActions?: number;
}): EnemyPhaseSchedule {
  return scheduleEnemiesUntilAlly({
    player,
    allies: [],
    enemies,
    skippedEnemyIds,
    maxEnemyActions,
  });
}
