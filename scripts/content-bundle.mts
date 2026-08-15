import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import {
  isContentBundle,
  contentChangeDataForMaster,
  validateContentBundle,
  type ContentBundle,
  type ContentChange,
  type ContentFinding,
  type ContentValidationContext,
} from '../src/lib/content/contentBundle';
import {
  CONTENT_PACKAGE_STATES,
  isContentPackage,
  isSafeRepositoryPath,
  transitionContentPackage,
  validateContentPackage,
  type ActorType,
  type ContentPackage,
  type ContentPackageState,
  type ContentPackageValidationContext,
  type SkillPresentationRecord,
} from '../src/lib/content/contentPackage';
import type { SkillPresentationSpec } from '../src/lib/presentation/skillPresentation';
import { isLoreRegistry, validateLoreRegistry, type LoreRegistry } from '../src/lib/content/loreRegistry';
import {
  applyFileTransaction,
  makeSnapshotName,
  normalizeTransactionPath,
  undoFileTransaction,
} from '../src/lib/content/contentTransaction';
import { materializeGameplayPackage } from '../src/lib/content/gameplayPackageAdapter';

const ROOT = process.cwd();
const MASTER_DIR = path.join(ROOT, 'src', 'data', 'master');
const STORY_DIR = path.join(ROOT, 'src', 'data', 'story');
const SNAPSHOT_DIR = path.join(ROOT, '.content-snapshots');
const LORE_REGISTRY_FILE = path.join(ROOT, 'content', 'lore', 'registry.json');
const PRESENTATION_REGISTRY_FILE = path.join(ROOT, 'src', 'data', 'presentation', 'skillPresentations.json');
const STORY_PACK_FILES: Record<string, string> = {
  act1_ch1: 'ch1_scenes.json',
  act1_ch2: 'ch2_scenes.json',
};

type CliMode = 'validate' | 'author' | 'apply' | 'transition' | 'undo';

type CliArgs = {
  mode: CliMode;
  targetPath: string;
  allowDeferred: boolean;
  approvedBy?: string;
  to?: string;
  actor?: string;
  actorType?: string;
  comment?: string;
  force: boolean;
  skipQa: boolean;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function jsonText(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function atomicWrite(filePath: string, data: unknown): void {
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temp, jsonText(data), 'utf8');
  fs.renameSync(temp, filePath);
}

function optionValue(args: string[], name: string): string | undefined {
  return args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const mode: CliMode = args.includes('--undo')
    ? 'undo'
    : args.includes('--author')
      ? 'author'
    : args.includes('--transition')
      ? 'transition'
      : args.includes('--apply')
        ? 'apply'
        : 'validate';
  const target = args.find(arg => !arg.startsWith('--'));
  if (!target) {
    throw new Error(
      mode === 'undo'
        ? 'Usage: npm run content:undo -- <snapshot-directory>'
        : mode === 'author'
          ? 'Usage: npm run content:author -- <draft-package.json>'
        : mode === 'transition'
          ? 'Usage: npm run content:transition -- <package.json> --to=<STATE> --actor=<name> --actor-type=<human|codex|automation>'
          : 'Usage: npm run content:validate -- <bundle-or-package.json>',
    );
  }
  return {
    mode,
    targetPath: path.resolve(ROOT, target),
    allowDeferred: args.includes('--allow-deferred'),
    approvedBy: optionValue(args, 'approved-by'),
    to: optionValue(args, 'to'),
    actor: optionValue(args, 'actor'),
    actorType: optionValue(args, 'actor-type'),
    comment: optionValue(args, 'comment'),
    force: args.includes('--force'),
    skipQa: args.includes('--skip-qa'),
  };
}

function buildBundleContext(): ContentValidationContext {
  const characters = readJson<Record<string, { id?: string; expressions?: string[] }>>(path.join(STORY_DIR, 'characters.json'));
  const storySceneIds = new Set<string>();
  for (const fileName of Object.values(STORY_PACK_FILES)) {
    const filePath = path.join(STORY_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    const pack = readJson<{ scenes: Array<{ id: string }> }>(filePath);
    for (const scene of pack.scenes) storySceneIds.add(scene.id);
  }
  const stages = readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'stages.json'));
  return {
    characters,
    storySceneIds,
    storyPackIds: new Set(Object.entries(STORY_PACK_FILES).filter(([, fileName]) => fs.existsSync(path.join(STORY_DIR, fileName))).map(([id]) => id)),
    stageIds: new Set(Object.keys(stages)),
    stages,
    areaIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'areas.json')))),
    items: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'items.json')),
    enemies: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'enemies.json')),
    monsters: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'monsters.json')),
    skills: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'skills.json')),
    jobs: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'jobs.json')),
    materials: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'materials.json')),
    residueNames: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'residueNames.json')),
  };
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveRepositoryPath(relativePath: string): string | undefined {
  if (!isSafeRepositoryPath(relativePath)) return undefined;
  const root = fs.realpathSync(ROOT);
  const lexical = path.resolve(root, relativePath);
  const resolved = fs.existsSync(lexical) ? fs.realpathSync(lexical) : lexical;
  const relative = path.relative(root, resolved);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined;
  return resolved;
}

