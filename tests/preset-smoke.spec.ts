// 要 dev server（localhost:3080）。CI 外（進行プリセット注入経路のスモーク確認用）。
import { test, expect } from '@playwright/test';
import { prepareE2EPage } from './helpers/e2e';

test.describe('progression preset seeding smoke', () => {
  test('ch1_cleared seeds a cleared save and reaches HOME with YOMI unlocked', async ({ page }) => {
    // prepareE2EPage は preset 指定時に seedGameState 相当で game-store を注入する。
    await prepareE2EPage(page, { preset: 'ch1_cleared' });

    // HOME 到達（prepareE2EPage 内でも待機済みだが明示的に確認）。
    await expect(page.getByText('拠点', { exact: true })).toBeVisible();

    // area1_node3 クリア済みなので黄泉タブがロック解除表示（unlocked サブラベル）になる。
    await expect(page.getByText('THE YOMI DEPTHS')).toBeVisible();
    await expect(page.getByText('第1章クリアで解放')).toHaveCount(0);
  });

  test('ch1_cleared unlocks the necro lab entry', async ({ page }) => {
    await prepareE2EPage(page, { preset: 'ch1_cleared' });

    await expect(page.getByText('拠点', { exact: true })).toBeVisible();
    // area1_node3 クリアで LAB が「ネクロラボ」表示に切り替わる（未解放は「深淵の残滓」）。
    await expect(page.getByText('ネクロラボ')).toBeVisible();
  });
});
