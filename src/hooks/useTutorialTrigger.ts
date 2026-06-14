'use client';

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useStoryStore } from '../store/useStoryStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { ALL_PHASES, type TutorialPhase } from '../data/tutorial/phases';
import { isAbyssalResidueUnlocked } from '../logic/AbyssalResidueUnlockSystem';

const EMPTY_CLEARED_STAGES: string[] = [];

export function useTutorialTrigger() {
  const tutorialHydrated = useTutorialStore(s => s.hasHydrated);
  const storyHydrated = useStoryStore(s => s.hasHydrated);
  const completedPhases = useTutorialStore(s => s.completedPhases);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);

  const clearedStages = useGameStore(s => s.player?.clearedStages ?? EMPTY_CLEARED_STAGES);
  const isDemonMode = useGameStore(s => s.isDemonMode);

  // ストーリーフラグでプロローグ完了を検出
  const lineDeathSeen = useStoryStore(s => s.storyFlags['LINE_DEATH_SEEN'] === true);

  useEffect(() => {
    if (!tutorialHydrated || !storyHydrated) return;
    if (tutorialCompleted) return;

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

    // PHASE 1: プロローグ完了後（LINE_DEATH_SEEN）→ バトル基礎
    // 注: ステップはバトル開始時に BattleCanvas → startTutorialBattlePhase() で発火
    //     ここでは「フェーズ解放済みとして初期化」はしない
    //     BATTLE_BASICS は BattleCanvas 単独で管理する
    if (!lineDeathSeen) return;

    // PHASE 2: area1_node1 初回クリア後 → パーティ編成
    if (
      clearedStages.includes('area1_node1') &&
      hasCompleted('BATTLE_BASICS') &&
      !hasCompleted('PARTY_FORMATION')
    ) {
      tryStartPhase('PARTY_FORMATION');
      return;
    }

    // PHASE 3: area1_node2 初回クリア後 → 武器装備
    if (
      clearedStages.includes('area1_node2') &&
      hasCompleted('PARTY_FORMATION') &&
      !hasCompleted('WEAPON_EQUIP')
    ) {
      tryStartPhase('WEAPON_EQUIP');
      return;
    }

    // PHASE 4: 武器装備後 → 職業転職
    if (
      clearedStages.includes('area1_node2') &&
      hasCompleted('WEAPON_EQUIP') &&
      !hasCompleted('JOB_CHANGE')
    ) {
      tryStartPhase('JOB_CHANGE');
      return;
    }

    // PHASE 5: 第1章ボス撃破後 → 武器強化
    if (
      clearedStages.includes('area1_boss') &&
      hasCompleted('JOB_CHANGE') &&
      !hasCompleted('WEAPON_ENHANCE')
    ) {
      tryStartPhase('WEAPON_ENHANCE');
      return;
    }

    // PHASE 6: 武器強化後 → 魔神化
    if (
      clearedStages.includes('area1_boss') &&
      hasCompleted('WEAPON_ENHANCE') &&
      !hasCompleted('DEMONIZATION')
    ) {
      tryStartPhase('DEMONIZATION');
      return;
    }

    // PHASE 7: 血沼の渡しクリア後 → 深淵の残滓
    if (
      isAbyssalResidueUnlocked(clearedStages) &&
      hasCompleted('DEMONIZATION') &&
      !hasCompleted('ABYSSAL_RESIDUE')
    ) {
      tryStartPhase('ABYSSAL_RESIDUE');
    }
  }, [
    tutorialHydrated, storyHydrated, tutorialCompleted,
    lineDeathSeen, clearedStages, completedPhases,
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
export function startTutorialBattlePhase(stageId: string) {
  const tutorialStageIds = new Set(['tutorial_battle_01', 'area1_node1']);
  if (!tutorialStageIds.has(stageId)) return;

  const story = useStoryStore.getState();
  if (!story.hasFlag('LINE_DEATH_SEEN')) return;

  const { completedPhases, startPhase, enqueueBanner } = useTutorialStore.getState();
  if (!completedPhases.includes('BATTLE_BASICS') && startPhase('BATTLE_BASICS')) {
    enqueueBanner('BATTLE_BASICS');
  }
}
