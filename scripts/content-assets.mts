import * as fs from 'fs';
import path from 'path';
import {
  forgePackageAssets,
  inspectPackageAssets,
  writeAssetPromptQueue,
  type AssetForgeFinding,
} from '../src/lib/content/assetForge';
import type { ContentPackage } from '../src/lib/content/contentPackage';

const ROOT = process.cwd();

function readPackage(filePath: string): ContentPackage {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ContentPackage;
  if (raw.schemaVersion !== 2 || !Array.isArray(raw.assets)) throw new Error('schemaVersion 2 Content Packageを指定してください。');
  return raw;
}

function printFindings(findings: AssetForgeFinding[]): void {
  for (const finding of findings) {
    if (finding.level === 'PASS') continue;
    console.log(`${finding.level.padEnd(4)} asset/${finding.assetId} ${finding.field}: ${finding.message}`);
  }
}

function summary(findings: AssetForgeFinding[]): string {
  return `${findings.filter(item => item.level === 'FAIL').length} fail(s), ${findings.filter(item => item.level === 'WARN').length} warning(s)`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.includes('--prompts') ? 'prompts' : args.includes('--forge') ? 'forge' : args.includes('--check') ? 'check' : undefined;
  const target = args.find(arg => !arg.startsWith('--'));
  if (!mode || !target) throw new Error('Usage: tsx scripts/content-assets.mts <--prompts|--forge|--check> <content-package.json>');
  const packagePath = path.resolve(ROOT, target);
  const pkg = readPackage(packagePath);

  if (mode === 'prompts') {
    const result = await writeAssetPromptQueue(ROOT, packagePath, pkg);
    printFindings(result.findings);
    console.log(`PROMPTS ${result.queue.jobs.length} job(s) -> ${result.queue.promptQueuePath}. Package remains DRAFT.`);
    console.log(`Prompt gates: ${summary(result.findings)}.`);
    if (result.findings.some(finding => finding.level === 'FAIL')) process.exitCode = 2;
    return;
  }
  if (mode === 'forge') {
    const result = await forgePackageAssets(ROOT, packagePath, pkg);
    printFindings(result.findings);
    console.log(`FORGED ${result.processedAssetIds.length} image(s)${result.contactSheetPath ? ` -> ${result.contactSheetPath}` : ''}. Originals retained; package remains DRAFT.`);
    console.log(`Asset gates: ${summary(result.findings)}.`);
    if (result.findings.some(finding => finding.level === 'FAIL')) process.exitCode = 2;
    return;
  }
  const findings = await inspectPackageAssets(ROOT, pkg);
  printFindings(findings);
  console.log(`Asset inspection: ${summary(findings)}. DRY RUN: no files changed.`);
  if (findings.some(finding => finding.level === 'FAIL')) process.exitCode = 2;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
