import fs from 'fs';
import path from 'path';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { gzipSync } from 'zlib';
import { isContentPackage, type ContentPackage } from '../src/lib/content/contentPackage';
import { PRODUCTION_QUALITY_LIMITS } from '../src/lib/content/productionQualityGate';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith('--'));
if (!target) throw new Error('Usage: npm run content:qa -- <package.json> [--skip-jest]');
const packagePath = path.resolve(ROOT, target);
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as ContentPackage;
if (!isContentPackage(pkg)) throw new Error('content:qa requires a structurally valid schemaVersion 2 package.');
const reviewDirectory = path.join(ROOT, `content/packages/${pkg.id}/reviews`);
const reportPath = path.join(reviewDirectory, 'post-apply-qa.json');
const screenshotPath = path.join(reviewDirectory, 'content-package-review.png');
const chromiumRuntimeReportPath = path.join(reviewDirectory, 'production-runtime-chromium.json');
const webkitRuntimeReportPath = path.join(reviewDirectory, 'production-runtime-webkit.json');
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3080';
fs.mkdirSync(reviewDirectory, { recursive: true });
process.env.CONTENT_QA_PACKAGE_ID = pkg.id;
process.env.CONTENT_QA_SCREENSHOT = screenshotPath;

type GateResult = { id: string; command: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; exitCode?: number; durationMs: number };
const gates: GateResult[] = [];

function runGate(id: string, command: string, commandArgs: string[], skip = false): void {
  if (skip) {
    gates.push({ id, command: [command, ...commandArgs].join(' '), status: 'SKIPPED', durationMs: 0 });
    return;
  }
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit', env: process.env });
  gates.push({ id, command: [command, ...commandArgs].join(' '), status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status ?? undefined, durationMs: Date.now() - started });
}

function recordProductionBundleGate(): number {
  const appManifestPath = path.join(ROOT, '.next/app-build-manifest.json');
  const buildManifestPath = path.join(ROOT, '.next/build-manifest.json');
  const started = Date.now();
  try {
    const appManifest = JSON.parse(fs.readFileSync(appManifestPath, 'utf8')) as { pages?: Record<string, string[]> };
    const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8')) as { polyfillFiles?: string[] };
    const files = new Set([
      ...(appManifest.pages?.['/layout'] ?? []),
      ...(appManifest.pages?.['/page'] ?? []),
      ...(buildManifest.polyfillFiles ?? []),
    ]);
    if (files.size === 0) throw new Error('production route manifestに初回ロードassetがありません。');
    const bytes = [...files].reduce((total, file) => total + gzipSync(fs.readFileSync(path.join(ROOT, '.next', file))).byteLength, 0);
    const status = bytes <= PRODUCTION_QUALITY_LIMITS.initialTransferBytes ? 'PASS' : 'FAIL';
    gates.push({ id: 'production-initial-bundle', command: 'gzip(.next /layout + /page + polyfills)', status, durationMs: Date.now() - started });
    console.log(`PRODUCTION INITIAL BUNDLE ${status}: ${bytes} / ${PRODUCTION_QUALITY_LIMITS.initialTransferBytes} bytes (gzip)`);
    return bytes;
  } catch (error) {
    console.error(error);
    gates.push({ id: 'production-initial-bundle', command: 'gzip(.next /layout + /page + polyfills)', status: 'FAIL', durationMs: Date.now() - started });
    return 0;
  }
}

async function serverAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/admin/content-packages?package=${encodeURIComponent(pkg.id)}`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | undefined> {
  if (await serverAvailable()) return undefined;
  const port = new URL(baseUrl).port || '3080';
  const server = spawn('npm', ['run', 'dev', '--', '-p', port], { cwd: ROOT, stdio: 'inherit', env: process.env });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 750));
    if (await serverAvailable()) return server;
    if (server.exitCode !== null) throw new Error(`Next.js development server exited with ${server.exitCode}.`);
  }
  server.kill('SIGTERM');
  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

runGate('production-content-contract', 'npx', ['tsx', 'scripts/content-production-gate.mts', target, '--require-applied', '--write-report']);
runGate('master-audit', 'npm', ['run', 'data:audit']);
runGate('typescript', 'npx', ['tsc', '--noEmit']);
runGate('jest', 'npm', ['test', '--', '--runInBand'], args.includes('--skip-jest'));
runGate('next-production-build', 'npm', ['run', 'build']);
const productionBundleBytes = gates.find(gate => gate.id === 'next-production-build')?.status === 'PASS' ? recordProductionBundleGate() : 0;
process.env.CONTENT_PRODUCTION_BUNDLE_BYTES = String(productionBundleBytes);

let server: ChildProcess | undefined;
try {
  server = await ensureServer();
  runGate('playwright-review-visual-regression', 'npx', ['playwright', 'test', 'tests/content-package-review.spec.ts', '--project=chromium']);
  process.env.CONTENT_PRODUCTION_RUNTIME_REPORT = chromiumRuntimeReportPath;
  runGate('playwright-runtime-chromium', 'npx', ['playwright', 'test', 'tests/content-production-quality.spec.ts', '--project=chromium']);
  process.env.CONTENT_PRODUCTION_RUNTIME_REPORT = webkitRuntimeReportPath;
  runGate('playwright-ios-safari-webkit', 'npx', ['playwright', 'test', 'tests/content-production-quality.spec.ts', '--project=webkit-mobile']);
} catch (error) {
  console.error(error);
  gates.push({ id: 'playwright-runtime-bootstrap', command: 'start Next.js test server', status: 'FAIL', durationMs: 0 });
} finally {
  server?.kill('SIGTERM');
}

const report = {
  schemaVersion: 1,
  packageId: pkg.id,
  packageRevision: pkg.revision,
  createdAt: new Date().toISOString(),
  status: gates.some(gate => gate.status === 'FAIL') ? 'FAIL' : 'PASS',
  gates,
  metrics: { productionBundleBytes, initialTransferLimitBytes: PRODUCTION_QUALITY_LIMITS.initialTransferBytes },
  artifacts: {
    report: path.relative(ROOT, reportPath).replaceAll(path.sep, '/'),
    screenshot: path.relative(ROOT, screenshotPath).replaceAll(path.sep, '/'),
    productionQuality: path.relative(ROOT, path.join(reviewDirectory, 'production-quality.json')).replaceAll(path.sep, '/'),
    runtimeChromium: path.relative(ROOT, chromiumRuntimeReportPath).replaceAll(path.sep, '/'),
    runtimeWebKit: path.relative(ROOT, webkitRuntimeReportPath).replaceAll(path.sep, '/'),
  },
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`POST-APPLY QA ${report.status}: ${path.relative(ROOT, reportPath)}`);
if (report.status === 'FAIL') process.exitCode = 2;
