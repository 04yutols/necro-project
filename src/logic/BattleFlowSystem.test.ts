import { canStartPlayerAction, shouldInitializeBattle } from './BattleFlowSystem';

describe('BattleFlowSystem', () => {
  test('initializes only when the battle key changes', () => {
    expect(shouldInitializeBattle(null, 'area1_node1')).toBe(true);
    expect(shouldInitializeBattle('area1_node1', 'area1_node1')).toBe(false);
    expect(shouldInitializeBattle('area1_node1', 'area1_node2')).toBe(true);
  });

  test('accepts a player action only from the required unlocked phase', () => {
    expect(canStartPlayerAction({
      phase: 'playerTurn',
      requiredPhase: 'playerTurn',
      actionLocked: false,
      waveResolving: false,
    })).toBe(true);
  });

  test.each([
    {
      label: 'already locked',
      phase: 'playerTurn' as const,
      requiredPhase: 'playerTurn' as const,
      actionLocked: true,
      waveResolving: false,
    },
    {
      label: 'resolving a wave',
      phase: 'playerTurn' as const,
      requiredPhase: 'playerTurn' as const,
      actionLocked: false,
      waveResolving: true,
    },
    {
      label: 'wrong phase',
      phase: 'enemyTurn' as const,
      requiredPhase: 'playerTurn' as const,
      actionLocked: false,
      waveResolving: false,
    },
  ])('rejects an action when $label', ({ label: _label, ...input }) => {
    expect(canStartPlayerAction(input)).toBe(false);
  });
});
