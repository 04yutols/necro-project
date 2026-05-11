import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoryScene } from '../types/story';
import { findScene } from '../data/story';

type EnqueueOptions = {
  replay?: boolean;
  front?: boolean;
};

interface StoryStoreState {
  activeScene: StoryScene | null;
  sceneQueue: string[];
  viewedScenes: string[];
  storyFlags: Record<string, boolean>;
  hasHydrated: boolean;

  enqueueScene: (sceneId: string, options?: EnqueueOptions) => boolean;
  enqueueScenes: (sceneIds: string[], options?: EnqueueOptions) => string[];
  playScene: (sceneId: string) => boolean;
  dismissScene: () => void;
  skipScene: () => void;
  clearQueue: () => void;
  markViewed: (sceneId: string) => void;
  setFlag: (flagKey: string) => void;
  hasFlag: (flagKey: string) => boolean;
  isViewed: (sceneId: string) => boolean;
  resetStoryProgress: () => void;
  setHasHydrated: (value: boolean) => void;
}

function uniqueAppend(current: string[], next: string[]) {
  const seen = new Set(current);
  const merged = [...current];
  next.forEach(id => {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  });
  return merged;
}

export const useStoryStore = create<StoryStoreState>()(
  persist(
    (set, get) => ({
      activeScene: null,
      sceneQueue: [],
      viewedScenes: [],
      storyFlags: {},
      hasHydrated: false,

      enqueueScene: (sceneId, options = {}) => {
        const scene = findScene(sceneId);
        if (!scene) return false;

        const { activeScene, sceneQueue, viewedScenes } = get();
        const replay = options.replay === true;
        if (!replay && viewedScenes.includes(sceneId)) return false;
        if (activeScene?.id === sceneId || sceneQueue.includes(sceneId)) return false;

        if (!activeScene) {
          set({ activeScene: scene });
          return true;
        }

        set({
          sceneQueue: options.front
            ? [sceneId, ...sceneQueue]
            : [...sceneQueue, sceneId],
        });
        return true;
      },

      enqueueScenes: (sceneIds, options = {}) => {
        const validIds = sceneIds.filter(id => findScene(id));
        if (validIds.length === 0) return [];

        const { activeScene, sceneQueue, viewedScenes } = get();
        const replay = options.replay === true;
        const ids = validIds.filter(id =>
          (replay || !viewedScenes.includes(id)) &&
          activeScene?.id !== id &&
          !sceneQueue.includes(id)
        );
        if (ids.length === 0) return [];

        if (!activeScene) {
          const [first, ...rest] = ids;
          set({
            activeScene: findScene(first),
            sceneQueue: options.front
              ? uniqueAppend(rest, sceneQueue)
              : uniqueAppend(sceneQueue, rest),
          });
          return ids;
        }

        set({
          sceneQueue: options.front
            ? uniqueAppend(ids, sceneQueue)
            : uniqueAppend(sceneQueue, ids),
        });
        return ids;
      },

      playScene: (sceneId) => get().enqueueScene(sceneId, { replay: true, front: true }),

      dismissScene: () => {
        const { activeScene, sceneQueue } = get();
        if (activeScene) {
          get().markViewed(activeScene.id);
          if (activeScene.onComplete?.setFlag) {
            get().setFlag(activeScene.onComplete.setFlag);
          }
        }

        const [next, ...rest] = sceneQueue;
        set({
          activeScene: next ? findScene(next) : null,
          sceneQueue: rest,
        });
      },

      skipScene: () => {
        get().dismissScene();
      },

      clearQueue: () => set({ sceneQueue: [], activeScene: null }),

      markViewed: (sceneId) => {
        if (!sceneId) return;
        set(state => ({
          viewedScenes: state.viewedScenes.includes(sceneId)
            ? state.viewedScenes
            : [...state.viewedScenes, sceneId],
        }));
      },

      setFlag: (flagKey) => {
        if (!flagKey) return;
        set(state => ({ storyFlags: { ...state.storyFlags, [flagKey]: true } }));
      },

      hasFlag: (flagKey) => get().storyFlags[flagKey] === true,

      isViewed: (sceneId) => get().viewedScenes.includes(sceneId),

      resetStoryProgress: () => set({
        activeScene: null,
        sceneQueue: [],
        viewedScenes: [],
        storyFlags: {},
      }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'necro-story-store-v2',
      partialize: state => ({
        viewedScenes: state.viewedScenes,
        storyFlags: state.storyFlags,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
