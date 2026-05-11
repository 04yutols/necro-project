'use client';

import { AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useTutorialTrigger } from '../../hooks/useTutorialTrigger';
import { PHASE_STEPS } from '../../data/tutorial/phases';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TutorialBanner } from './TutorialBanner';

export function TutorialOrchestrator() {
  const { activePhase, activeStepIndex, tutorialCompleted, nextStep, skipPhase } = useTutorialStore();
  useTutorialTrigger();

  const step = activePhase ? PHASE_STEPS[activePhase][activeStepIndex] : null;

  return (
    <>
      {/* 新機能解放バナー */}
      <TutorialBanner />

      {/* スポットライトチュートリアル */}
      <AnimatePresence>
        {!tutorialCompleted && step && (
          <SpotlightOverlay
            key={step.id}
            step={step}
            onNext={nextStep}
            onSkip={skipPhase}
            canSkip={true}
          />
        )}
      </AnimatePresence>
    </>
  );
}
