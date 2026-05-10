'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useStoryStore } from '../store/useStoryStore';

export function useStoryTrigger() {
  const clearedStages = useGameStore(s => s.player?.clearedStages ?? []);
  const currentTab = useGameStore(s => s.currentTab);
  const { enqueueScene, isViewed, hasFlag } = useStoryStore();
  const prevClearedRef = useRef<string[]>([]);

  // 初回起動: プロローグ未読なら発火（同期findSceneになったのでawait不要）
  useEffect(() => {
    if (!isViewed('PROLOGUE_00')) {
      enqueueScene('PROLOGUE_00');
      enqueueScene('PROLOGUE_01');
      enqueueScene('PROLOGUE_02');
      enqueueScene('PROLOGUE_03');
    } else if (!isViewed('CH1_TITLE') && hasFlag('LINE_DEATH_SEEN')) {
      enqueueScene('CH1_TITLE');
    }
  }, []);

  // ステージクリア監視
  useEffect(() => {
    const prev = prevClearedRef.current;
    const newStages = clearedStages.filter(s => !prev.includes(s));
    prevClearedRef.current = clearedStages;

    if (newStages.length === 0) return;
    if (currentTab === 'BATTLE') return; // バトル中は保留

    const STAGE_CLEAR_MAP: Record<string, string[]> = {
      'area1_node1': ['CH1_NODE1_AFTER'],
    };

    const BOSS_CLEAR_MAP: Record<string, string[]> = {
      'area1_boss': ['CH1_BOSS_AFTER', 'CH1_CLEAR'],
    };

    for (const stageId of newStages) {
      const scenes = STAGE_CLEAR_MAP[stageId] ?? [];
      for (const id of scenes) {
        if (!isViewed(id)) enqueueScene(id);
      }
      const bossScenes = BOSS_CLEAR_MAP[stageId] ?? [];
      for (const id of bossScenes) {
        if (!isViewed(id)) enqueueScene(id);
      }
    }
  }, [clearedStages, currentTab]);
}
