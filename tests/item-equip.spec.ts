import { test, expect } from '@playwright/test';

test.describe('Item Equipment System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Equipping an item updates character ATK', async ({ page }) => {
    // 1. 拠点タブがアクティブであることを確認
    await expect(page.locator('h2:has-text("装備 (Equipment)")')).toBeVisible();

    // 2. 現在のステータス(ATK)を確認
    const atkContainer = page.locator('div').filter({ hasText: /^ATK$/ }).first();
    // DOM構造: <span className="text-gray-500 uppercase text-xs">ATK</span><span className="font-bold text-white">50</span>
    // やや複雑なので、兄弟要素やテキストで検証
    
    // 現在のATKは50（モックデータ初期値）
    await expect(page.locator('div.space-y-1 > div').filter({ hasText: 'ATK' })).toContainText('50');

    // 3. WEAPONスロットをクリック
    await page.click('button:has-text("WEAPON")');

    // 4. インベントリから「Hero Soul Blade」を選択 (ATK+50のユニーク武器)
    await page.click('button:has-text("Hero Soul Blade")');

    // 5. プレビューを確認 (ATK 50 -> 100)
    const previewArea = page.locator('div:has-text("PREVIEW: Hero Soul Blade")').last();
    await expect(previewArea).toBeVisible();
    await expect(page.locator('div.space-y-1 > div').filter({ hasText: 'ATK' })).toContainText('100'); // プレビューでの増加分表示 (50 -> 100)
    
    // 6. EQUIPボタンをクリック
    await page.click('button:has-text("EQUIP")');

    // 7. 装備が反映され、ステータスが更新されたか確認
    // プレビューが消える
    await expect(page.locator('div:has-text("PREVIEW: Hero Soul Blade")').last()).not.toBeVisible();
    
    // WEAPONスロットに「Hero Soul Blade」が表示される
    const weaponSlot = page.locator('div:has-text("WEAPON")').locator('..').last();
    await expect(weaponSlot).toContainText('Hero Soul Blade');
    
    // ATKが100に固定されたか確認
    await expect(page.locator('div.space-y-1 > div').filter({ hasText: 'ATK' })).toContainText('100');

    // 8. 装備解除
    // 装備済みの場合、右上の X ボタンが表示される (title="Unequip")
    await weaponSlot.locator('button[title="Unequip"]').click();

    // 9. ステータスが元に戻ったか確認
    await expect(page.locator('div.space-y-1 > div').filter({ hasText: 'ATK' })).toContainText('50');
    await expect(weaponSlot).toContainText('Empty');
  });
});
