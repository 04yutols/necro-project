'use client';

import { useEffect } from 'react';
import type { AuthFlowState } from './useAuthFlow';

const GAME_STORE_KEY = 'necro-game-store-v1';
const STORY_STORE_KEY = 'necro-story-store-v2';
const TUTORIAL_STORE_KEY = 'necro-tutorial-store-v2';

// tests/helpers/e2e.ts の演出スキップ書式を移植（dev シード時にストーリー/チュートリアルで止めない）。
const VIEWED_STORY_SCENES = [
  'PROLOGUE_00', 'PROLOGUE_01', 'PROLOGUE_02', 'PROLOGUE_03',
  'CH1_TITLE', 'CH1_SAFE_INTRO', 'CH1_OPEN', 'CH1_NODE1_AFTER',
  'CH1_DEADCITY_ENTRY', 'CH1_NODE2_ENTER', 'CH1_NODE2_AFTER', 'CH1_FALLEN_TRUTH',
  'CH1_BOSS_ENTER', 'CH1_BOSS_AFTER', 'CH1_NODE3_ENTER', 'CH1_DEMONIZE_FIRST',
  'CH1_NODE3_AFTER', 'CH1_CLEAR', 'CH1_AREA2_UNLOCK',
];

const COMPLETED_TUTORIAL_PHASES = [
  'BATTLE_BASICS', 'PARTY_FORMATION', 'WEAPON_EQUIP', 'DEMONIZATION', 'ABYSSAL_RESIDUE',
];

function writeStoryTutorialSkip() {
  window.localStorage.setItem(STORY_STORE_KEY, JSON.stringify({
    state: {
      viewedScenes: VIEWED_STORY_SCENES,
      storyFlags: {
        LINE_DEATH_SEEN: true,
        CH1_STARTED: true,
        DEMONIZE_STORY_SEEN: true,
        CH1_CLEARED: true,
      },
    },
    version: 0,
  }));
  window.localStorage.setItem(TUTORIAL_STORE_KEY, JSON.stringify({
    state: {
      completedPhases: COMPLETED_TUTORIAL_PHASES,
      activePhase: null,
      activeStepIndex: 0,
      tutorialCompleted: true,
      viewedHints: [],
      visitedTabs: ['HOME', 'MAP', 'BATTLE', 'EQUIP', 'LAB', 'JOB'],
    },
    version: 0,
  }));
}

function stripDevPresetParam(params: URLSearchParams) {
  params.delete('devPreset');
  const query = params.toString();
  const url = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  window.history.replaceState(null, '', url);
}

/**
 * dev 限定: URL の ?devPreset=<PresetName> を検出したらゲストセーブへ進行プリセットを書き込み、
 * パラメータを除去して reload する。ゲストモード専用。本番ビルドでは NODE_ENV ガードにより
 * この効果全体（presets の dynamic import 含む）が除去される。
 */
export function useDevPresetInjection(authStatus: AuthFlowState['status']) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const presetParam = params.get('devPreset');
    if (!presetParam) return;

    // 認証解決前は待機（依存配列で再実行される）。
    if (authStatus === 'checking' || authStatus === 'loadingCharacter') return;

    // ゲストモード専用。サーバーバック（ログイン中）は上書きしないよう警告して無視する。
    if (authStatus !== 'guest') {
      console.warn('[devPreset] ゲストモード専用です。ログイン中は無視します。', { authStatus });
      stripDevPresetParam(params);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { buildPresetSnapshot, isPresetName } = await import('../testing/presets');
      if (cancelled) return;

      if (!isPresetName(presetParam)) {
        console.warn(`[devPreset] 不明なプリセット名: ${presetParam}`);
        stripDevPresetParam(params);
        return;
      }

      const snapshot = buildPresetSnapshot(presetParam);
      if (snapshot) {
        window.localStorage.setItem(GAME_STORE_KEY, JSON.stringify(snapshot));
      } else {
        window.localStorage.removeItem(GAME_STORE_KEY);
      }
      writeStoryTutorialSkip();

      stripDevPresetParam(params);
      window.location.reload();
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);
}
