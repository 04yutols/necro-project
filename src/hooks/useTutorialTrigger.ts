'use client';

import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useStoryStore } from '../store/useStoryStore';
import { useTutorialStore } from '../store/useTutorialStore';

export function useTutorialTrigger() {
  const tutorialHydrated = useTutorialStore(s => s.hasHydrated);
  const storyHydrated = useStoryStore(s => s.hasHydrated);
  const completedPhases = useTutorialStore(s => s.completedPhases);
  const tutorialCompleted = useTutorialStore(s => s.tutorialCompleted);

  const clearedStages = useGameStore(s => s.player?.clearedStages ?? []);
  const monsterCount = useGameStore(s => s.inventoryMonsters.length);
  const isDemonMode = useGameStore(s => s.isDemonMode);

  // ストーリーフラグでプロローグ完了を検出
  const lineDeathSeen = useStoryStore(s => s.storyFlags['LINE_DEATH_SEEN'] === true);

  useEffect(() => {
    if (!tutorialHydrated || !storyHydrated) return;
    if (tutorialCompleted) return;

    const { startPhase, enqueueBanner } = useTutorialStore.getState();

    // PHASE 1: プロローグ完了後（LINE_DEATH_SEEN）→ バトル基礎
    // 注: ステップはバトル開始時に BattleCanvas → startTutorialBattlePhase() で発火
    //     ここでは「フェーズ解放済みとして初期化」はしない
    //     BATTLE_BASICS は BattleCanvas 単独で管理する

    // PHASE 2: tutorial_battle_01 クリア → 死霊術ラボ
    if (
      lineDeathSeen &&
      clearedStages.includes('tutorial_battle_01') &&
      !completedPhases.includes('NECRO_LAB')
    ) {
      enqueueBanner('NECRO_LAB');
      startPhase('NECRO_LAB');
    }

    // PHASE 3: tutorial_battle_02 クリア + モンスター2体以上 → パーティ編成
    if (
      clearedStages.includes('tutorial_battle_02') &&
      monsterCount >= 2 &&
      !completedPhases.includes('PARTY_FORMATION')
    ) {
      enqueueBanner('PARTY_FORMATION');
      startPhase('PARTY_FORMATION');
    }

    // PHASE 4: モンスター3体以上 → 職業転職
    if (
      monsterCount >= 3 &&
      !completedPhases.includes('JOB_CHANGE')
    ) {
      enqueueBanner('JOB_CHANGE');
      startPhase('JOB_CHANGE');
    }

    // PHASE 5: AREA1 全3ノードクリア → 深淵の残滓
    const area1Done = ['area1_node1', 'area1_node2', 'area1_node3'].every(s => clearedStages.includes(s));
    if (
      area1Done &&
      !completedPhases.includes('ABYSSAL_RESIDUE')
    ) {
      enqueueBanner('ABYSSAL_RESIDUE');
      startPhase('ABYSSAL_RESIDUE');
    }

    // PHASE 6: 第1章ボス撃破 → 魔神化
    if (
      clearedStages.includes('area1_boss') &&
      !completedPhases.includes('DEMONIZATION')
    ) {
      enqueueBanner('DEMONIZATION');
      startPhase('DEMONIZATION');
    }
  }, [
    tutorialHydrated, storyHydrated, tutorialCompleted,
    lineDeathSeen, clearedStages, monsterCount, completedPhases,
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
 * tutorial_battle_01 入場時のみ BATTLE_BASICS フェーズを発火する。
 */
export function startTutorialBattlePhase(stageId: string) {
  if (stageId !== 'tutorial_battle_01') return;
  const { completedPhases, startPhase } = useTutorialStore.getState();
  if (!completedPhases.includes('BATTLE_BASICS')) {
    startPhase('BATTLE_BASICS');
  }
}
