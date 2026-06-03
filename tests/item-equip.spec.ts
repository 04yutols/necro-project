import { test, expect } from '@playwright/test';
import { openHomeSection, prepareE2EPage } from './helpers/e2e';

test.describe('Armory and status UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await openHomeSection(page, '装備・編成');
  });

  test('opens the current Legion detail screen and exposes Star-Rail-style stats', async ({ page }) => {
    await expect(page.getByText('LEGION')).toBeVisible();
    await page.getByRole('button', { name: /DETAIL/ }).click();

    await expect(page.getByText('統合詳細ハブ')).toBeVisible();
    await expect(page.getByText('STATUS')).toBeVisible();
    await expect(page.getByText('ATK', { exact: true })).toBeVisible();
    await expect(page.getByText('DEF', { exact: true })).toBeVisible();
    await expect(page.getByText('SPD', { exact: true })).toBeVisible();
    await expect(page.getByText('HP', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '詳細' }).click();
    await expect(page.getByText('STATUS ARCHIVE')).toBeVisible();
    await expect(page.getByText('MAIN STATUS')).toBeVisible();
    await expect(page.getByText('ELEMENT DMG')).toBeVisible();
  });

  test('opens the weapon armory from the current equipment hub', async ({ page }) => {
    await page.getByRole('button', { name: /DETAIL/ }).click();
    await page.getByText('武器').first().click({ force: true });

    await expect(page.getByText('武器庫')).toBeVisible();
    await expect(page.getByText('霊銀の斬骨刀').first()).toBeVisible();
    await expect(page.getByText('WEAPON ATK')).toBeVisible();
    await expect(page.getByText('FINAL ATK')).toBeVisible();

    await page.getByRole('button', { name: /霊銀の斬骨刀/ }).click();
    await expect(page.getByText('2枠 / 20ILvごとに強化')).toBeVisible();
    await expect(page.getByText('属性特化')).toBeVisible();
    await expect(page.getByText('闇属性').first()).toBeVisible();
  });

  test('reforges a weapon by one ILv and previews the next step', async ({ page }) => {
    await page.getByRole('button', { name: /DETAIL/ }).click();
    await page.getByText('武器').first().click({ force: true });
    await page.getByRole('button', { name: '共鳴' }).click();

    await expect(page.getByText('ILvを1上げてATKを必ず強化。サブステは20ILvごとに伸び、SSRとURは属性枠も育つ。')).toBeVisible();
    await page.getByRole('button', { name: '打ち直し ILv.2' }).click();
    await expect(page.getByRole('button', { name: '打ち直し ILv.3' })).toBeVisible();
  });
});
