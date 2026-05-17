import { test, expect } from '@playwright/test';
import { openHomeSection, prepareE2EPage } from './helpers/e2e';

test.describe('Necro Lab residue UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await openHomeSection(page, 'ネクロラボ');
  });

  test('shows residue slots, residue inventory, and enhancement flow entry points', async ({ page }) => {
    await expect(page.getByText('NECRO-LAB')).toBeVisible();
    await expect(page.getByText('Rank 1')).toBeVisible();
    await expect(page.locator('#tut-residue-slots')).toBeVisible();
    await expect(page.locator('#tut-residue-grid')).toBeVisible();
    await expect(page.getByText(/残滓一覧/)).toBeVisible();

    await page.locator('#tut-enhance-tab').click();
    await expect(page.getByText('STAT PREVIEW')).toBeVisible();
    await expect(page.getByText('SOUL INFUSION')).toBeVisible();
    await expect(page.getByRole('button', { name: /一括選択/ })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^強 化$/ }).last()).toBeVisible();
  });
});
