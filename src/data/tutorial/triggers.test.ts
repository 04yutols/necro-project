import type { TutorialPhase } from './phases';
import {
  getTutorialPhaseAfterClear,
  getTutorialPhaseDestinationTab,
  isTutorialBattleStage,
  shouldEvaluateClearTutorialTrigger,
  shouldStartBattleTutorial,
} from './triggers';

const STORY_READY = { LINE_DEATH_SEEN: true };

function getPhase(
  clearedStages: readonly string[],
  completedPhases: readonly TutorialPhase[],
  storyFlags: Record<string, boolean | undefined> = STORY_READY,
) {
  return getTutorialPhaseAfterClear({
    clearedStages,
    completedPhases,
    storyFlags,
  });
}

describe('tutorial triggers', () => {
  test('does not trigger clear-based phases before the prologue flag or tutorial chain', () => {
    expect(getPhase(['area1_node1'], [], { LINE_DEATH_SEEN: false })).toBeNull();
  });

  test('does not predict BATTLE_BASICS from stage clear', () => {
    expect(getPhase(['area1_node1'], [])).toBeNull();
  });

  test('returns PARTY_FORMATION after node1 clear once battle basics is completed', () => {
    expect(getPhase(['area1_node1'], ['BATTLE_BASICS'])).toBe('PARTY_FORMATION');
  });

  test('continues to PARTY_FORMATION after battle basics even if old story flags are missing', () => {
    expect(getPhase(['area1_node1'], ['BATTLE_BASICS'], {})).toBe('PARTY_FORMATION');
  });

  test('returns WEAPON_EQUIP after node2 clear once party formation is completed', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2'],
      ['BATTLE_BASICS', 'PARTY_FORMATION'],
    )).toBe('WEAPON_EQUIP');
  });

  test('returns JOB_CHANGE after weapon equip is completed on node2 progression', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2'],
      ['BATTLE_BASICS', 'PARTY_FORMATION', 'WEAPON_EQUIP'],
    )).toBe('JOB_CHANGE');
  });

  test('returns WEAPON_ENHANCE after boss clear once job change is completed', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2', 'area1_boss'],
      ['BATTLE_BASICS', 'PARTY_FORMATION', 'WEAPON_EQUIP', 'JOB_CHANGE'],
    )).toBe('WEAPON_ENHANCE');
  });

  test('returns DEMONIZATION after weapon enhancement tutorial is completed', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2', 'area1_boss'],
      ['BATTLE_BASICS', 'PARTY_FORMATION', 'WEAPON_EQUIP', 'JOB_CHANGE', 'WEAPON_ENHANCE'],
    )).toBe('DEMONIZATION');
  });

  test('returns ABYSSAL_RESIDUE after the residue unlock stage and demonization tutorial', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2', 'area1_boss', 'area1_node3'],
      [
        'BATTLE_BASICS',
        'PARTY_FORMATION',
        'WEAPON_EQUIP',
        'JOB_CHANGE',
        'WEAPON_ENHANCE',
        'DEMONIZATION',
      ],
    )).toBe('ABYSSAL_RESIDUE');
  });

  test('returns null when every clear-based tutorial phase is completed', () => {
    expect(getPhase(
      ['area1_node1', 'area1_node2', 'area1_boss', 'area1_node3'],
      [
        'BATTLE_BASICS',
        'PARTY_FORMATION',
        'WEAPON_EQUIP',
        'JOB_CHANGE',
        'WEAPON_ENHANCE',
        'DEMONIZATION',
        'ABYSSAL_RESIDUE',
      ],
    )).toBeNull();
  });

  test('maps tutorial phases to their CTA destination tabs', () => {
    expect(getTutorialPhaseDestinationTab('PARTY_FORMATION')).toBe('EQUIP');
    expect(getTutorialPhaseDestinationTab('WEAPON_EQUIP')).toBe('EQUIP');
    expect(getTutorialPhaseDestinationTab('JOB_CHANGE')).toBe('JOB');
    expect(getTutorialPhaseDestinationTab('ABYSSAL_RESIDUE')).toBe('LAB');
    expect(getTutorialPhaseDestinationTab('DEMONIZATION')).toBeNull();
  });

  test('identifies the stages that should start battle basics', () => {
    expect(isTutorialBattleStage('tutorial_battle_01')).toBe(true);
    expect(isTutorialBattleStage('area1_node1')).toBe(true);
    expect(isTutorialBattleStage('area1_node2')).toBe(false);
    expect(isTutorialBattleStage(undefined)).toBe(false);
  });

  test('starts battle basics only when no tutorial phase is active or completed', () => {
    expect(shouldStartBattleTutorial({
      stageId: 'area1_node1',
      completedPhases: [],
      activePhase: null,
      tutorialCompleted: false,
    })).toBe(true);

    expect(shouldStartBattleTutorial({
      stageId: 'area1_node1',
      completedPhases: ['BATTLE_BASICS'],
      activePhase: null,
      tutorialCompleted: false,
    })).toBe(false);

    expect(shouldStartBattleTutorial({
      stageId: 'area1_node1',
      completedPhases: [],
      activePhase: 'PARTY_FORMATION',
      tutorialCompleted: false,
    })).toBe(false);

    expect(shouldStartBattleTutorial({
      stageId: 'area1_node1',
      completedPhases: [],
      activePhase: null,
      tutorialCompleted: true,
    })).toBe(false);
  });

  test('does not evaluate clear-based tutorial triggers while the result screen is still in battle', () => {
    expect(shouldEvaluateClearTutorialTrigger({
      currentTab: 'BATTLE',
      tutorialHydrated: true,
      storyHydrated: true,
      tutorialCompleted: false,
    })).toBe(false);

    expect(shouldEvaluateClearTutorialTrigger({
      currentTab: 'HOME',
      tutorialHydrated: true,
      storyHydrated: true,
      tutorialCompleted: false,
    })).toBe(true);
  });
});
