'use client';

import { AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useTutorialTrigger } from '../../hooks/useTutorialTrigger';
import { PHASE_STEPS } from '../../data/tutorial/phases';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TutorialBanner } from './TutorialBanner';

/**
 * page.tsx 内に配置する最上位チュートリアル制御コンポーネント。
 * ゲーム状態の監視（useTutorialTrigger）と UI 表示（SpotlightOverlay / TutorialBanner）を担う。
 * z-index: 9400〜9503 で固定表示。StoryOrchestrator（z:10000）より下なので、
 * ストーリーシーン再生中はストーリーが前面に来る。
 */
export function TutorialOrchestrator() {
  const activePhase = useTutorialStore(s => s.activePhase);
  const activeStepIndex = useTutorialStore(s => s.activeStepIndex);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);
  const nextStep = useTutorialStore(s => s.nextStep);
  const skipPhase = useTutorialStore(s => s.skipPhase);

  // ゲーム状態を監視してフェーズを自動発火
  useTutorialTrigger();

  const step = activePhase ? PHASE_STEPS[activePhase][activeStepIndex] : null;

  return (
    <>
      <TutorialBanner />
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
