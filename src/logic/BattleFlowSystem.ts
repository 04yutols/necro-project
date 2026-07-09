export type BattlePhase =
  | 'playerTurn'
  | 'monsterTurn'
  | 'skillMenu'
  | 'monsterSkillMenu'
  | 'itemMenu'
  | 'animating'
  | 'enemyTurn'
  | 'waveTransition';

export function shouldInitializeBattle(
  initializedBattleKey: string | null,
  nextBattleKey: string,
): boolean {
  return initializedBattleKey !== nextBattleKey;
}

export function canStartPlayerAction(input: {
  phase: BattlePhase;
  requiredPhase: BattlePhase;
  actionLocked: boolean;
  waveResolving: boolean;
}): boolean {
  return input.phase === input.requiredPhase
    && !input.actionLocked
    && !input.waveResolving;
}
