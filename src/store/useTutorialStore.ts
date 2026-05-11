import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

  startPhase: (phase: TutorialPhase) => void;
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
        const { completedPhases, activePhase } = get();
        if (completedPhases.includes(phase) || activePhase === phase) return;
        set({ activePhase: phase, activeStepIndex: 0 });
      },

      nextStep: () => {
        const { activePhase, activeStepIndex } = get();
        if (!activePhase) return;
        const steps = PHASE_STEPS[activePhase];
        if (activeStepIndex + 1 >= steps.length) {
          const newCompleted = [...get().completedPhases, activePhase];
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
        const newCompleted = [...get().completedPhases, activePhase];
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

      completeTutorial: () => set({ tutorialCompleted: true }),

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
