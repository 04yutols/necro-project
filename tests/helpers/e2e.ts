import { expect, type Page } from '@playwright/test';
import { buildPresetSnapshot, type PresetName } from '../../src/testing/presets';

const VIEWED_STORY_SCENES = [
  'PROLOGUE_00',
  'PROLOGUE_01',
  'PROLOGUE_02',
  'PROLOGUE_03',
  'CH1_TITLE',
  'CH1_SAFE_INTRO',
  'CH1_OPEN',
  'CH1_NODE1_AFTER',
  'CH1_DEADCITY_ENTRY',
  'CH1_NODE2_ENTER',
  'CH1_NODE2_AFTER',
  'CH1_FALLEN_TRUTH',
  'CH1_BOSS_ENTER',
  'CH1_BOSS_AFTER',
  'CH1_NODE3_ENTER',
  'CH1_DEMONIZE_FIRST',
  'CH1_NODE3_AFTER',
  'CH1_CLEAR',
  'CH1_AREA2_UNLOCK',
];

const COMPLETED_TUTORIAL_PHASES = [
  'BATTLE_BASICS',
  'PARTY_FORMATION',
  'WEAPON_EQUIP',
  'DEMONIZATION',
  'ABYSSAL_RESIDUE',
];

interface PrepareE2EPageOptions {
  clearedStages?: string[];
  /** 指定すると進行プリセットの persist スナップショットを注入する（未指定＝従来どおり新規状態）。 */
  preset?: PresetName;
}

/**
 * 進行プリセットの persist スナップショットを localStorage へ注入する（goto 前に呼ぶこと）。
 * 'fresh' は null なので removeItem＝新規状態に委ねる。
 */
export async function seedGameState(page: Page, preset: PresetName) {
  const snapshot = buildPresetSnapshot(preset);
  await page.addInitScript((snap) => {
    if (snap) {
      window.localStorage.setItem('necro-game-store-v1', JSON.stringify(snap));
    } else {
      window.localStorage.removeItem('necro-game-store-v1');
    }
  }, snapshot);
}

export async function prepareE2EPage(page: Page, options: PrepareE2EPageOptions = {}) {
  // intercept auth session to force guest mode (no DB needed in E2E)
  await page.route('**/api/auth/session', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '' });
  });
  await page.route('**/api/auth/**', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '' });
  });

  // preset 指定時のみ game-store を注入し、後段の removeItem をスキップする。
  if (options.preset) {
    await seedGameState(page, options.preset);
  }

  await page.addInitScript(({ storyScenes, tutorialPhases, clearedStages, hasPreset }) => {
    if (!hasPreset) {
      window.localStorage.removeItem('necro-game-store-v1');
    }
    window.localStorage.setItem('necro-story-store-v2', JSON.stringify({
      state: {
        viewedScenes: storyScenes,
        storyFlags: {
          LINE_DEATH_SEEN: true,
          CH1_STARTED: true,
          DEMONIZE_STORY_SEEN: true,
          CH1_CLEARED: true,
        },
      },
      version: 0,
    }));

    window.localStorage.setItem('necro-tutorial-store-v2', JSON.stringify({
      state: {
        completedPhases: tutorialPhases,
        activePhase: null,
        activeStepIndex: 0,
        tutorialCompleted: true,
        viewedHints: [],
        visitedTabs: ['HOME', 'MAP', 'BATTLE', 'EQUIP', 'LAB', 'JOB'],
      },
      version: 0,
    }));

    window.sessionStorage.clear();
    window.sessionStorage.setItem('necro-e2e-cleared-stages', JSON.stringify(clearedStages));
    window.sessionStorage.setItem('necro-e2e-battle-boost', '1');
  }, {
    storyScenes: VIEWED_STORY_SCENES,
    tutorialPhases: COMPLETED_TUTORIAL_PHASES,
    clearedStages: options.clearedStages ?? [],
    hasPreset: Boolean(options.preset),
  });

  await page.goto('/');
  await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('スキップ')).toHaveCount(0);
}

export async function openHomeSection(page: Page, label: string) {
  const section = page.getByRole('button').filter({ hasText: label }).first();
  await expect(section).toBeVisible({ timeout: 10000 });
  await section.click();
}

export async function clickBattleAutoOn(page: Page) {
  const autoButton = page.getByRole('button', { name: /AUTO OFF/ }).first();
  await expect(autoButton).toBeVisible({ timeout: 10000 });
  await autoButton.dispatchEvent('click');
  await expect(page.getByRole('button', { name: /AUTO ON/ }).first()).toBeVisible({ timeout: 5000 });
}

export async function setBattleSpeed(page: Page, speed: 1 | 2 | 3) {
  const speedButton = page.getByRole('button', { name: `×${speed}` }).first();
  await expect(speedButton).toBeVisible({ timeout: 10000 });
  await speedButton.dispatchEvent('click');
}

export async function startFirstDungeonBattle(page: Page) {
  await openHomeSection(page, '出撃・マップ');
  await expect(page.getByText('ワールドマップ')).toBeVisible({ timeout: 10000 });

  const areaSelect = page.getByRole('button', { name: /領域選択/ });
  await expect(areaSelect).toBeVisible({ timeout: 10000 });
  await areaSelect.click({ force: true });

  const enterArea = page.getByRole('button', { name: /エリアマップへ|再訪する/ });
  await expect(enterArea).toBeVisible({ timeout: 10000 });
  await enterArea.click({ force: true });
  await expect(page.getByText('LAYER 2 / AREA MAP')).toBeVisible({ timeout: 10000 });

  const nextInvasion = page.getByRole('button', { name: /次の侵攻/ });
  await expect(nextInvasion).toBeVisible({ timeout: 10000 });
  await nextInvasion.click({ force: true });

  const startInvasion = page.getByRole('button', { name: /侵攻開始|再挑戦/ });
  await expect(startInvasion).toBeVisible({ timeout: 10000 });
  await startInvasion.click({ force: true });
  await expect(page.locator('#tut-attack-btn')).toBeVisible({ timeout: 15000 });
}
