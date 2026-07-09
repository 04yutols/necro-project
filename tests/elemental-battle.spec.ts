import { test, expect } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.describe('Elemental battle UX', () => {
  test.describe.configure({ timeout: 60000 });
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await startFirstDungeonBattle(page);
  });

  test('shows attack-type metadata for the currently unlocked battle skill', async ({ page }) => {
    await page.locator('#tut-skill-btn').click();

    await expect(page.getByText(/無\/斬撃/)).toBeVisible();
    await expect(page.getByText('渾身斬り')).toBeVisible();
    await expect(page.getByText('雷鳴斬り')).toHaveCount(0);
  });

  test('tracks soul gauge progression after attacks', async ({ page }) => {
    const soulGauge = page.locator('#tut-soul-gauge');
    await expect(soulGauge).toContainText('0%');

    await page.locator('#tut-attack-btn').click();
    await expect(soulGauge).toContainText(/[1-9]\d?%|100%/, { timeout: 10000 });
  });
});
