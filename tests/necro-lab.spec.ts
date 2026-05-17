import { test, expect } from '@playwright/test';
import { openHomeSection, prepareE2EPage } from './helpers/e2e';

test.describe('Legion formation UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await openHomeSection(page, '軍団編成');
  });

  test('shows the current cost and opens the full-screen monster picker from a slot', async ({ page }) => {
    await expect(page.locator('#tut-cost-display')).toContainText('COST');
    await expect(page.locator('#tut-cost-display')).toContainText('8/10');

    await page.getByRole('button', { name: '魔物選択' }).click();

    await expect(page.getByText('魔物選択')).toBeVisible();
    await expect(page.getByText('COST 8/10')).toBeVisible();
    await expect(page.getByText('SORT')).toBeVisible();
    await expect(page.getByText('ゴブリン')).toBeVisible();
    await expect(page.getByText('COST').first()).toBeVisible();
    await expect(page.getByText('ATK').first()).toBeVisible();
  });

  test('opens monster detail from the picker and returns to formation cleanly', async ({ page }) => {
    await page.getByRole('button', { name: '魔物選択' }).click();
    await expect(page.getByText('魔物選択')).toBeVisible();
    await page.locator('button').filter({ hasText: /^詳細$/ }).first().click();

    await expect(page.getByText('MONSTER DETAIL')).toBeVisible();
    await expect(page.getByText('編成後コスト')).toBeVisible();
    await expect(page.getByText('弱点')).toBeVisible();
    await expect(page.getByRole('button', { name: /編成する|コスト不足/ })).toBeVisible();

    await page.getByLabel('魔物選択へ戻る').click();
    await expect(page.getByText('魔物選択')).toBeVisible();
    await page.getByRole('button', { name: '編成へ戻る' }).click();
    await expect(page.locator('#tut-synergy-banner')).toBeVisible();
  });
});
