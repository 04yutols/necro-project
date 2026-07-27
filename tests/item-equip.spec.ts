import { test, expect } from '@playwright/test';
import { openHomeSection, prepareE2EPage } from './helpers/e2e';

test.describe('Armory and status UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await openHomeSection(page, '装備・編成');
  });

  test('opens the current Legion detail screen and exposes Star-Rail-style stats', async ({ page }) => {
    await expect(page.getByRole('main').getByText('LEGION', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '詳細へ戻る' }).click();

    await expect(page.getByText('軍団詳細')).toBeVisible();
    await expect(page.getByText('能力値')).toBeVisible();
    await expect(page.getByText('攻撃力', { exact: true })).toBeVisible();
    await expect(page.getByText('防御力', { exact: true })).toBeVisible();
    await expect(page.getByText('速度', { exact: true })).toBeVisible();
    await expect(page.getByText('体力', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '詳細' }).click();
    await expect(page.getByText('能力詳細')).toBeVisible();
    await expect(page.getByText('基本能力')).toBeVisible();
    await expect(page.getByText('属性ダメージ')).toBeVisible();
  });

  test('opens the weapon armory from the current equipment hub', async ({ page }) => {
    await page.getByRole('button', { name: '詳細へ戻る' }).click();
    await page.getByRole('button', { name: /武器/ }).click();

    await expect(page.getByText('武器庫')).toBeVisible();
    await expect(page.getByText('霊銀の斬骨刀').first()).toBeVisible();
    await expect(page.getByTestId('weapon-list-card')).toHaveCount(4);
    await expect(page.getByTestId('weapon-list-card').first().getByText('WEAPON ATK')).toBeVisible();
    await expect(page.getByTestId('weapon-list-card').first().getByLabel('サブオプション')).toBeVisible();
    await expect(page.getByText(/R|SR|SSR|UR/, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('闇属性').first()).toBeVisible();

    await page.getByRole('button', { name: '霊銀の斬骨刀を選択' }).click();
    await expect(page.getByTestId('weapon-detail-scroll')).toBeVisible();
    await expect(page.getByText('FINAL ATK')).toBeVisible();
    await expect(page.getByText('2枠 / 20ILvごとに強化')).toBeVisible();
    await page.getByRole('button', { name: '武器一覧へ戻る' }).click();
    await expect(page.getByTestId('weapon-list-scroll')).toBeVisible();
  });

  test('keeps the mobile weapon list scrollable and equips directly from a list card', async ({ page }) => {
    const scrollFixture = await page.evaluate(() => {
      const raw = window.localStorage.getItem('necro-game-store-v1');
      if (!raw) throw new Error('game store was not persisted');
      const persisted = JSON.parse(raw);
      const weapons = persisted.state.inventoryItems.filter((item: { type: string }) => item.type === 'WEAPON');
      persisted.state.inventoryItems = [
        ...persisted.state.inventoryItems,
        ...weapons.flatMap((weapon: { id: string }, groupIndex: number) => [1, 2].map((copyIndex) => ({
          ...weapon,
          id: `${weapon.id}-scroll-${groupIndex}-${copyIndex}`,
        }))),
      ];
      persisted.state.currentTab = 'EQUIP';
      return JSON.stringify(persisted);
    });
    await page.addInitScript((fixture) => {
      window.localStorage.setItem('necro-game-store-v1', fixture);
    }, scrollFixture);
    await page.reload();
    await expect(page.getByText('拠点', { exact: true })).toBeVisible();
    await openHomeSection(page, '装備・編成');
    await expect(page.getByRole('main').getByText('LEGION', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '詳細へ戻る' }).click();
    await page.getByRole('button', { name: /武器/ }).click();

    const list = page.getByTestId('weapon-list-scroll');
    await expect(list).toBeVisible();
    await expect(list).toHaveCSS('overflow-y', 'auto');
    const dimensions = await list.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const lastCard = page.getByTestId('weapon-list-card').last();
    await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(lastCard).toBeVisible();
    const scrollTop = await list.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    const equipButton = page.getByRole('button', { name: /霊銀の斬骨刀を装備$/ }).first();
    await equipButton.click();
    await expect(page.getByRole('button', { name: /霊銀の斬骨刀を装備中$/ })).toBeDisabled();

    await page.getByRole('button', { name: '詳細へ戻る' }).click();
    await expect(page.getByText('軍団詳細')).toBeVisible();
    await expect(page.getByText('拠点', { exact: true })).toHaveCount(0);
  });

  test('reforges a weapon by one ILv and previews the next step', async ({ page }) => {
    await page.getByRole('button', { name: '詳細へ戻る' }).click();
    await page.getByRole('button', { name: /武器/ }).click();
    await page.getByRole('button', { name: '共鳴' }).click();

    await expect(page.getByText('ILvを1上げてATKを必ず強化。サブステは20ILvごとに伸び、SSRとURは属性枠も育つ。')).toBeVisible();
    await page.getByRole('button', { name: '打ち直し ILv.2' }).click();
    await expect(page.getByRole('button', { name: '打ち直し ILv.3' })).toBeVisible();
  });
});
