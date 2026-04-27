const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Users/yuto/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell' }).catch(e => chromium.launch());
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:3080');
  await page.waitForTimeout(5000);
  await browser.close();
})();
