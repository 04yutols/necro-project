import { isAbyssalResidueUnlocked } from '../../logic/AbyssalResidueUnlockSystem';
import { PHASE_STEPS, type TutorialPhase } from './phases';

export interface TutorialTriggerInput {
  clearedStages: readonly string[] | null | undefined;
  completedPhases: readonly TutorialPhase[];
  storyFlags: Record<string, boolean | undefined>;
}

export type TutorialNavigationTab = 'EQUIP' | 'LAB' | 'JOB';

export interface BattleTutorialTriggerInput {
  stageId: string | null | undefined;
  completedPhases: readonly TutorialPhase[];
  activePhase: TutorialPhase | null;
  tutorialCompleted: boolean;
}

export interface ClearTutorialTriggerGateInput {
  currentTab: string;
  tutorialHydrated: boolean;
  storyHydrated: boolean;
  tutorialCompleted: boolean;
}

export const TUTORIAL_BATTLE_STAGE_IDS = ['tutorial_battle_01', 'area1_node1'] as const;
export const TUTORIAL_VIRTUAL_STAGE_IDS = ['tutorial_battle_01'] as const;

const TUTORIAL_BATTLE_STAGE_ID_SET = new Set<string>(TUTORIAL_BATTLE_STAGE_IDS);

export const TUTORIAL_CHAIN_STAGE_IDS = {
  PARTY_FORMATION: 'area1_node1',
  WEAPON_EQUIP: 'area1_node2',
  JOB_CHANGE: 'area1_node2',
  WEAPON_ENHANCE: 'area1_boss',
  DEMONIZATION: 'area1_boss',
} as const satisfies Partial<Record<TutorialPhase, string>>;

const CLEAR_TUTORIAL_CHAIN_PHASES = new Set<TutorialPhase>([
  'BATTLE_BASICS',
  'PARTY_FORMATION',
  'WEAPON_EQUIP',
  'JOB_CHANGE',
  'WEAPON_ENHANCE',
  'DEMONIZATION',
]);

/**
 * ステージクリア後に解放すべきチュートリアルフェーズを返す。
 * BATTLE_BASICS はバトル開始時専用のため、この判定では扱わない。
 */
export function getTutorialPhaseAfterClear({
  clearedStages,
  completedPhases,
  storyFlags,
}: TutorialTriggerInput): TutorialPhase | null {
  const cleared = clearedStages ?? [];
  const completed = new Set<TutorialPhase>(completedPhases);
  const tutorialChainStarted = completedPhases.some(phase => CLEAR_TUTORIAL_CHAIN_PHASES.has(phase));
  if (storyFlags.LINE_DEATH_SEEN !== true && !tutorialChainStarted) return null;

  const hasCleared = (stageId: string) => cleared.includes(stageId);
  const hasCompleted = (phase: TutorialPhase) => completed.has(phase);

  if (
    hasCleared(TUTORIAL_CHAIN_STAGE_IDS.PARTY_FORMATION) &&
    hasCompleted('BATTLE_BASICS') &&
    !hasCompleted('PARTY_FORMATION')
  ) {
    return 'PARTY_FORMATION';
  }

  if (
    hasCleared(TUTORIAL_CHAIN_STAGE_IDS.WEAPON_EQUIP) &&
    hasCompleted('PARTY_FORMATION') &&
    !hasCompleted('WEAPON_EQUIP')
  ) {
    return 'WEAPON_EQUIP';
  }

  if (
    hasCleared(TUTORIAL_CHAIN_STAGE_IDS.JOB_CHANGE) &&
    hasCompleted('WEAPON_EQUIP') &&
    !hasCompleted('JOB_CHANGE')
  ) {
    return 'JOB_CHANGE';
  }

  if (
    hasCleared(TUTORIAL_CHAIN_STAGE_IDS.WEAPON_ENHANCE) &&
    hasCompleted('JOB_CHANGE') &&
    !hasCompleted('WEAPON_ENHANCE')
  ) {
    return 'WEAPON_ENHANCE';
  }

  if (
    hasCleared(TUTORIAL_CHAIN_STAGE_IDS.DEMONIZATION) &&
    hasCompleted('WEAPON_ENHANCE') &&
    !hasCompleted('DEMONIZATION')
  ) {
    return 'DEMONIZATION';
  }

  if (
    isAbyssalResidueUnlocked(cleared) &&
    hasCompleted('DEMONIZATION') &&
    !hasCompleted('ABYSSAL_RESIDUE')
  ) {
    return 'ABYSSAL_RESIDUE';
  }

  return null;
}

const DESTINATION_TAB_BY_REQUIRED_TAB: Record<string, TutorialNavigationTab | undefined> = {
  EQUIP: 'EQUIP',
  LAB: 'LAB',
  JOB: 'JOB',
};

export function getTutorialPhaseDestinationTab(phase: TutorialPhase): TutorialNavigationTab | null {
  const requiredTab = PHASE_STEPS[phase][0]?.requiredTab;
  if (!requiredTab) return null;
  return DESTINATION_TAB_BY_REQUIRED_TAB[requiredTab] ?? null;
}

export function isTutorialBattleStage(stageId: string | null | undefined): boolean {
  return Boolean(stageId && TUTORIAL_BATTLE_STAGE_ID_SET.has(stageId));
}

export function shouldStartBattleTutorial({
  stageId,
  completedPhases,
  activePhase,
  tutorialCompleted,
}: BattleTutorialTriggerInput): boolean {
  return isTutorialBattleStage(stageId)
    && !tutorialCompleted
    && !activePhase
    && !completedPhases.includes('BATTLE_BASICS');
}

export function shouldEvaluateClearTutorialTrigger({
  currentTab,
  tutorialHydrated,
  storyHydrated,
  tutorialCompleted,
}: ClearTutorialTriggerGateInput): boolean {
  return tutorialHydrated
    && storyHydrated
    && !tutorialCompleted
    && currentTab !== 'BATTLE';
}
