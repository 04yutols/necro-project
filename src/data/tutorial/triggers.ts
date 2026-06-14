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

const TUTORIAL_BATTLE_STAGE_IDS = new Set(['tutorial_battle_01', 'area1_node1']);

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
    hasCleared('area1_node1') &&
    hasCompleted('BATTLE_BASICS') &&
    !hasCompleted('PARTY_FORMATION')
  ) {
    return 'PARTY_FORMATION';
  }

  if (
    hasCleared('area1_node2') &&
    hasCompleted('PARTY_FORMATION') &&
    !hasCompleted('WEAPON_EQUIP')
  ) {
    return 'WEAPON_EQUIP';
  }

  if (
    hasCleared('area1_node2') &&
    hasCompleted('WEAPON_EQUIP') &&
    !hasCompleted('JOB_CHANGE')
  ) {
    return 'JOB_CHANGE';
  }

  if (
    hasCleared('area1_boss') &&
    hasCompleted('JOB_CHANGE') &&
    !hasCompleted('WEAPON_ENHANCE')
  ) {
    return 'WEAPON_ENHANCE';
  }

  if (
    hasCleared('area1_boss') &&
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
  return Boolean(stageId && TUTORIAL_BATTLE_STAGE_IDS.has(stageId));
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
