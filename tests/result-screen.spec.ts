import { test, expect } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.describe('Result and appraisal UX', () => {
  test.describe.configure({ timeout: 120000 });
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await startFirstDungeonBattle(page);
  });

  test('reaches result, transitions to appraisal, and exposes reward reveal controls', async ({ page }) => {
    await page.getByRole('button', { name: '×3' }).click();
    await page.getByRole('button', { name: /AUTO OFF/ }).click();

    await expect(page.getByTestId('result-summary')).toBeVisible({ timeout: 70000 });
    await expect(page.getByText('VICTORY')).toBeVisible();
    await expect(page.getByText('BATTLE REWARDS')).toBeVisible();

    await page.getByRole('button', { name: '鑑定へ進む' }).click();
    await expect(page.getByTestId('appraisal-screen')).toBeVisible();
    await expect(page.getByText('戦利品鑑定')).toBeVisible();

    await page.getByRole('button', { name: /鑑定する/ }).click();
    await expect(page.getByRole('button', { name: /次の戦利品|獲得して戻る/ })).toBeVisible({ timeout: 10000 });
  });
});
