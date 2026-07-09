import { test } from '@playwright/test';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.skip(true, 'Exploratory click-order debug spec; excluded from the release E2E gate.');

test('click order test: AUTO first then x3', async ({ page }) => {
  test.setTimeout(60000);
  
  await prepareE2EPage(page);
  await startFirstDungeonBattle(page);
  
  // Click AUTO first (works in fine-grained test)
  const autoBtn = page.getByRole('button', { name: /AUTO/ });
  await autoBtn.first().click({ force: true });
  await page.waitForTimeout(200);
  
  // Now click ×3
  await page.getByRole('button', { name: '×3' }).click({ force: true });
  await page.waitForTimeout(200);
  
  const autoText = await autoBtn.first().textContent().catch(() => '');
  console.log('After AUTO then ×3 click, AUTO state:', autoText);
  
  // Wait to see if battle progresses
  await page.waitForTimeout(5000);
  
  const log = await page.getByTestId('battle-log').textContent().catch(() => '');
  const autoFinal = await autoBtn.first().textContent().catch(() => '');
  console.log('T=5s - AUTO:', autoFinal, '| Log:', log);
});

test('click order test: x3 then AUTO (no wait between)', async ({ page }) => {
  test.setTimeout(60000);

  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await prepareE2EPage(page);
  await startFirstDungeonBattle(page);

  console.log('=== Clicking ×3 ===');
  // Click ×3 first
  await page.getByRole('button', { name: '×3' }).click({ force: true });
  await page.waitForTimeout(50);

  console.log('=== Clicking AUTO ===');
  // Immediately click AUTO (no wait)
  const autoBtn = page.getByRole('button', { name: /AUTO/ });
  await autoBtn.first().click({ force: true });

  const autoText = await autoBtn.first().textContent().catch(() => '');
  console.log('After ×3 then AUTO (no wait), AUTO state:', autoText);

  await page.waitForTimeout(3000);

  const log = await page.getByTestId('battle-log').textContent().catch(() => '');
  const autoFinal = await autoBtn.first().textContent().catch(() => '');
  console.log('T=3s - AUTO:', autoFinal, '| Log:', log);
  console.log('Browser logs:', consoleLogs.join('\n'));
});

test('click order test: x3 (200ms wait) then AUTO', async ({ page }) => {
  test.setTimeout(60000);
  
  await prepareE2EPage(page);
  await startFirstDungeonBattle(page);
  
  // Click ×3 first
  await page.getByRole('button', { name: '×3' }).click({ force: true });
  await page.waitForTimeout(200);
  
  // Then AUTO
  const autoBtn = page.getByRole('button', { name: /AUTO/ });
  await autoBtn.first().click({ force: true });
  
  const autoText = await autoBtn.first().textContent().catch(() => '');
  console.log('After ×3 (200ms wait) then AUTO, AUTO state:', autoText);
  
  await page.waitForTimeout(5000);
  
  const log = await page.getByTestId('battle-log').textContent().catch(() => '');
  const autoFinal = await autoBtn.first().textContent().catch(() => '');
  console.log('T=5s - AUTO:', autoFinal, '| Log:', log);
});
