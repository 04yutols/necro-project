import { test, expect } from '@playwright/test';

test.describe('Soul Shard Equipment E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 研究所タブへ
    await page.click('text=研究所');
  });

  test('Equipping a shard updates monster stats on screen', async ({ page }) => {
    // 1. まず魂石化を行って欠片を作る (ゴブリンを選択)
    const goblinName = page.locator('text=ゴブリン').first();
    const soulStoneButton = page.locator('button[title="魂石化"]').first();
    
    page.on('dialog', dialog => dialog.accept());
    await soulStoneButton.click();
    
    // 2. 別のモンスター（スケルトン）に欠片を装備させる
    const skeletonRow = page.locator('div:has-text("スケルトン")').filter({ has: page.locator('button[title="欠片を装備"]') });
    const equipButton = skeletonRow.locator('button[title="欠片を装備"]');
    
    // 初期ATKを確認 (スケルトンのATKは12)
    await expect(skeletonRow.locator('text=ATK: 12')).toBeVisible();
    
    await equipButton.click();
    
    // モーダルが表示されるのを待つ
    await expect(page.locator('text=魂の欠片 装備')).toBeVisible();
    
    // 欠片を選択 (ゴブリンの欠片: ATK +1のはず ※10 * 0.1)
    await page.click('text=ゴブリンの欠片');
    
    // プレビューを確認 (12 -> 13)
    await expect(page.locator('text=After (+1)')).toBeVisible();
    await expect(page.locator('text=13').last()).toBeVisible();
    
    // 装備実行
    await page.click('button:has-text("EQUIP SHARD")');
    
    // モーダルが閉じるのを待つ
    await expect(page.locator('text=魂の欠片 装備')).not.toBeVisible();
    
    // 3. リスト上の数値が更新されているか確認
    // 修正後のUIでは、装備済みの場合は緑色の太字になる
    const updatedAtk = skeletonRow.locator('span.text-green-400');
    await expect(updatedAtk).toHaveText('13');
    
    // 4. パーティに配置した際も反映されるか確認
    await skeletonRow.locator('button:has-text("配置")').click();
    const partySlot = page.locator('div:has-text("SLOT")').filter({ hasText: 'スケルトン' });
    await expect(partySlot.locator('text=ATK: 13')).toBeVisible();
  });
});
