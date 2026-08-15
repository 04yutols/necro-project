import { expect, test } from '@playwright/test';
import path from 'path';

test('Content Package Review Studio keeps quality evidence and human gates on one screen', async ({ page }) => {
  const packageId = process.env.CONTENT_QA_PACKAGE_ID ?? 'phase5_ash_regent_package';
  await page.goto(`/admin/content-packages?package=${encodeURIComponent(packageId)}`);
  await expect(page.getByRole('heading', { name: '生成パイプライン' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '承認・再生成・ゲーム反映' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'マスターデータ差分' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'BattleEngine シミュレーション' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ストーリー試読' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '画像・コンタクトシート' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'スキル VFX / SFX' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '検証証跡' })).toBeVisible();
  await expect(page.getByText('JSON changes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '判断を記録' }).first()).toBeVisible();
  const screenshotPath = process.env.CONTENT_QA_SCREENSHOT;
  if (screenshotPath) await page.screenshot({ path: path.resolve(screenshotPath), fullPage: true });
  const visualPackageId = process.env.CONTENT_QA_VISUAL_PACKAGE_ID ?? 'phase5_ash_regent_package';
  if (visualPackageId !== packageId) await page.goto(`/admin/content-packages?package=${encodeURIComponent(visualPackageId)}`);
  await expect(page.getByRole('heading', { name: '生成パイプライン' }).locator('xpath=ancestor::section[1]')).toHaveScreenshot('content-pipeline.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });
});
