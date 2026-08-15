import fs from 'fs';
import path from 'path';
import { devices, expect, test } from '@playwright/test';
import { auditRuntimeQualityMetrics, type RuntimeQualityMetrics } from '../src/lib/content/productionQualityGate';
import { prepareE2EPage, startFirstDungeonBattle } from './helpers/e2e';

const { defaultBrowserType: _browser, ...IPHONE_13_PRO } = devices['iPhone 13 Pro'];

async function frameMetrics(page: import('@playwright/test').Page, sampleMs = 1400) {
  return page.evaluate(async (duration) => new Promise<{ p95: number; longFrames: number }>((resolve) => {
    const deltas: number[] = [];
    let previous = performance.now();
    const started = previous;
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      if (now - started > 100) deltas.push(delta);
      if (now - started < duration) requestAnimationFrame(tick);
      else {
        const ordered = [...deltas].sort((a, b) => a - b);
        const p95 = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))] ?? 0;
        resolve({ p95, longFrames: deltas.filter(value => value > 34).length });
      }
    };
    requestAnimationFrame(tick);
  }), sampleMs);
}

async function browserAudit(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clippedText = [...document.querySelectorAll('body *')].filter(element => {
      if (!visible(element) || element.childElementCount > 0 || element.getAttribute('title')) return false;
      if (!element.textContent?.trim()) return false;
      const style = getComputedStyle(element);
      return style.textOverflow !== 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
    });
    const undersizedTargets = [...document.querySelectorAll('button, a, input, select')].filter(element => visible(element) && !(element as HTMLButtonElement).disabled && element.getBoundingClientRect().height < 44);
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const initialTransferBytes = resources.reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0);
    const nonFrameworkTransferBytes = resources.filter(entry => !entry.name.includes('/_next/static/chunks/')).reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0);
    const topResources = resources.map(entry => ({ name: entry.name, bytes: entry.transferSize || entry.encodedBodySize || 0, type: entry.initiatorType })).sort((a, b) => b.bytes - a.bytes).slice(0, 12);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const reducedMotionAnimations = document.getAnimations().flatMap(animation => {
      if (animation.playState !== 'running') return [];
      const effect = animation.effect as KeyframeEffect | null;
      if (!effect) return [];
      const duration = Number(effect.getComputedTiming().duration);
      const keys = new Set(effect.getKeyframes().flatMap(frame => Object.keys(frame)));
      if (!(duration > 500 && ['transform', 'filter', 'clipPath', 'offsetDistance'].some(key => keys.has(key)))) return [];
      const target = effect.target as Element | null;
      return [{
        duration,
        properties: [...keys],
        target: target ? `${target.tagName.toLowerCase()}.${target.getAttribute('class') ?? ''}`.slice(0, 240) : 'unknown',
        html: target?.outerHTML.slice(0, 500) ?? 'unknown',
        computedAnimationDuration: target ? getComputedStyle(target).animationDuration : '',
      }];
    });
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      clippedTextCount: clippedText.length,
      undersizedTargetCount: undersizedTargets.length,
      initialTransferBytes,
      nonFrameworkTransferBytes,
      heapUsedBytes: memory?.usedJSHeapSize,
      reducedMotionViolations: reducedMotionAnimations.length,
      reducedMotionAnimations,
      topResources,
      isIPhone: /iPhone/.test(navigator.userAgent),
      prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
}

test.describe('Content production device gate', () => {
  test.use({ ...IPHONE_13_PRO, reducedMotion: 'reduce' });

  test('measures iOS layout, first load, memory, 60fps budget, and reduced motion', async ({ page, browserName }) => {
    const consoleErrors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepareE2EPage(page, { preset: 'endgame' });
    await page.waitForTimeout(500);
    const home = await browserAudit(page);
    const beforeHeap = home.heapUsedBytes;

    await startFirstDungeonBattle(page);
    await expect(page.locator('#tut-attack-btn')).toBeVisible();
    const frames = await frameMetrics(page);
    const battle = await browserAudit(page);
    const productionBundleBytes = Number(process.env.CONTENT_PRODUCTION_BUNDLE_BYTES ?? 0);
    const metrics: RuntimeQualityMetrics = {
      id: 'iphone_13_pro_battle',
      viewportWidth: battle.viewportWidth,
      documentWidth: battle.documentWidth,
      clippedTextCount: battle.clippedTextCount,
      undersizedTargetCount: battle.undersizedTargetCount,
      initialTransferBytes: home.nonFrameworkTransferBytes + productionBundleBytes,
      ...(battle.heapUsedBytes !== undefined ? { heapUsedBytes: battle.heapUsedBytes } : {}),
      ...(battle.heapUsedBytes !== undefined && beforeHeap !== undefined ? { heapGrowthBytes: Math.max(0, battle.heapUsedBytes - beforeHeap) } : {}),
      frameP95Ms: frames.p95,
      longFrameCount: frames.longFrames,
      consoleErrorCount: consoleErrors.length,
      reducedMotionViolations: Math.max(home.reducedMotionViolations, battle.reducedMotionViolations),
    };
    const findings = auditRuntimeQualityMetrics(metrics);
    const report = { schemaVersion: 1, createdAt: new Date().toISOString(), device: `iPhone 13 Pro / ${browserName === 'webkit' ? 'iOS Safari WebKit' : 'Chromium emulation'}`, browserName, isIPhone: home.isIPhone, prefersReducedMotion: home.prefersReducedMotion, productionBundleBytes, devTransferBytesObserved: home.initialTransferBytes, metrics, findings, topResources: home.topResources, reducedMotionAnimations: battle.reducedMotionAnimations, consoleErrors };
    const reportPath = process.env.CONTENT_PRODUCTION_RUNTIME_REPORT;
    if (reportPath) {
      fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
      fs.writeFileSync(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    await test.info().attach('production-runtime-metrics', { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: 'application/json' });
    expect(home.isIPhone).toBe(true);
    expect(home.prefersReducedMotion).toBe(true);
    expect(findings.filter(item => item.level === 'FAIL'), JSON.stringify(report, null, 2)).toEqual([]);
  });
});
