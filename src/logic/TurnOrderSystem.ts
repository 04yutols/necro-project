import { calcAVDelay } from './StatusAilmentSystem';

export type TurnActorSide = 'PLAYER' | 'ENEMY';

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
  enemies: TurnOrderActor[];
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
  let nextPlayer = { ...player };
  let nextEnemies = enemies.map((enemy) => ({ ...enemy }));
  const enemyActions: TurnOrderActor[] = [];
  const skippedEnemyTurns: TurnOrderActor[] = [];
  const orderPreview = buildTurnOrder([nextPlayer, ...nextEnemies]).slice(0, 5);

  for (let guard = 0; guard < maxEnemyActions; guard++) {
    const nextActor = buildTurnOrder([nextPlayer, ...nextEnemies])[0];
    if (!nextActor || nextActor.side === 'PLAYER') break;
    if (nextActor.currentAv >= nextPlayer.currentAv) break;

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
    enemies: nextEnemies,
    enemyActions,
    skippedEnemyTurns,
    orderPreview,
  };
}
