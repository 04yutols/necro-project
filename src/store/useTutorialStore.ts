import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { type TutorialPhase, ALL_PHASES, PHASE_STEPS } from '../data/tutorial/phases';

interface TutorialState {
  completedPhases: TutorialPhase[];
  activePhase: TutorialPhase | null;
  activeStepIndex: number;
  tutorialCompleted: boolean;
  viewedHints: string[];
  bannerQueue: TutorialPhase[];
  visitedTabs: string[];
  hasHydrated: boolean;

  startPhase: (phase: TutorialPhase) => boolean;
  nextStep: () => void;
  skipPhase: () => void;
  markHintViewed: (hintId: string) => void;
  isHintViewed: (hintId: string) => boolean;
  enqueueBanner: (phase: TutorialPhase) => void;
  dismissBanner: () => void;
  markTabVisited: (tab: string) => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  setHasHydrated: (value: boolean) => void;
}

const memoryStorage: StateStorage = (() => {
  const storage = new Map<string, string>();
  return {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => {
      storage.set(name, value);
    },
    removeItem: (name) => {
      storage.delete(name);
    },
  };
})();

const getTutorialStorage = (): StateStorage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
};

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      completedPhases: [],
      activePhase: null,
      activeStepIndex: 0,
      tutorialCompleted: false,
      viewedHints: [],
      bannerQueue: [],
      visitedTabs: [],
      hasHydrated: false,

      startPhase: (phase) => {
        const { completedPhases, activePhase, tutorialCompleted } = get();
        if (tutorialCompleted || completedPhases.includes(phase) || activePhase) return false;
        set({ activePhase: phase, activeStepIndex: 0 });
        return true;
      },

      nextStep: () => {
        const { activePhase, activeStepIndex } = get();
        if (!activePhase) return;
        const steps = PHASE_STEPS[activePhase];
        if (activeStepIndex + 1 >= steps.length) {
          const newCompleted = get().completedPhases.includes(activePhase)
            ? get().completedPhases
            : [...get().completedPhases, activePhase];
          set({
            completedPhases: newCompleted,
            activePhase: null,
            activeStepIndex: 0,
            tutorialCompleted: ALL_PHASES.every(p => newCompleted.includes(p)),
          });
        } else {
          set({ activeStepIndex: activeStepIndex + 1 });
        }
      },

      skipPhase: () => {
        const { activePhase } = get();
        if (!activePhase) return;
        const newCompleted = get().completedPhases.includes(activePhase)
          ? get().completedPhases
          : [...get().completedPhases, activePhase];
        set({
          completedPhases: newCompleted,
          activePhase: null,
          activeStepIndex: 0,
          tutorialCompleted: ALL_PHASES.every(p => newCompleted.includes(p)),
        });
      },

      markHintViewed: (hintId) =>
        set(s => ({
          viewedHints: s.viewedHints.includes(hintId) ? s.viewedHints : [...s.viewedHints, hintId],
        })),

      isHintViewed: (hintId) => get().viewedHints.includes(hintId),

      enqueueBanner: (phase) =>
        set(s => ({
          bannerQueue: s.bannerQueue.includes(phase) ? s.bannerQueue : [...s.bannerQueue, phase],
        })),

      dismissBanner: () => set(s => ({ bannerQueue: s.bannerQueue.slice(1) })),

      markTabVisited: (tab) =>
        set(s => ({
          visitedTabs: s.visitedTabs.includes(tab) ? s.visitedTabs : [...s.visitedTabs, tab],
        })),

      completeTutorial: () => set({
        completedPhases: ALL_PHASES,
        activePhase: null,
        activeStepIndex: 0,
        bannerQueue: [],
        tutorialCompleted: true,
      }),

      resetTutorial: () =>
        set({
          completedPhases: [],
          activePhase: null,
          activeStepIndex: 0,
          tutorialCompleted: false,
          viewedHints: [],
          bannerQueue: [],
          visitedTabs: [],
        }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'necro-tutorial-store-v1',
      storage: createJSONStorage(getTutorialStorage),
      partialize: s => ({
        completedPhases: s.completedPhases,
        tutorialCompleted: s.tutorialCompleted,
        viewedHints: s.viewedHints,
        visitedTabs: s.visitedTabs,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