function buildPackageContext(pkg: ContentPackage): ContentPackageValidationContext {
  const loreRaw = readJson<unknown>(LORE_REGISTRY_FILE);
  const loreRegistry: LoreRegistry | undefined = isLoreRegistry(loreRaw) ? loreRaw : undefined;
  const assetFiles: NonNullable<ContentPackageValidationContext['assetFiles']> = {};
  for (const asset of pkg.assets) {
    if (!asset.sourcePath) continue;
    const filePath = resolveRepositoryPath(asset.sourcePath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      assetFiles[asset.sourcePath] = { exists: false };
      continue;
    }
    const stat = fs.statSync(filePath);
    assetFiles[asset.sourcePath] = { exists: true, bytes: stat.size, sha256: sha256File(filePath) };
  }
  const presentationRegistry = readJson<Record<string, SkillPresentationSpec>>(PRESENTATION_REGISTRY_FILE);
  return { bundle: buildBundleContext(), loreRegistry, assetFiles, presentationRegistry };
}

function printFindings(findings: ContentFinding[]): void {
  for (const finding of findings) {
    if (finding.level === 'PASS') continue;
    console.log(`${finding.level.padEnd(4)} ${finding.scope}/${finding.id} ${finding.field}: ${finding.message}`);
  }
}

function failCount(findings: ContentFinding[]): number {
  return findings.filter(finding => finding.level === 'FAIL').length;
}

function warningCount(findings: ContentFinding[]): number {
  return findings.filter(finding => finding.level === 'WARN').length;
}

