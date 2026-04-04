import { test, expect } from '@playwright/test';

test.describe('Necro-Lab E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Cost validation: warning appears when limit is exceeded', async ({ page }) => {
    // Initial state: 0 / 10
    const costDisplay = page.locator('div:has-text("COST:")').last();
    await expect(costDisplay).toContainText('0 / 10');

    // Add monsters until limit is exceeded
    // ゴブリン (Cost 3) x 3 = 9
    const addButtons = page.locator('button:has-text("配置")');
    await addButtons.nth(0).click(); // ゴブリン (Assume first)
    await addButtons.nth(1).click(); // スケルトン (Cost 4) -> 3 + 4 = 7
    await addButtons.nth(2).click(); // ゾンビ (Cost 4) -> 7 + 4 = 11

    await expect(costDisplay).toContainText('11 / 10');
    // Check for warning class
    await expect(costDisplay).toHaveClass(/bg-blood\/20/);
    await expect(page.locator('text=軍団の合計コストが最大値を超えています')).toBeVisible();
  });

  test('Soul stone flow: monster is removed after confirmation', async ({ page }) => {
    const goblinText = page.locator('text=ゴブリン').first();
    await expect(goblinText).toBeVisible();

    // Click soul stone button (Sparkles icon)
    // In our component it's the first button in the flex gap
    const soulStoneButton = page.locator('button[title="魂石化"]').first();
    
    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());

    await soulStoneButton.click();

    // Check if monster is removed
    await expect(goblinText).not.toBeVisible();
  });

  test('Placement limit: 3 slots are functional', async ({ page }) => {
    const emptySlots = page.locator('text=EMPTY SLOT');
    await expect(emptySlots).toHaveCount(3);

    const addButtons = page.locator('button:has-text("配置")');
    
    // Add 3 monsters
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await addButtons.nth(2).click();

    await expect(page.locator('text=EMPTY SLOT')).toHaveCount(0);
    
    // Try to add another (should not be possible or should not affect slots)
    // Actually the current component logic just fills empty slots.
    // If no empty slot, findIndex returns -1 and it does nothing.
  });

  test('Feedback: warning appears when trying to add to a full party', async ({ page }) => {
    const addButtons = page.locator('button:has-text("配置")');
    
    // Add 3 monsters to fill slots
    await addButtons.nth(0).click();
    await addButtons.nth(1).click();
    await addButtons.nth(2).click();

    // Try to add a 4th monster (click any "配置" button again)
    await addButtons.nth(0).click();

    // Check for the specific error message
    const warning = page.locator('text=軍団の枠がいっぱいです。配置を解除してから再度試してください');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveClass(/bg-blood/);
  });
});
