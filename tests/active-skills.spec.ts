import { test, expect } from '@playwright/test';

test.describe('Active Skills E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 出撃タブへ
    await page.click('text=出撃');
    // ステージ1-1開始
    await page.click('text=STAGE 1-1');
  });

  test('Skill usage and MP consumption works correctly', async ({ page }) => {
    // スキルボタン「渾身斬り」が表示されているか確認 (Warrior Lv1のスキル)
    const skillButton = page.locator('button:has-text("渾身斬り")');
    await expect(skillButton).toBeVisible();

    // 初期MPを確認 (初期モックではMP 20)
    // ログエリア上部のステータス表示などで確認できるが、今回はボタンの有効/無効と動作で検証
    
    // スキルを使用 (MPを5消費する)
    await skillButton.click();
    
    // スキル発動のログが表示されるのを待機
    const logArea = page.locator('div.bg-black\\/80.overflow-y-auto');
    await expect(logArea).toContainText('アルドの渾身斬り！', { timeout: 5000 });
    
    // 連打してMPを枯渇させる (MP20 -> 15 -> 10 -> 5 -> 0)
    // すでに1回（残り15）
    await page.waitForTimeout(1000); // アニメーション待ち
    await skillButton.click(); // 残り10
    await page.waitForTimeout(1000);
    await skillButton.click(); // 残り5
    await page.waitForTimeout(1000);
    await skillButton.click(); // 残り0

    await page.waitForTimeout(1000);

    // MP0になったため、スキルボタンが無効(disabled)になり、グレースケールになるはず
    await expect(skillButton).toBeDisabled();
    await expect(skillButton).toHaveClass(/grayscale/);
    
    // 物理攻撃（消費0）は引き続き使用できることを確認
    const attackButton = page.locator('button:has-text("物理攻撃")');
    await expect(attackButton).not.toBeDisabled();
  });
});
