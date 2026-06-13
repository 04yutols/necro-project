import { test, expect } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.describe('Battle command UX', () => {
  test.describe.configure({ timeout: 60000 });
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page);
    await startFirstDungeonBattle(page);
  });

  test('opens the current skill panel and shows unlocked attack-type skills', async ({ page }) => {
    await page.locator('#tut-skill-btn').click();

    await expect(page.getByText('スキル選択', { exact: true })).toBeVisible();
    await expect(page.getByText('渾身斬り')).toBeVisible();
    await expect(page.getByText(/無\/斬撃/)).toBeVisible();
    await expect(page.getByText('雷鳴斬り')).toHaveCount(0);

    await page.getByText('← 戻る').click();
    await expect(page.locator('#tut-attack-btn')).toContainText('攻撃');
  });

  test('starts with full MP and consumes only the selected skill cost', async ({ page }) => {
    const playerMp = page.getByTestId('player-mp');
    await expect(playerMp).toContainText('MP');
    await expect(playerMp).toContainText('100');

    await page.locator('#tut-skill-btn').click();
    await page.getByText('渾身斬り').click();

    await expect(playerMp).toContainText('95');
  });

  test('keeps attack and system commands reachable on the mobile battle screen', async ({ page }) => {
    await expect(page.locator('#tut-attack-btn')).toContainText('攻撃');
    await expect(page.locator('#tut-soul-gauge')).toBeVisible();
    await expect(page.getByRole('button', { name: /AUTO OFF/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '×3' })).toBeVisible();
    await expect(page.getByRole('button', { name: /撤退|逃走/ })).toBeVisible();

    const battleLog = page.getByTestId('battle-log');
    await battleLog.evaluate((element) => {
      (window as any).__battleLogHistory = [];
      new MutationObserver(() => {
        (window as any).__battleLogHistory.push(element.textContent ?? '');
      }).observe(element, { childList: true, subtree: true, characterData: true });
    });
    await page.locator('#tut-attack-btn').click();
    await expect(battleLog).toContainText('骸骨騎士の攻撃', { timeout: 5000 });
    await expect.poll(() => page.evaluate(() => (window as any).__battleLogHistory.join('\n')))
      .toMatch(/スケルトンの追撃！ 霊体騎士に [1-9]\d*ダメージ！/);
  });

  test('accepts only one attack from a synchronous click burst', async ({ page }) => {
    const attackButton = page.locator('#tut-attack-btn');
    await attackButton.evaluate((button) => {
      for (let index = 0; index < 5; index += 1) {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    const battleLog = page.getByTestId('battle-log');
    await expect(battleLog).toContainText('骸骨騎士の攻撃', { timeout: 5000 });
    const attackLines = (await battleLog.innerText()).match(/骸骨騎士の攻撃！/g) ?? [];
    expect(attackLines).toHaveLength(1);
  });

  test('restores full MP after escaping and entering the stage again', async ({ page }) => {
    const playerMp = page.getByTestId('player-mp');
    await page.locator('#tut-skill-btn').click();
    await page.getByText('渾身斬り').click();
    await expect(playerMp).toContainText('95');

    await page.getByRole('button', { name: /撤退|逃走/ }).click();
    await expect(page.getByText('LAYER 1 / WORLD MAP')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /領域選択/ }).click({ force: true });
    await page.getByRole('button', { name: /エリアマップへ|再訪する/ }).click({ force: true });
    await expect(page.getByText('LAYER 2 / AREA MAP')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /次の侵攻/ }).click({ force: true });
    await page.getByRole('button', { name: /侵攻開始|再挑戦/ }).click({ force: true });

    await expect(page.getByTestId('player-mp')).toContainText('100', { timeout: 15000 });
  });
});
