'use client';

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useStoryStore } from '../store/useStoryStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { ALL_PHASES, type TutorialPhase } from '../data/tutorial/phases';
import {
  getTutorialPhaseAfterClear,
  shouldEvaluateClearTutorialTrigger,
  shouldStartBattleTutorial,
} from '../data/tutorial/triggers';

const EMPTY_CLEARED_STAGES: string[] = [];

export function useTutorialTrigger() {
  const tutorialHydrated = useTutorialStore(s => s.hasHydrated);
  const storyHydrated = useStoryStore(s => s.hasHydrated);
  const completedPhases = useTutorialStore(s => s.completedPhases);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);

  const clearedStages = useGameStore(s => s.player?.clearedStages ?? EMPTY_CLEARED_STAGES);
  const isDemonMode = useGameStore(s => s.isDemonMode);
  const currentTab = useGameStore(s => s.currentTab);

  // ストーリーフラグでプロローグ完了を検出
  const lineDeathSeen = useStoryStore(s => s.storyFlags['LINE_DEATH_SEEN'] === true);

  useEffect(() => {
    if (!shouldEvaluateClearTutorialTrigger({
      currentTab,
      tutorialHydrated,
      storyHydrated,
      tutorialCompleted,
    })) {
      return;
    }

    const { startPhase, enqueueBanner, completeTutorial } = useTutorialStore.getState();
    const hasCompleted = (phase: TutorialPhase) => completedPhases.includes(phase);
    const tryStartPhase = (phase: TutorialPhase) => {
      const started = startPhase(phase);
      if (started) enqueueBanner(phase);
      return started;
    };

    if (ALL_PHASES.every(hasCompleted)) {
      completeTutorial();
      return;
    }

    const pendingPhase = getTutorialPhaseAfterClear({
      clearedStages,
      completedPhases,
      storyFlags: { LINE_DEATH_SEEN: lineDeathSeen },
    });

    if (pendingPhase) tryStartPhase(pendingPhase);
  }, [
    tutorialHydrated, storyHydrated, tutorialCompleted,
    currentTab, lineDeathSeen, clearedStages, completedPhases,
  ]);

  // 魔神化ゲージ100%→発動時は DEMONIZATION フェーズのステップ2へジャンプ
  useEffect(() => {
    if (!tutorialHydrated || tutorialCompleted) return;
    const { activePhase, activeStepIndex, nextStep } = useTutorialStore.getState();
    if (isDemonMode && activePhase === 'DEMONIZATION' && activeStepIndex === 1) {
      nextStep();
    }
  }, [isDemonMode, tutorialHydrated, tutorialCompleted]);
}

/**
 * バトル開始時に BattleCanvas から呼ぶ。
 * tutorial_battle_01 / 第1章初回ノード入場時に BATTLE_BASICS フェーズを発火する。
 */
export function startTutorialBattlePhase(stageId: string | null | undefined): boolean {
  const { completedPhases, activePhase, tutorialCompleted, startPhase, enqueueBanner } = useTutorialStore.getState();
  if (!shouldStartBattleTutorial({ stageId, completedPhases, activePhase, tutorialCompleted })) {
    return false;
  }

  if (startPhase('BATTLE_BASICS')) {
    enqueueBanner('BATTLE_BASICS');
    return true;
  }

  return false;
}

export function useTutorialBattlePhase(stageId: string | null | undefined) {
  const tutorialHydrated = useTutorialStore(s => s.hasHydrated);
  const storyHydrated = useStoryStore(s => s.hasHydrated);
  const completedPhases = useTutorialStore(s => s.completedPhases);
  const activePhase = useTutorialStore(s => s.activePhase);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);

  useEffect(() => {
    if (!tutorialHydrated || !storyHydrated) return;
    startTutorialBattlePhase(stageId);
  }, [activePhase, completedPhases, stageId, storyHydrated, tutorialCompleted, tutorialHydrated]);
}
