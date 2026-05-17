import { test, expect } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.describe('Elemental battle UX', () => {
  test.describe.configure({ timeout: 60000 });
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await startFirstDungeonBattle(page);
  });

  test('shows elemental and attack-type metadata for available battle skills', async ({ page }) => {
    await page.locator('#tut-skill-btn').click();

    await expect(page.getByText(/炎\/斬撃|雷\/斬撃|風\/斬撃|光\/斬撃/)).toBeVisible();
    await expect(page.getByText('雷鳴斬り')).toBeVisible();
    await expect(page.getByText('ホーリークロス')).toBeVisible();
  });

  test('tracks soul gauge progression after attacks', async ({ page }) => {
    await expect(page.locator('#tut-soul-gauge')).toContainText('45%');

    await page.locator('#tut-attack-btn').click();
    await expect(page.getByTestId('battle-log')).toContainText('骸骨騎士の攻撃', { timeout: 5000 });
    await expect(page.locator('#tut-soul-gauge')).toContainText(/55%|63%|MAX/, { timeout: 10000 });
  });
});
