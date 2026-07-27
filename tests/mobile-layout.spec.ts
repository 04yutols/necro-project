import { expect, test, type Page } from '@playwright/test';
import { openHomeSection, prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function expectMobileLayout(page: Page, screenName: string) {
  // Framer Motion and slot-reveal transforms temporarily scale hit areas while
  // entering. Audit the stable screen after the longest transition completes.
  await page.waitForTimeout(700);
  const audit = await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.top < window.innerHeight
        && style.visibility !== 'hidden'
        && style.display !== 'none';
    };

    const undersizedButtons = [...document.querySelectorAll('button')]
      .filter((button) => isVisible(button) && !button.disabled)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: (button.innerText || button.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter(({ height }) => height < 44);

    const clippedText = [...document.querySelectorAll('body *')]
      .filter((element) => {
        if (!isVisible(element) || element.childElementCount > 0) return false;
        const text = element.textContent?.trim();
        if (!text || element.getAttribute('title')) return false;
        const style = window.getComputedStyle(element);
        if (style.textOverflow === 'ellipsis') return false;
        // Japanese fonts and emoji commonly extend a few pixels beyond their
        // CSS line box without being visually clipped. Mobile regressions in
        // this UI have been horizontal compression, so measure that axis only.
        return element.scrollWidth > element.clientWidth + 1;
      })
      .map((element) => ({
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      spacingToken: window.getComputedStyle(document.documentElement).getPropertyValue('--spacing').trim(),
      undersizedButtons,
      clippedText,
    };
  });

  expect(audit.spacingToken, `${screenName}: Tailwind spacing token`).toBe('0.25rem');
  expect(audit.documentWidth, `${screenName}: horizontal document overflow`).toBeLessThanOrEqual(audit.viewportWidth);
  expect(audit.undersizedButtons, `${screenName}: touch targets under 44px`).toEqual([]);
  expect(audit.clippedText, `${screenName}: unintentionally clipped text`).toEqual([]);
}

test.describe('Mobile layout regression', () => {
  test.use({ viewport: MOBILE_VIEWPORT, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await prepareE2EPage(page, { preset: 'endgame' });
  });

  test('keeps HOME, MAP, and job change readable and touchable', async ({ page }) => {
    await expectMobileLayout(page, 'HOME');

    await openHomeSection(page, '出撃・マップ');
    await expect(page.getByText('ワールドマップ')).toBeVisible();
    await expectMobileLayout(page, 'MAP');

    await page.getByRole('button', { name: 'ホーム', exact: true }).click();
    await openHomeSection(page, '転職・職業');
    await expect(page.getByText('UMBRAL RITE-HALL')).toBeVisible();
    await expectMobileLayout(page, 'JOB');
  });

  test('keeps equipment, lab, Yomi, and logs readable and touchable', async ({ page }) => {
    await openHomeSection(page, '装備・編成');
    await expect(page.getByRole('main').getByText('LEGION', { exact: true })).toBeVisible();
    await expectMobileLayout(page, 'LEGION');

    await page.getByRole('button', { name: /MAIN アルド/ }).click();
    await expect(page.getByText('統合詳細ハブ')).toBeVisible();
    for (const residueName of ['思念の兜 / head', '剛力の籠手 / arms', '骸の胸当て / chest', '深淵の帯 / waist', '霊獣の具足 / legs']) {
      await expect(page.getByText(residueName, { exact: true })).toBeVisible();
    }
    await expectMobileLayout(page, 'UNIT DETAIL');

    await page.getByRole('button', { name: /武器/ }).click();
    const weaponList = page.getByTestId('weapon-list-scroll');
    await expect(weaponList).toBeVisible();
    await expect(weaponList).toHaveCSS('overflow-y', 'auto');
    await expect(page.getByTestId('weapon-list-card').first().getByText('WEAPON ATK')).toBeVisible();
    await expect(page.getByTestId('weapon-list-card').first().getByLabel('サブオプション')).toBeVisible();
    await expectMobileLayout(page, 'WEAPON LIST');

    await page.getByRole('button', { name: 'LAB', exact: true }).click();
    await expect(page.getByText('NECRO-LAB')).toBeVisible();
    for (const slotLabel of ['冠 · head', '腕 · arms', '胸 · chest', '帯 · waist', '脚 · legs']) {
      await expect(page.getByText(slotLabel, { exact: true })).toBeVisible();
    }
    await expectMobileLayout(page, 'NECRO LAB');

    await page.getByRole('button', { name: 'YOMI', exact: true }).click();
    await expect(page.getByText('黄泉の階層', { exact: true })).toBeVisible();
    await expectMobileLayout(page, 'YOMI');

    await page.getByRole('button', { name: 'LOGS', exact: true }).click();
    await expect(page.getByRole('button', { name: 'RETURN TO HUB' })).toBeVisible();
    await expectMobileLayout(page, 'LOGS');
  });

  test('keeps the active battle HUD inside the mobile viewport', async ({ page }) => {
    await startFirstDungeonBattle(page);
    await expect(page.locator('#tut-attack-btn')).toBeVisible();
    await expectMobileLayout(page, 'BATTLE');
  });

  test('keeps compact 375x667 screens free of overflow and clipped controls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expectMobileLayout(page, 'COMPACT HOME');

    await openHomeSection(page, '装備・編成');
    await expect(page.getByRole('main').getByText('LEGION', { exact: true })).toBeVisible();
    await expectMobileLayout(page, 'COMPACT LEGION');

    await page.getByRole('button', { name: /MAIN アルド/ }).click();
    await expect(page.getByText('統合詳細ハブ')).toBeVisible();
    await expectMobileLayout(page, 'COMPACT UNIT DETAIL');

    await page.getByRole('button', { name: 'LAB', exact: true }).click();
    await expect(page.getByText('NECRO-LAB')).toBeVisible();
    await expectMobileLayout(page, 'COMPACT NECRO LAB');

    await page.getByRole('button', { name: 'YOMI', exact: true }).click();
    await expect(page.getByText('黄泉の階層', { exact: true })).toBeVisible();
    await expectMobileLayout(page, 'COMPACT YOMI');

    await page.getByRole('button', { name: 'LOGS', exact: true }).click();
    await expect(page.getByRole('button', { name: 'RETURN TO HUB' })).toBeVisible();
    await expectMobileLayout(page, 'COMPACT LOGS');

    await page.getByRole('button', { name: 'RETURN TO HUB' }).click();
    await expect(page.getByText('拠点', { exact: true })).toBeVisible();
    await startFirstDungeonBattle(page);
    await expectMobileLayout(page, 'COMPACT BATTLE');
  });
});
