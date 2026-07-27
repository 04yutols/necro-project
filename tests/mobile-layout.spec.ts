import { devices, expect, test, type Page } from '@playwright/test';
import { openHomeSection, prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

const { defaultBrowserType: _defaultBrowserType, ...IPHONE_13_PRO } = devices['iPhone 13 Pro'];

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
      devicePixelRatio: window.devicePixelRatio,
      isIPhoneUserAgent: /iPhone/.test(window.navigator.userAgent),
      spacingToken: window.getComputedStyle(document.documentElement).getPropertyValue('--spacing').trim(),
      undersizedButtons,
      clippedText,
    };
  });

  expect(audit.spacingToken, `${screenName}: Tailwind spacing token`).toBe('0.25rem');
  expect(audit.devicePixelRatio, `${screenName}: iPhone 13 Pro DPR`).toBe(3);
  expect(audit.isIPhoneUserAgent, `${screenName}: iPhone user agent`).toBe(true);
  expect(audit.documentWidth, `${screenName}: horizontal document overflow`).toBeLessThanOrEqual(audit.viewportWidth);
  expect(audit.undersizedButtons, `${screenName}: touch targets under 44px`).toEqual([]);
  expect(audit.clippedText, `${screenName}: unintentionally clipped text`).toEqual([]);
}

test.describe('Mobile layout regression', () => {
  test.use({ ...IPHONE_13_PRO });

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
    const memberCards = page.getByTestId('legion-member-card');
    await expect(memberCards).toHaveCount(4);
    await expect(memberCards.first().getByTestId('legion-member-name')).toHaveCSS('font-size', '14px');
    await expectMobileLayout(page, 'LEGION');
    const legionText = await page.getByRole('main').innerText();
    expect(legionText, 'LEGION: developer-facing labels').not.toMatch(/\b(?:HATE|PART|MAIN|VACANT)\b|\bC\d+\b/);
    const memberRects = await memberCards.evaluateAll((cards) => cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    expect(memberRects[0].right, 'LEGION: first-row cards overlap').toBeLessThanOrEqual(memberRects[1].left);
    expect(memberRects[0].bottom, 'LEGION: card rows overlap').toBeLessThanOrEqual(memberRects[2].top);

    await memberCards.first().click();
    await expect(page.getByText('軍団詳細')).toBeVisible();
    for (const residueName of ['思念の兜', '剛力の籠手', '骸の胸当て', '深淵の帯', '霊獣の具足']) {
      await expect(page.getByText(residueName, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('unit-gear-name').first()).toHaveCSS('font-size', '11px');
    await expectMobileLayout(page, 'UNIT DETAIL');
    const unitDetailText = await page.getByRole('main').innerText();
    expect(unitDetailText, 'UNIT DETAIL: developer-facing labels').not.toMatch(/STATUS|Formation|\b(?:SSR|SR)\b/);
    const gearSlots = page.getByTestId('unit-gear-slot');
    await expect(gearSlots).toHaveCount(6);
    const gearRects = await gearSlots.evaluateAll((slots) => slots.map((slot) => {
      const rect = slot.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    expect(gearRects[0].right, 'UNIT DETAIL: first-row equipment overlaps').toBeLessThanOrEqual(gearRects[1].left);
    expect(gearRects[0].bottom, 'UNIT DETAIL: equipment rows overlap').toBeLessThanOrEqual(gearRects[2].top);
    const clippedGearNames = await page.getByTestId('unit-gear-name').evaluateAll((names) => names
      .filter((name) => name.scrollWidth > name.clientWidth + 1)
      .map((name) => name.textContent));
    expect(clippedGearNames, 'UNIT DETAIL: equipment names are clipped').toEqual([]);

    await page.getByRole('button', { name: /武器/ }).click();
    const weaponList = page.getByTestId('weapon-list-scroll');
    await expect(weaponList).toBeVisible();
    await expect(weaponList).toHaveCSS('overflow-y', 'auto');
    await expect(page.getByTestId('weapon-list-card').first().getByText('WEAPON ATK')).toBeVisible();
    await expect(page.getByTestId('weapon-list-card').first().getByLabel('サブオプション')).toBeVisible();
    await expect(page.getByTestId('weapon-list-card').first().getByTestId('weapon-card-name')).toHaveCSS('font-size', '14px');
    await expect(page.getByText('武器強化', { exact: true })).toHaveCount(0);
    await expectMobileLayout(page, 'WEAPON LIST');
    const weaponRects = await page.getByTestId('weapon-list-card').evaluateAll((cards) => cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    }));
    expect(weaponRects[0].height, 'WEAPON LIST: first card is vertically compressed').toBeGreaterThanOrEqual(160);
    expect(weaponRects[0].bottom, 'WEAPON LIST: cards overlap').toBeLessThanOrEqual(weaponRects[1].top);

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
    const compactGrid = page.getByTestId('legion-party-grid');
    await expect(compactGrid).toHaveCSS('overflow-y', 'auto');
    const compactCardHeight = await page.getByTestId('legion-member-card').first().evaluate((card) => card.getBoundingClientRect().height);
    expect(compactCardHeight, 'COMPACT LEGION: member card is vertically compressed').toBeGreaterThanOrEqual(148);

    await page.getByTestId('legion-member-card').first().click();
    await expect(page.getByText('軍団詳細')).toBeVisible();
    await expectMobileLayout(page, 'COMPACT UNIT DETAIL');
    const compactLoadout = page.getByTestId('unit-detail-loadout');
    const compactLoadoutSize = await compactLoadout.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(compactLoadoutSize.scrollHeight, 'COMPACT UNIT DETAIL: equipment is hidden below the fold').toBeLessThanOrEqual(compactLoadoutSize.clientHeight + 1);
    const compactLoadoutBox = await compactLoadout.boundingBox();
    const compactLastGearBox = await page.getByTestId('unit-gear-slot').last().boundingBox();
    expect(compactLoadoutBox).not.toBeNull();
    expect(compactLastGearBox).not.toBeNull();
    expect(compactLastGearBox!.y + compactLastGearBox!.height, 'COMPACT UNIT DETAIL: equipment overlaps stats').toBeLessThanOrEqual(compactLoadoutBox!.y + compactLoadoutBox!.height);

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
