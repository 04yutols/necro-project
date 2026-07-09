'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useStoryStore } from '../store/useStoryStore';
import {
  getDemonizeFirstSceneIds,
  getFlagSceneIds,
  getPrologueSceneIds,
  getStageClearSceneIds,
  getStageEnterSceneIds,
} from '../data/story';

const EMPTY_CLEARED_STAGES: string[] = [];

function enqueueUnviewed(sceneIds: string[]) {
  const store = useStoryStore.getState();
  return store.enqueueScenes(sceneIds.filter(id => !store.isViewed(id)));
}

export function enqueueInitialStoryScenes(hasPlayer: boolean, canPresentStory = true) {
  if (!hasPlayer || !canPresentStory) return [];

  const store = useStoryStore.getState();
  if (!store.isViewed('PROLOGUE_00')) {
    return store.enqueueScenes(getPrologueSceneIds());
  }

  const enqueued: string[] = [];
  if (store.hasFlag('LINE_DEATH_SEEN')) {
    enqueued.push(...enqueueUnviewed(getFlagSceneIds('LINE_DEATH_SEEN')));
  }
  if (store.hasFlag('CH1_STARTED')) {
    enqueued.push(...enqueueUnviewed(getFlagSceneIds('CH1_STARTED')));
  }
  return enqueued;
}

export function useStoryTrigger(canPresentStory = true) {
  const clearedStages = useGameStore(state => state.player?.clearedStages ?? EMPTY_CLEARED_STAGES);
  const hasPlayer = useGameStore(state => state.player != null);
  const currentTab = useGameStore(state => state.currentTab);
  const isDemonMode = useGameStore(state => state.isDemonMode);
  const hasHydrated = useStoryStore(state => state.hasHydrated);
  const storyFlags = useStoryStore(state => state.storyFlags);
  const prevClearedRef = useRef<string[]>([]);
  const prevFlagsRef = useRef<Record<string, boolean>>({});
  const demonSeenRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !canPresentStory) return;
    enqueueInitialStoryScenes(hasPlayer, canPresentStory);
  }, [canPresentStory, hasHydrated, hasPlayer]);

  useEffect(() => {
    if (!hasHydrated || !canPresentStory) return;
    const previous = prevFlagsRef.current;
    prevFlagsRef.current = storyFlags;

    Object.entries(storyFlags).forEach(([flagKey, enabled]) => {
      if (!enabled || previous[flagKey]) return;
      enqueueUnviewed(getFlagSceneIds(flagKey));
    });
  }, [canPresentStory, hasHydrated, storyFlags]);

  useEffect(() => {
    if (!hasHydrated || !canPresentStory || currentTab === 'BATTLE') return;
    const previous = prevClearedRef.current;
    const nextCleared = clearedStages.filter(stageId => !previous.includes(stageId));
    prevClearedRef.current = clearedStages;
    if (nextCleared.length === 0) return;

    nextCleared.forEach(stageId => {
      enqueueUnviewed(getStageClearSceneIds(stageId));
    });
  }, [canPresentStory, clearedStages, currentTab, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || !canPresentStory || !isDemonMode || demonSeenRef.current) return;
    const store = useStoryStore.getState();
    if (store.hasFlag('DEMONIZE_STORY_SEEN') || store.isViewed('CH1_DEMONIZE_FIRST')) return;
    demonSeenRef.current = true;
    store.enqueueScenes(getDemonizeFirstSceneIds());
  }, [canPresentStory, hasHydrated, isDemonMode]);

  const triggerStageEnter = useCallback((stageId: string) => {
    if (!canPresentStory) return false;
    if (!useStoryStore.getState().hasHydrated) return false;
    return enqueueUnviewed(getStageEnterSceneIds(stageId)).length > 0;
  }, [canPresentStory]);

  return { triggerStageEnter };
}
