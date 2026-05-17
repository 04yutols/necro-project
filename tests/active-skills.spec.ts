import { test, expect } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.describe('Battle command UX', () => {
  test.describe.configure({ timeout: 60000 });
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await startFirstDungeonBattle(page);
  });

  test('opens the current skill panel and shows element x attack-type skills', async ({ page }) => {
    await page.locator('#tut-skill-btn').click();

    await expect(page.getByText('術・スキル選択')).toBeVisible();
    await expect(page.getByText('渾身斬り')).toBeVisible();
    await expect(page.getByText('雷鳴斬り')).toBeVisible();
    await expect(page.getByText('鎌鼬')).toBeVisible();
    await expect(page.getByText('ホーリークロス')).toBeVisible();
    await expect(page.getByText(/雷\/斬撃/)).toBeVisible();
    await expect(page.getByText(/風\/斬撃/)).toBeVisible();

    await page.getByText('← 戻る').click();
    await expect(page.locator('#tut-attack-btn')).toContainText('攻撃');
  });

  test('keeps attack and system commands reachable on the mobile battle screen', async ({ page }) => {
    await expect(page.locator('#tut-attack-btn')).toContainText('攻撃');
    await expect(page.locator('#tut-soul-gauge')).toBeVisible();
    await expect(page.getByRole('button', { name: /AUTO OFF/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '×3' })).toBeVisible();
    await expect(page.getByRole('button', { name: '逃走' })).toBeVisible();

    await page.locator('#tut-attack-btn').click();
    await expect(page.getByTestId('battle-log')).toContainText('骸骨騎士の攻撃', { timeout: 5000 });
  });
});
