import { ALL_PHASES, PHASE_STEPS, type TutorialPhase } from '../data/tutorial/phases';
import {
  getTutorialPersistenceScope,
  getTutorialStorageKeyForScope,
  switchTutorialPersistenceScope,
  useTutorialStore,
} from './useTutorialStore';

async function clearTutorialScope(userId: string | null) {
  await switchTutorialPersistenceScope(userId);
  useTutorialStore.getState().resetTutorial();
}

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

describe('useTutorialStore persistence scopes', () => {
  beforeEach(async () => {
    await clearTutorialScope(null);
    await clearTutorialScope('tutorial-user-a');
    await clearTutorialScope('tutorial-user-b');
    await switchTutorialPersistenceScope(null);
  });

  test('builds stable storage keys for authenticated users', () => {
    const scope = getTutorialPersistenceScope(' user/a@example.test ');

    expect(scope).toBe(`user:${encodeURIComponent('user/a@example.test')}`);
    expect(getTutorialStorageKeyForScope(scope)).toBe(`necro-tutorial-store-v2:${scope}`);
    expect(getTutorialStorageKeyForScope(null)).toBe('necro-tutorial-store-v2');
  });

  test('does not carry guest tutorial progress into an authenticated user scope', async () => {
    await switchTutorialPersistenceScope(null);
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(true);
    useTutorialStore.getState().skipPhase();
    useTutorialStore.getState().markHintViewed('guest_hint');
    useTutorialStore.getState().markTabVisited('EQUIP');

    await switchTutorialPersistenceScope('tutorial-user-a');

    expect(useTutorialStore.getState().completedPhases).toEqual([]);
    expect(useTutorialStore.getState().tutorialCompleted).toBe(false);
    expect(useTutorialStore.getState().viewedHints).toEqual([]);
    expect(useTutorialStore.getState().visitedTabs).toEqual([]);
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(true);
  });

  test('isolates completed phases and hints between authenticated users', async () => {
    await switchTutorialPersistenceScope('tutorial-user-a');
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(true);
    useTutorialStore.getState().skipPhase();
    useTutorialStore.getState().markHintViewed('user-a-hint');
    useTutorialStore.getState().markTabVisited('EQUIP');

    await switchTutorialPersistenceScope('tutorial-user-b');
    expect(useTutorialStore.getState().completedPhases).toEqual([]);
    expect(useTutorialStore.getState().tutorialCompleted).toBe(false);
    expect(useTutorialStore.getState().viewedHints).toEqual([]);
    expect(useTutorialStore.getState().visitedTabs).toEqual([]);

    expect(useTutorialStore.getState().startPhase('DEMONIZATION')).toBe(true);
    useTutorialStore.getState().skipPhase();
    useTutorialStore.getState().markHintViewed('user-b-hint');

    await switchTutorialPersistenceScope('tutorial-user-a');
    expect(useTutorialStore.getState().completedPhases).toEqual(['BATTLE_BASICS']);
    expect(useTutorialStore.getState().completedPhases).not.toContain('DEMONIZATION');
    expect(useTutorialStore.getState().viewedHints).toEqual(['user-a-hint']);
    expect(useTutorialStore.getState().visitedTabs).toEqual(['EQUIP']);
  });
});

describe('useTutorialStore', () => {
  beforeEach(() => {
    resetStore();
  });

  test('starts a single phase and completes it step by step', () => {
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(true);
    expect(useTutorialStore.getState().activePhase).toBe('BATTLE_BASICS');
    expect(useTutorialStore.getState().startPhase('WEAPON_EQUIP')).toBe(false);

    PHASE_STEPS.BATTLE_BASICS.forEach(() => {
      useTutorialStore.getState().nextStep();
    });

    expect(useTutorialStore.getState().activePhase).toBeNull();
    expect(useTutorialStore.getState().completedPhases).toEqual(['BATTLE_BASICS']);
    expect(useTutorialStore.getState().startPhase('BATTLE_BASICS')).toBe(false);
  });

  test('skipPhase records completion without duplicates', () => {
    expect(useTutorialStore.getState().startPhase('WEAPON_EQUIP')).toBe(true);
    useTutorialStore.getState().skipPhase();
    expect(useTutorialStore.getState().completedPhases).toEqual(['WEAPON_EQUIP']);

    expect(useTutorialStore.getState().startPhase('WEAPON_EQUIP')).toBe(false);
    useTutorialStore.getState().skipPhase();
    expect(useTutorialStore.getState().completedPhases).toEqual(['WEAPON_EQUIP']);
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
    useTutorialStore.getState().enqueueBanner('DEMONIZATION');
    useTutorialStore.getState().enqueueBanner('DEMONIZATION');
    useTutorialStore.getState().markTabVisited('EQUIP');
    useTutorialStore.getState().markTabVisited('EQUIP');

    expect(useTutorialStore.getState().viewedHints).toEqual(['legion_cost_first']);
    expect(useTutorialStore.getState().bannerQueue).toEqual(['DEMONIZATION']);
    expect(useTutorialStore.getState().visitedTabs).toEqual(['EQUIP']);
  });
});
