import { ALL_PHASES, PHASE_STEPS, type TutorialPhase } from '../data/tutorial/phases';
import { useTutorialStore } from './useTutorialStore';

function resetStore() {
  useTutorialStore.setState({
    completedPhases: [],
    activePhase: null,
    activeStepIndex: 0,
    tutorialCompleted: false,
    viewedHints: [],
    bannerQueue: [],
    visitedTabs: [],
    hasHydrated: true,
  });
}

describe('useTutorialStore', () => {
  beforeEach(() => {
    resetStore();
  });

  test('starts a single phase and completes it step by step', () => {
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(true);
    expect(useTutorialStore.getState().activePhase).toBe('BATTLE_BASICS');
    expect(useTutorialStore.getState().startPhase('NECRO_LAB')).toBe(false);

    PHASE_STEPS.BATTLE_BASICS.forEach(() => {
      useTutorialStore.getState().nextStep();
    });

    expect(useTutorialStore.getState().activePhase).toBeNull();
    expect(useTutorialStore.getState().completedPhases).toEqual(['BATTLE_BASICS']);
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(false);
  });

  test('skipPhase records completion without duplicates', () => {
    expect(useTutorialStore.getState().startPhase('NECRO_LAB')).toBe(true);
    useTutorialStore.getState().skipPhase();
    expect(useTutorialStore.getState().completedPhases).toEqual(['NECRO_LAB']);

    expect(useTutorialStore.getState().startPhase('NECRO_LAB')).toBe(false);
    useTutorialStore.getState().skipPhase();
    expect(useTutorialStore.getState().completedPhases).toEqual(['NECRO_LAB']);
  });

  test('marks the tutorial complete after every phase is skipped', () => {
    ALL_PHASES.forEach((phase: TutorialPhase) => {
      expect(useTutorialStore.getState().startPhase(phase)).toBe(true);
      useTutorialStore.getState().skipPhase();
    });

    const state = useTutorialStore.getState();
    expect(state.tutorialCompleted).toBe(true);
    expect(new Set(state.completedPhases)).toEqual(new Set(ALL_PHASES));
  });

  test('deduplicates hints, banners, and visited tabs', () => {
    useTutorialStore.getState().markHintViewed('legion_cost_first');
    useTutorialStore.getState().markHintViewed('legion_cost_first');
    useTutorialStore.getState().enqueueBanner('JOB_CHANGE');
    useTutorialStore.getState().enqueueBanner('JOB_CHANGE');
    useTutorialStore.getState().markTabVisited('EQUIP');
    useTutorialStore.getState().markTabVisited('EQUIP');

    expect(useTutorialStore.getState().viewedHints).toEqual(['legion_cost_first']);
    expect(useTutorialStore.getState().bannerQueue).toEqual(['JOB_CHANGE']);
    expect(useTutorialStore.getState().visitedTabs).toEqual(['EQUIP']);
  });
});
