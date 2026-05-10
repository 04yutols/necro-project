import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoryScene } from '../types/story';
import { findScene } from '../data/story/index';

interface StoryStoreState {
  activeScene: StoryScene | null;
  sceneQueue: string[];
  viewedScenes: string[];
  storyFlags: Record<string, boolean>;

  enqueueScene: (sceneId: string) => void;
  dismissScene: () => void;
  markViewed: (sceneId: string) => void;
  setFlag: (flagKey: string) => void;
  hasFlag: (flagKey: string) => boolean;
  isViewed: (sceneId: string) => boolean;
}

export const useStoryStore = create<StoryStoreState>()(
  persist(
    (set, get) => ({
      activeScene: null,
      sceneQueue: [],
      viewedScenes: [],
      storyFlags: {},

      enqueueScene: (sceneId) => {
        const { sceneQueue, activeScene, viewedScenes } = get();
        if (viewedScenes.includes(sceneId)) return;
        if (!activeScene) {
          const scene = findScene(sceneId);
          if (scene) set({ activeScene: scene });
        } else {
          if (!sceneQueue.includes(sceneId)) {
            set({ sceneQueue: [...sceneQueue, sceneId] });
          }
        }
      },

      dismissScene: () => {
        const { sceneQueue, activeScene } = get();
        if (activeScene) {
          get().markViewed(activeScene.id);
          if (activeScene.onComplete?.setFlag) {
            get().setFlag(activeScene.onComplete.setFlag);
          }
        }
        const [next, ...rest] = sceneQueue;
        if (next) {
          const scene = findScene(next);
          set({ activeScene: scene ?? null, sceneQueue: rest });
        } else {
          set({ activeScene: null, sceneQueue: [] });
        }
      },

      markViewed: (sceneId) =>
        set(s => ({
          viewedScenes: s.viewedScenes.includes(sceneId)
            ? s.viewedScenes
            : [...s.viewedScenes, sceneId],
        })),

      setFlag: (flagKey) =>
        set(s => ({ storyFlags: { ...s.storyFlags, [flagKey]: true } })),

      hasFlag: (flagKey) => get().storyFlags[flagKey] === true,

      isViewed: (sceneId) => get().viewedScenes.includes(sceneId),
    }),
    {
      name: 'story-store',
      partialize: (s) => ({
        viewedScenes: s.viewedScenes,
        storyFlags: s.storyFlags,
      }),
    }
  )
);
