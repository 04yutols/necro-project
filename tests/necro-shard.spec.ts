import { test, expect } from '@playwright/test';
import { openHomeSection, prepareE2EPage } from './helpers/e2e';

test.describe('Necro Lab residue UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('locks the residue lab before chapter 2 progression', async ({ page }) => {
    await prepareE2EPage(page);
    await expect(page.locator('[role="button"]').filter({ hasText: '深淵の残滓' })).toBeVisible();
    await expect(page.locator('[role="button"]').filter({ hasText: 'CHAPTER 2で解放' })).toBeVisible();
  });

  test('shows residue slots, residue inventory, and enhancement flow entry points after chapter 2 unlock', async ({ page }) => {
    await prepareE2EPage(page, {
      clearedStages: ['area1_node1', 'area1_node2', 'area1_boss', 'area1_node3'],
    });
    await openHomeSection(page, 'ネクロラボ');
    await expect(page.getByText('NECRO-LAB')).toBeVisible();
    await expect(page.getByText('Rank 1')).toBeVisible();
    await expect(page.locator('#tut-residue-slots')).toBeVisible();
    await expect(page.locator('#tut-residue-grid')).toBeVisible();
    await expect(page.getByText(/残滓一覧/)).toBeVisible();

    await page.locator('#tut-enhance-tab').click({ force: true });
    await expect(page.getByText('SELECT RESIDUE')).toBeVisible();
    await expect(page.getByText('SOUL INFUSION')).toBeVisible();
    await expect(page.getByRole('button', { name: /一括選択/ })).toBeDisabled();
    await expect(page.locator('button').filter({ hasText: /^強 化$/ }).last()).toBeDisabled();
  });
});
