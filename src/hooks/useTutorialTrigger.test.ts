import { startTutorialBattlePhase } from './useTutorialTrigger';
import { useTutorialStore } from '../store/useTutorialStore';

function resetTutorialStore() {
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

describe('tutorial trigger hooks', () => {
  beforeEach(() => {
    resetTutorialStore();
  });

  test('starts battle basics on the first chapter battle without depending on story flags', () => {
    expect(startTutorialBattlePhase('area1_node1')).toBe(true);

    const state = useTutorialStore.getState();
    expect(state.activePhase).toBe('BATTLE_BASICS');
    expect(state.bannerQueue).toEqual(['BATTLE_BASICS']);
  });

  test('does not restart battle basics once active or completed', () => {
    expect(startTutorialBattlePhase('area1_node1')).toBe(true);
    expect(startTutorialBattlePhase('area1_node1')).toBe(false);

    useTutorialStore.getState().skipPhase();
    expect(startTutorialBattlePhase('area1_node1')).toBe(false);
  });

  test('ignores non-tutorial battle stages', () => {
    expect(startTutorialBattlePhase('area1_a2')).toBe(false);
    expect(useTutorialStore.getState().activePhase).toBeNull();
  });
});
