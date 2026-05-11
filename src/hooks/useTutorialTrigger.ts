'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { type TutorialPhase, ALL_PHASES } from '../data/tutorial/phases';

export function useTutorialTrigger() {
  const clearedStages = useGameStore(s => s.player?.clearedStages ?? []);
  const inventoryMonsters = useGameStore(s => s.inventoryMonsters);
  const { completedPhases, tutorialCompleted, startPhase, enqueueBanner } = useTutorialStore();
  const prevClearedRef = useRef<string[]>([]);

  useEffect(() => {
    if (tutorialCompleted) return;

    // PHASE 1: プロローグ完了後（storyフラグで制御）→ バトル基礎は BattleCanvas 側から直接 startPhase
    // ここでは NECRO_LAB 以降を監視する

    // PHASE 2: チュートリアルバトル01クリア後 → 死霊術フェーズ
    if (
      clearedStages.includes('tutorial_battle_01') &&
      !completedPhases.includes('NECRO_LAB') &&
      completedPhases.includes('BATTLE_BASICS')
    ) {
      enqueueBanner('NECRO_LAB');
      startPhase('NECRO_LAB');
    }

    // PHASE 3: モンスター2体以上 + チュートリアルバトル02クリア → 編成フェーズ
    if (
      inventoryMonsters.length >= 2 &&
      clearedStages.includes('tutorial_battle_02') &&
      !completedPhases.includes('PARTY_FORMATION') &&
      completedPhases.includes('NECRO_LAB')
    ) {
      enqueueBanner('PARTY_FORMATION');
      startPhase('PARTY_FORMATION');
    }

    // PHASE 4: モンスター3体以上 + 編成完了後 → 転職フェーズ
    if (
      inventoryMonsters.length >= 3 &&
      completedPhases.includes('PARTY_FORMATION') &&
      !completedPhases.includes('JOB_CHANGE')
    ) {
      enqueueBanner('JOB_CHANGE');
      startPhase('JOB_CHANGE');
    }

    // PHASE 5: AREA1全ステージクリア → 残滓フェーズ
    const area1Stages = ['area1_node1', 'area1_node2', 'area1_node3'];
    if (
      area1Stages.every(s => clearedStages.includes(s)) &&
      completedPhases.includes('JOB_CHANGE') &&
      !completedPhases.includes('ABYSSAL_RESIDUE')
    ) {
      enqueueBanner('ABYSSAL_RESIDUE');
      startPhase('ABYSSAL_RESIDUE');
    }

    // PHASE 6: 第1章ボス撃破後 → 魔神化フェーズ
    if (
      clearedStages.includes('area1_boss') &&
      completedPhases.includes('ABYSSAL_RESIDUE') &&
      !completedPhases.includes('DEMONIZATION')
    ) {
      enqueueBanner('DEMONIZATION');
      startPhase('DEMONIZATION');
    }

    // 全フェーズ完了チェック
    if (ALL_PHASES.every(p => completedPhases.includes(p))) {
      useTutorialStore.getState().completeTutorial();
    }
  }, [clearedStages, inventoryMonsters.length, completedPhases, tutorialCompleted]);

  // ステージクリアの差分検出（不要な重複発火防止）
  useEffect(() => {
    prevClearedRef.current = clearedStages;
  }, [clearedStages]);
}

/** バトル開始時に PHASE 1 を発火する（BattleCanvas から呼ぶ） */
export function triggerBattleBasicsPhase() {
  const { completedPhases, startPhase } = useTutorialStore.getState();
  if (!completedPhases.includes('BATTLE_BASICS')) {
    startPhase('BATTLE_BASICS');
  }
}

export const BANNER_LABELS: Record<TutorialPhase, string> = {
  BATTLE_BASICS:    'バトル基礎を解放',
  NECRO_LAB:        'ネクロラボが解放されました',
  PARTY_FORMATION:  '軍団編成が解放されました',
  JOB_CHANGE:       '職業転職が解放されました',
  ABYSSAL_RESIDUE:  '深淵の残滓が解放されました',
  DEMONIZATION:     '魔神化システムが解放されました',
};
