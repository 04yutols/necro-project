import {
  applyActionDelay,
  applyStatusActionDelay,
  buildTurnOrder,
  calculateActionDelay,
  calculateInitialActionValue,
  scheduleEnemiesUntilPlayer,
  type TurnOrderActor,
} from './TurnOrderSystem';

describe('TurnOrderSystem', () => {
  test('calculates AV from SPD using 10000 / spd', () => {
    expect(calculateActionDelay(100)).toBe(100);
    expect(calculateActionDelay(200)).toBe(50);
    expect(calculateInitialActionValue(80)).toBe(125);
  });

  test('builds turn order by current AV, then faster actor on ties', () => {
    const order = buildTurnOrder([
      { id: 'slow', name: 'Slow', side: 'ENEMY', spd: 80, currentAv: 100 },
      { id: 'fast', name: 'Fast', side: 'ENEMY', spd: 160, currentAv: 100 },
      { id: 'player', name: 'Player', side: 'PLAYER', spd: 100, currentAv: 90 },
    ]);

    expect(order.map((actor) => actor.id)).toEqual(['player', 'fast', 'slow']);
  });

  test('schedules only enemies that act before the next player turn', () => {
    const player: TurnOrderActor = { id: 'player', name: 'Player', side: 'PLAYER', spd: 100, currentAv: 100 };
    const fastEnemy: TurnOrderActor = { id: 'fast', name: 'Fast Enemy', side: 'ENEMY', spd: 200, currentAv: 50 };
    const slowEnemy: TurnOrderActor = { id: 'slow', name: 'Slow Enemy', side: 'ENEMY', spd: 60, currentAv: 167 };

    const schedule = scheduleEnemiesUntilPlayer({ player, enemies: [fastEnemy, slowEnemy] });

    expect(schedule.enemyActions.map((actor) => actor.id)).toEqual(['fast']);
    expect(schedule.enemies.find((actor) => actor.id === 'fast')?.currentAv).toBe(100);
    expect(schedule.enemies.find((actor) => actor.id === 'slow')?.currentAv).toBe(167);
  });

  test('advances skipped enemy turns without executing attacks', () => {
    const player: TurnOrderActor = { id: 'player', name: 'Player', side: 'PLAYER', spd: 100, currentAv: 120 };
    const stunnedEnemy: TurnOrderActor = { id: 'stun', name: 'Stunned', side: 'ENEMY', spd: 100, currentAv: 80 };

    const schedule = scheduleEnemiesUntilPlayer({
      player,
      enemies: [stunnedEnemy],
      skippedEnemyIds: new Set(['stun']),
    });

    expect(schedule.enemyActions).toHaveLength(0);
    expect(schedule.skippedEnemyTurns.map((actor) => actor.id)).toEqual(['stun']);
    expect(schedule.enemies[0].currentAv).toBe(180);
  });

  test('applies action delay and status AV delay', () => {
    const actor: TurnOrderActor = { id: 'player', name: 'Player', side: 'PLAYER', spd: 100, currentAv: 10 };

    expect(applyActionDelay(actor).currentAv).toBe(110);
    expect(applyStatusActionDelay(actor, 40, 50).currentAv).toBe(30);
  });

  test('delayed player AV lets an enemy act before the next player turn', () => {
    const player: TurnOrderActor = { id: 'player', name: 'Player', side: 'PLAYER', spd: 100, currentAv: 120 };
    const delayedPlayer = applyStatusActionDelay(player, 40, 0);
    const enemy: TurnOrderActor = { id: 'boss', name: 'Boss', side: 'ENEMY', spd: 100, currentAv: 130 };

    const schedule = scheduleEnemiesUntilPlayer({ player: delayedPlayer, enemies: [enemy] });

    expect(delayedPlayer.currentAv).toBe(160);
    expect(schedule.enemyActions.map((actor) => actor.id)).toEqual(['boss']);
  });
});
