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

export function useStoryTrigger() {
  const clearedStages = useGameStore(state => state.player?.clearedStages ?? EMPTY_CLEARED_STAGES);
  const currentTab = useGameStore(state => state.currentTab);
  const isDemonMode = useGameStore(state => state.isDemonMode);
  const hasHydrated = useStoryStore(state => state.hasHydrated);
  const storyFlags = useStoryStore(state => state.storyFlags);
  const prevClearedRef = useRef<string[]>([]);
  const prevFlagsRef = useRef<Record<string, boolean>>({});
  const demonSeenRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    const store = useStoryStore.getState();
    if (!store.isViewed('PROLOGUE_00')) {
      store.enqueueScenes(getPrologueSceneIds());
      return;
    }
    if (store.hasFlag('LINE_DEATH_SEEN')) {
      enqueueUnviewed(getFlagSceneIds('LINE_DEATH_SEEN'));
    }
    if (store.hasFlag('CH1_STARTED')) {
      enqueueUnviewed(getFlagSceneIds('CH1_STARTED'));
    }
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    const previous = prevFlagsRef.current;
    prevFlagsRef.current = storyFlags;

    Object.entries(storyFlags).forEach(([flagKey, enabled]) => {
      if (!enabled || previous[flagKey]) return;
      enqueueUnviewed(getFlagSceneIds(flagKey));
    });
  }, [hasHydrated, storyFlags]);

  useEffect(() => {
    if (!hasHydrated || currentTab === 'BATTLE') return;
    const previous = prevClearedRef.current;
    const nextCleared = clearedStages.filter(stageId => !previous.includes(stageId));
    prevClearedRef.current = clearedStages;
    if (nextCleared.length === 0) return;

    nextCleared.forEach(stageId => {
      enqueueUnviewed(getStageClearSceneIds(stageId));
    });
  }, [clearedStages, currentTab, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || !isDemonMode || demonSeenRef.current) return;
    const store = useStoryStore.getState();
    if (store.hasFlag('DEMONIZE_STORY_SEEN') || store.isViewed('CH1_DEMONIZE_FIRST')) return;
    demonSeenRef.current = true;
    store.enqueueScenes(getDemonizeFirstSceneIds());
  }, [hasHydrated, isDemonMode]);

  const triggerStageEnter = useCallback((stageId: string) => {
    if (!useStoryStore.getState().hasHydrated) return false;
    return enqueueUnviewed(getStageEnterSceneIds(stageId)).length > 0;
  }, []);

  return { triggerStageEnter };
}
