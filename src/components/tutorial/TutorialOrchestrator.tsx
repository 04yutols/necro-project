'use client';

import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useTutorialTrigger } from '../../hooks/useTutorialTrigger';
import { PHASE_STEPS } from '../../data/tutorial/phases';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TutorialBanner } from './TutorialBanner';
import { useGameStore } from '../../store/useGameStore';
import { useStoryStore } from '../../store/useStoryStore';

/**
 * page.tsx 内に配置する最上位チュートリアル制御コンポーネント。
 * ゲーム状態の監視（useTutorialTrigger）と UI 表示（SpotlightOverlay / TutorialBanner）を担う。
 * 通常フェーズ: z:9500〜9503。バトルフェーズ: z:10001〜10004（BattleCanvas z:9999より上）。
 * StoryOrchestrator（z:10000）より下なので、ストーリーシーン再生中はストーリーが前面に来る。
 * バトルフェーズのみ z:10001 を使用するため、ストーリーより下だが BattleCanvas より上になる。
 */
export function TutorialOrchestrator() {
  const activePhase = useTutorialStore(s => s.activePhase);
  const activeStepIndex = useTutorialStore(s => s.activeStepIndex);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);
  const nextStep = useTutorialStore(s => s.nextStep);
  const skipPhase = useTutorialStore(s => s.skipPhase);
  const markTabVisited = useTutorialStore(s => s.markTabVisited);

  const currentTab = useGameStore(s => s.currentTab);
  const activeStoryScene = useStoryStore(s => s.activeScene);

  // ゲーム状態を監視してフェーズを自動発火
  useTutorialTrigger();

  // タブ訪問を記録
  useEffect(() => {
    markTabVisited(currentTab);
  }, [currentTab, markTabVisited]);

  const step = activePhase ? PHASE_STEPS[activePhase][activeStepIndex] : null;

  // バトルフェーズは BattleCanvas(z:9999) より上に出す必要がある
  const isBattlePhase = activePhase === 'BATTLE_BASICS' || activePhase === 'DEMONIZATION';
  const zBase = isBattlePhase ? 10001 : 9500;

  // requiredTab が指定されているときは、そのタブにいるときだけ表示
  const tabMatch = !step?.requiredTab || step.requiredTab === currentTab;
  const storyBlocking = Boolean(activeStoryScene);

  return (
    <>
      <TutorialBanner />
      <AnimatePresence>
        {!tutorialCompleted && !storyBlocking && step && tabMatch && (
          <SpotlightOverlay
            key={step.id}
            step={step}
            onNext={nextStep}
            onSkip={skipPhase}
            canSkip={true}
            zBase={zBase}
          />
        )}
      </AnimatePresence>
    </>
  );
}
