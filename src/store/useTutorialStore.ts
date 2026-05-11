import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type TutorialPhase, ALL_PHASES, PHASE_STEPS } from '../data/tutorial/phases';

interface TutorialState {
  completedPhases: TutorialPhase[];
  activePhase: TutorialPhase | null;
  activeStepIndex: number;
  tutorialCompleted: boolean;
  viewedHints: string[];
  /** 新機能バナーのキュー（フェーズID） */
  bannerQueue: TutorialPhase[];

  startPhase: (phase: TutorialPhase) => void;
  nextStep: () => void;
  skipPhase: () => void;
  markHintViewed: (hintId: string) => void;
  isHintViewed: (hintId: string) => boolean;
  enqueueBanner: (phase: TutorialPhase) => void;
  dismissBanner: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
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

      startPhase: (phase) => {
        const { completedPhases, activePhase } = get();
        if (completedPhases.includes(phase) || activePhase === phase) return;
        set({ activePhase: phase, activeStepIndex: 0 });
      },

      nextStep: () => {
        const { activePhase, activeStepIndex } = get();
        if (!activePhase) return;
        const steps = PHASE_STEPS[activePhase];
        const isLastStep = activeStepIndex + 1 >= steps.length;
        if (isLastStep) {
          const newCompleted = [...get().completedPhases, activePhase];
          const allDone = ALL_PHASES.every(p => newCompleted.includes(p));
          set({
            completedPhases: newCompleted,
            activePhase: null,
            activeStepIndex: 0,
            tutorialCompleted: allDone,
          });
        } else {
          set({ activeStepIndex: activeStepIndex + 1 });
        }
      },

      skipPhase: () => {
        const { activePhase } = get();
        if (!activePhase) return;
        const newCompleted = [...get().completedPhases, activePhase];
        const allDone = ALL_PHASES.every(p => newCompleted.includes(p));
        set({
          completedPhases: newCompleted,
          activePhase: null,
          activeStepIndex: 0,
          tutorialCompleted: allDone,
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

      dismissBanner: () =>
        set(s => ({ bannerQueue: s.bannerQueue.slice(1) })),

      completeTutorial: () => set({ tutorialCompleted: true }),

      resetTutorial: () =>
        set({
          completedPhases: [],
          activePhase: null,
          activeStepIndex: 0,
          tutorialCompleted: false,
          viewedHints: [],
          bannerQueue: [],
        }),
    }),
    { name: 'tutorial-store' }
  )
);
