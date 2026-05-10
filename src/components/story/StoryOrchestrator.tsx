'use client';

import { AnimatePresence } from 'framer-motion';
import { useStoryStore } from '../../store/useStoryStore';
import { ChapterTitleCard } from './ChapterTitleCard';
import { MonologueOverlay } from './MonologueOverlay';
import { EnvironmentCaption } from './EnvironmentCaption';

interface Props {
  children: React.ReactNode;
}

export function StoryOrchestrator({ children }: Props) {
  const { activeScene, dismissScene } = useStoryStore();

  return (
    <>
      {children}
      <AnimatePresence>
        {activeScene?.type === 'CHAPTER_TITLE' && (
          <ChapterTitleCard key={activeScene.id} scene={activeScene} onDone={dismissScene} />
        )}
        {activeScene?.type === 'MONOLOGUE' && (
          <MonologueOverlay key={activeScene.id} scene={activeScene} onDone={dismissScene} />
        )}
        {activeScene?.type === 'ENVIRONMENT' && (
          <EnvironmentCaption key={activeScene.id} scene={activeScene} onDone={dismissScene} />
        )}
      </AnimatePresence>
    </>
  );
}