function affectedFiles(changes: ContentChange[]): Map<string, unknown> {
  const candidates = new Map<string, unknown>();
  const getCandidate = <T,>(filePath: string): T => {
    if (!candidates.has(filePath)) candidates.set(filePath, readJson<T>(filePath));
    return candidates.get(filePath) as T;
  };
  for (const change of changes) {
    if (change.scope === 'story-character') {
      const file = path.join(STORY_DIR, 'characters.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    } else if (change.scope === 'story-scene') {
      const fileName = change.packId ? STORY_PACK_FILES[change.packId] : undefined;
      if (!fileName) throw new Error(`Unknown story pack: ${String(change.packId)}`);
      const file = path.join(STORY_DIR, fileName);
      const pack = getCandidate<{ scenes: Record<string, unknown>[] }>(file);
      pack.scenes.push(change.data);
      pack.scenes.sort((a, b) => Number(a.sequence ?? Number.MAX_SAFE_INTEGER) - Number(b.sequence ?? Number.MAX_SAFE_INTEGER) || String(a.id).localeCompare(String(b.id)));
    } else if (change.scope === 'weapon') {
      const file = path.join(MASTER_DIR, 'items.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    } else if (change.scope === 'enemy') {
      const file = path.join(MASTER_DIR, 'enemies.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    } else if (change.scope === 'monster') {
      const file = path.join(MASTER_DIR, 'monsters.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = contentChangeDataForMaster(change);
    } else if (change.scope === 'skill') {
      const file = path.join(MASTER_DIR, 'skills.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    } else if (change.scope === 'job') {
      const file = path.join(MASTER_DIR, 'jobs.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = contentChangeDataForMaster(change);
    } else if (change.scope === 'residue-name') {
      const file = path.join(MASTER_DIR, 'residueNames.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    } else if (change.scope === 'stage') {
      const file = path.join(MASTER_DIR, 'stages.json');
      getCandidate<Record<string, unknown>>(file)[change.id] = change.data;
    }
  }
  return candidates;
}

function repositoryRelative(filePath: string): string {
  const canonicalRoot = fs.realpathSync(ROOT);
  const canonicalFile = fs.existsSync(filePath) ? fs.realpathSync(filePath) : filePath;
  const relative = path.relative(canonicalRoot, canonicalFile).replaceAll(path.sep, '/');
  return normalizeTransactionPath(relative);
}

function buildDataWrites(changes: ContentChange[]): Map<string, Buffer | string> {
  const writes = new Map<string, Buffer | string>();
  for (const [filePath, candidate] of affectedFiles(changes)) writes.set(repositoryRelative(filePath), jsonText(candidate));
  return writes;
}

function buildPackageWrites(pkg: ContentPackage): Map<string, Buffer | string> {
  const writes = buildDataWrites(pkg.changes);
  for (const asset of pkg.assets) {
    if (asset.state !== 'READY' || !asset.sourcePath) continue;
    const source = resolveRepositoryPath(asset.sourcePath);
    if (!source) throw new Error(`Unsafe asset source path: ${asset.sourcePath}`);
    if (writes.has(asset.outputPath)) throw new Error(`Duplicate apply target: ${asset.outputPath}`);
    writes.set(normalizeTransactionPath(asset.outputPath), fs.readFileSync(source));
  }
  const readyPresentations = pkg.presentation.filter((record): record is SkillPresentationRecord & Required<Pick<SkillPresentationRecord, 'element' | 'attackType' | 'label' | 'timeline' | 'vfx' | 'sfx' | 'accessibility' | 'performance'>> => record.state === 'READY' && Boolean(record.element && record.attackType && record.label && record.timeline && record.vfx && record.sfx && record.accessibility && record.performance));
  if (readyPresentations.length > 0) {
    const registry = readJson<Record<string, SkillPresentationSpec>>(PRESENTATION_REGISTRY_FILE);
    for (const record of readyPresentations) {
      if (registry[record.effectKey]) throw new Error(`Presentation effectKey already exists: ${record.effectKey}`);
      registry[record.effectKey] = {
        effectKey: record.effectKey,
        element: record.element,
        attackType: record.attackType,
        label: record.label,
        timeline: record.timeline,
        vfx: {
          ...record.vfx,
          textureAssetRefs: record.vfx.textureAssetRefs.map(ref => pkg.assets.find(asset => asset.id === ref)?.outputPath ?? ref),
        },
        sfx: record.sfx,
        accessibility: record.accessibility,
        performance: record.performance,
      };
    }
    writes.set(repositoryRelative(PRESENTATION_REGISTRY_FILE), jsonText(registry));
  }
  return writes;
}

function ensureReleaseScope(chapter: number, allowDeferred: boolean): void {
  if (chapter > 1 && !allowDeferred) throw new Error('Chapter 2+ is DEFERRED. Pass --allow-deferred only after the release scope changes.');
}

function humanApprover(pkg: ContentPackage): string | undefined {
  return [...pkg.review.history].reverse().find(entry => entry.to === 'APPROVED' && entry.actorType === 'human')?.actor;
}

function validateDocument(raw: unknown): { findings: ContentFinding[]; label: string } {
  if (isContentPackage(raw)) return { findings: validateContentPackage(raw, buildPackageContext(raw)), label: `Content package ${raw.status}` };
  if (isContentBundle(raw)) return { findings: validateContentBundle(raw, buildBundleContext()), label: 'Legacy content bundle' };
  if (isLoreRegistry(raw)) return { findings: validateLoreRegistry(raw), label: 'Lore Registry' };
  return {
    findings: [{ level: 'FAIL', scope: 'content', id: '?', field: 'schemaVersion', message: 'schemaVersion 1のbundleまたはschemaVersion 2のContent Packageを指定してください。' }],
    label: 'Unknown content document',
  };
}

function runValidation(raw: unknown): void {
  const { findings, label } = validateDocument(raw);
  printFindings(findings);
  const fails = failCount(findings);
  const warnings = warningCount(findings);
  console.log(`${label}: ${fails} fail(s), ${warnings} warning(s).`);
  if (fails > 0) process.exitCode = 2;
  else console.log('DRY RUN: no files changed. Human review is required before apply.');
}

function runTransition(raw: unknown, packagePath: string, args: CliArgs): void {
  if (!isContentPackage(raw)) throw new Error('State transitions are available only for schemaVersion 2 Content Packages.');
  if (!args.to || !(CONTENT_PACKAGE_STATES as readonly string[]).includes(args.to)) throw new Error('--to must be DRAFT / VALIDATED / REVIEWED / APPROVED / BLOCKED. APPLIED is set by content:apply.');
  const to = args.to as ContentPackageState;
  if (to === 'APPLIED') throw new Error('Use content:apply to enter APPLIED so a recovery snapshot is always recorded.');
  const actor = args.actor ?? (to === 'VALIDATED' ? 'content-validator' : undefined);
  const actorType = args.actorType ?? (to === 'VALIDATED' ? 'automation' : undefined);
  if (!actor || !actorType || !['human', 'codex', 'automation'].includes(actorType)) throw new Error('--actor and --actor-type=<human|codex|automation> are required for this transition.');
  const result = transitionContentPackage(raw, to, {
    actor,
    actorType: actorType as ActorType,
    comment: args.comment,
  }, buildPackageContext(raw));
  printFindings(result.findings);
  if (!result.ok) {
    console.log(`Transition rejected: ${failCount(result.findings)} fail(s), ${warningCount(result.findings)} warning(s).`);
    process.exitCode = 2;
    return;
  }
  atomicWrite(packagePath, result.package);
  console.log(`STATE ${raw.status} -> ${result.package.status} by ${actor} (${actorType}).`);
  if (result.package.provenance.contentHash) console.log(`Content hash: ${result.package.provenance.contentHash}`);
}

function runAuthor(raw: unknown, packagePath: string): void {
  if (!isContentPackage(raw)) throw new Error('Gameplay authoring is available only for schemaVersion 2 Content Packages.');
  const bundle = buildBundleContext();
  const result = materializeGameplayPackage(raw, {
    existingEnemies: bundle.enemies,
    existingMonsters: bundle.monsters,
    existingSkills: bundle.skills,
    existingItems: bundle.items,
    existingJobs: bundle.jobs,
    existingStages: readJson<Record<string, unknown>>(path.join(MASTER_DIR, 'stages.json')),
    materials: bundle.materials,
  });
  printFindings(result.findings);
  atomicWrite(packagePath, result.package);
  console.log(`AUTHORED ${result.generatedChanges.length} change(s), ${result.generatedEvidence.length} evidence record(s). Package remains DRAFT for human review.`);
  const fails = failCount(result.findings);
  const warnings = warningCount(result.findings);
  console.log(`Authoring gates: ${fails} fail(s), ${warnings} warning(s).`);
  if (fails > 0) process.exitCode = 2;
}

function runApply(raw: unknown, documentPath: string, args: CliArgs): void {
  if (!args.approvedBy?.trim()) throw new Error('--apply requires --approved-by=<reviewer>. Codex must not self-approve a draft.');
  if (isContentPackage(raw)) {
    const ctx = buildPackageContext(raw);
    const findings = validateContentPackage(raw, ctx);
    printFindings(findings);
    if (failCount(findings) > 0) {
      console.log(`Content package: ${failCount(findings)} fail(s), ${warningCount(findings)} warning(s).`);
      process.exitCode = 2;
      return;
    }
    if (raw.status !== 'APPROVED') throw new Error(`Content Package must be APPROVED before apply. Current status: ${raw.status}`);
    const approver = humanApprover(raw);
    if (!approver || approver !== args.approvedBy) throw new Error(`--approved-by must match the human APPROVED history actor (${String(approver)}).`);
    ensureReleaseScope(raw.chapter, false);

    const writes = buildPackageWrites(raw);
    if (writes.size === 0) throw new Error('Content Package has no applicable data changes or READY assets.');
    const packageRelative = repositoryRelative(documentPath);
    if (!packageRelative.startsWith('content/packages/')) throw new Error('schemaVersion 2 packages must live under content/packages/ before apply.');
    const at = new Date();
    const snapshotName = makeSnapshotName(raw.id, at);
    const snapshotRelative = `.content-snapshots/${snapshotName}`;
    const applied = transitionContentPackage(raw, 'APPLIED', {
      actor: 'content-cli',
      actorType: 'automation',
      at: at.toISOString(),
      comment: `Applied with approval from ${approver}.`,
      snapshot: snapshotRelative,
    }, ctx);
    if (!applied.ok) {
      printFindings(applied.findings);
      throw new Error('Could not enter APPLIED state.');
    }
    writes.set(packageRelative, jsonText(applied.package));
    const transaction = applyFileTransaction({
      rootDir: ROOT,
      snapshotRootDir: SNAPSHOT_DIR,
      snapshotName,
      packageId: raw.id,
      packageRevision: raw.revision,
      writes,
      createdAt: at.toISOString(),
    });
    console.log(`APPLIED by ${approver}: ${raw.changes.length} data change(s), ${raw.assets.filter(asset => asset.state === 'READY').length} asset(s), ${raw.presentation.filter(record => record.state === 'READY').length} presentation(s).`);
    console.log(`Recovery snapshot: ${repositoryRelative(transaction.snapshotPath)}`);
    if (args.skipQa) {
      console.log('POST-APPLY QA skipped by explicit --skip-qa. Run npm run content:qa before release.');
    } else {
      const qa = spawnSync('npm', ['run', 'content:qa', '--', packageRelative], { cwd: ROOT, stdio: 'inherit', env: process.env });
      if (qa.status !== 0) {
        console.log('APPLIED, but post-apply QA failed. Inspect the package review report; use the recovery snapshot if rollback is required.');
        process.exitCode = 2;
      }
    }
    return;
  }

  if (!isContentBundle(raw)) throw new Error('Unsupported content document.');
  const findings = validateContentBundle(raw, buildBundleContext());
  printFindings(findings);
  if (failCount(findings) > 0) {
    console.log(`Legacy content bundle: ${failCount(findings)} fail(s), ${warningCount(findings)} warning(s).`);
    process.exitCode = 2;
    return;
  }
  ensureReleaseScope(raw.chapter, args.allowDeferred);
  const writes = buildDataWrites(raw.changes);
  const at = new Date();
  const transaction = applyFileTransaction({
    rootDir: ROOT,
    snapshotRootDir: SNAPSHOT_DIR,
    snapshotName: makeSnapshotName(raw.id, at),
    packageId: raw.id,
    packageRevision: 1,
    writes,
    createdAt: at.toISOString(),
  });
  console.log(`APPLIED by ${args.approvedBy}: ${raw.changes.length} change(s).`);
  console.log(`Recovery snapshot: ${repositoryRelative(transaction.snapshotPath)}`);
}

function runUndo(args: CliArgs): void {
  const manifest = undoFileTransaction({
    rootDir: ROOT,
    snapshotRootDir: SNAPSHOT_DIR,
    snapshotPath: args.targetPath,
    force: args.force,
  });
  console.log(`UNDONE ${manifest.packageId} revision ${manifest.packageRevision}: ${manifest.files.length} file(s) restored.`);
  console.log(`Snapshot retained: ${repositoryRelative(args.targetPath)}`);
}

function main(): void {
  const args = parseArgs();
  if (args.mode === 'undo') {
    runUndo(args);
    return;
  }
  const raw = readJson<unknown>(args.targetPath);
  if (args.mode === 'author') runAuthor(raw, args.targetPath);
  else if (args.mode === 'transition') runTransition(raw, args.targetPath, args);
  else if (args.mode === 'apply') runApply(raw, args.targetPath, args);
  else runValidation(raw);
}

main();
