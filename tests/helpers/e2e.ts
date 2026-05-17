import { expect, type Page } from '@playwright/test';

const VIEWED_STORY_SCENES = [
  'PROLOGUE_00',
  'PROLOGUE_01',
  'PROLOGUE_02',
  'PROLOGUE_03',
  'CH1_TITLE',
  'CH1_SAFE_INTRO',
  'CH1_OPEN',
  'CH1_NODE1_AFTER',
  'CH1_NODE2_ENTER',
  'CH1_NODE2_AFTER',
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
  'NECRO_LAB',
  'PARTY_FORMATION',
  'JOB_CHANGE',
  'ABYSSAL_RESIDUE',
  'DEMONIZATION',
];

export async function prepareE2EPage(page: Page) {
  await page.addInitScript(({ storyScenes, tutorialPhases }) => {
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

    window.localStorage.setItem('necro-tutorial-store-v1', JSON.stringify({
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
  }, {
    storyScenes: VIEWED_STORY_SCENES,
    tutorialPhases: COMPLETED_TUTORIAL_PHASES,
  });

  await page.goto('/');
  await expect(page.getByText('拠点', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('スキップ')).toHaveCount(0);
}

export async function openHomeSection(page: Page, label: string) {
  const section = page.locator('[role="button"]').filter({ hasText: label }).first();
  await expect(section).toBeVisible({ timeout: 10000 });
  await section.click();
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
