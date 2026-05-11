'use client';

import { AnimatePresence } from 'framer-motion';
import { useStoryStore } from '../../store/useStoryStore';
import { useGameStore } from '../../store/useGameStore';
import { ChapterTitleCard } from './ChapterTitleCard';
import { DialogueScene } from './DialogueScene';
import { MonologueOverlay } from './MonologueOverlay';
import { EnvironmentCaption } from './EnvironmentCaption';

interface Props {
  children: React.ReactNode;
}

export function StoryOrchestrator({ children }: Props) {
  const activeScene = useStoryStore(state => state.activeScene);
  const dismissScene = useStoryStore(state => state.dismissScene);
  const setCurrentTab = useGameStore(state => state.setCurrentTab);

  const completeScene = () => {
    const scene = useStoryStore.getState().activeScene;
    dismissScene();
    const tab = scene?.onComplete?.navigateTo;
    if (tab === 'HOME' || tab === 'MAP' || tab === 'BATTLE' || tab === 'EQUIP' || tab === 'LAB' || tab === 'LOGS' || tab === 'JOB') {
      setCurrentTab(tab);
    }
  };

  return (
    <>
      {children}
      <AnimatePresence mode="wait">
        {activeScene?.type === 'CHAPTER_TITLE' && (
          <ChapterTitleCard key={activeScene.id} scene={activeScene} onDone={completeScene} />
        )}
        {activeScene?.type === 'DIALOGUE' && (
          <DialogueScene key={activeScene.id} scene={activeScene} onDone={completeScene} onSkip={completeScene} />
        )}
        {activeScene?.type === 'MONOLOGUE' && (
          <MonologueOverlay key={activeScene.id} scene={activeScene} onDone={completeScene} />
        )}
        {activeScene?.type === 'ENVIRONMENT' && (
          <EnvironmentCaption key={activeScene.id} scene={activeScene} onDone={completeScene} />
        )}
      </AnimatePresence>
    </>
  );
}
