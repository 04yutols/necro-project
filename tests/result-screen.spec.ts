import { test, expect } from '@playwright/test';

test.describe('Result Screen E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 出撃タブへ
    await page.click('text=出撃');
    // ステージ1-1開始
    await page.click('text=STAGE 1-1');
  });

  test('Battle victory leads to result screen and can return to hub', async ({ page }) => {
    // スケルトン兵を倒すまで攻撃 (モックターゲット HP 150)
    const attackButton = page.locator('button:has-text("物理攻撃")');
    
    // 何回かクリックして倒す
    for (let i = 0; i < 5; i++) {
      await attackButton.click();
      await page.waitForTimeout(1000); // 演出待ち
    }

    // VICTORYテキストが表示されるまで待機 (PixiJS Canvas内なのでテキスト検索)
    // 実際には ResultScreen コンポーネント自体の表示を待つ
    await expect(page.locator('text=拠点へ戻る')).toBeVisible({ timeout: 15000 });

    // 拠点へ戻る
    await page.click('text=拠点へ戻る');

    // 拠点タブがアクティブであることを確認
    await expect(page.locator('h2:has-text("ステータス")')).toBeVisible();
  });
});
