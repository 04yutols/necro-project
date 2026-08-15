import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import {
  CONTENT_PIPELINE_STAGES,
  isContentPackage,
  isSafeRepositoryPath,
  type ContentPackage,
  type ContentPackageValidationContext,
  type ContentPipelineStageId,
} from '../src/lib/content/contentPackage';
import {
  createOrchestratedContentPackage,
  invalidateContentPipelineStage,
  runContentPipelineStage,
  type ContentOrchestrationRequest,
} from '../src/lib/content/packageOrchestrator';
import { isLoreRegistry, type LoreRegistry } from '../src/lib/content/loreRegistry';
import type { SkillPresentationSpec } from '../src/lib/presentation/skillPresentation';

const ROOT = process.cwd();
const MASTER = path.join(ROOT, 'src/data/master');
const LORE_FILE = path.join(ROOT, 'content/lore/registry.json');
const PRESENTATION_FILE = path.join(ROOT, 'src/data/presentation/skillPresentations.json');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function option(name: string): string | undefined {
  return process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function pipelineStage(value: string | undefined): ContentPipelineStageId | undefined {
  const upper = value?.toUpperCase();
  if (!upper) return undefined;
  if (!(CONTENT_PIPELINE_STAGES as readonly string[]).includes(upper)) throw new Error(`Unknown pipeline stage: ${value}`);
  return upper as ContentPipelineStageId;
}

function safeFile(relativePath: string): string | undefined {
  if (!isSafeRepositoryPath(relativePath)) return undefined;
  const absolute = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, absolute);
  return relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) ? undefined : absolute;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function contexts(pkg: ContentPackage) {
  const existingEnemies = readJson<Record<string, unknown>>(path.join(MASTER, 'enemies.json'));
  const existingMonsters = readJson<Record<string, unknown>>(path.join(MASTER, 'monsters.json'));
  const existingSkills = readJson<Record<string, unknown>>(path.join(MASTER, 'skills.json'));
  const existingItems = readJson<Record<string, unknown>>(path.join(MASTER, 'items.json'));
  const existingJobs = readJson<Record<string, unknown>>(path.join(MASTER, 'jobs.json'));
  const existingStages = readJson<Record<string, unknown>>(path.join(MASTER, 'stages.json'));
  const materials = readJson<Record<string, unknown>>(path.join(MASTER, 'materials.json'));
  const loreRaw = readJson<unknown>(LORE_FILE);
  const loreRegistry: LoreRegistry | undefined = isLoreRegistry(loreRaw) ? loreRaw : undefined;
  const assetFiles: NonNullable<ContentPackageValidationContext['assetFiles']> = {};
  for (const asset of pkg.assets) {
    if (!asset.sourcePath) continue;
    const filePath = safeFile(asset.sourcePath);
    if (!filePath || !fs.existsSync(filePath)) assetFiles[asset.sourcePath] = { exists: false };
    else {
      const stat = fs.statSync(filePath);
      assetFiles[asset.sourcePath] = { exists: stat.isFile(), bytes: stat.size, sha256: sha256File(filePath) };
    }
  }
  return {
    gameplay: { existingEnemies, existingMonsters, existingSkills, existingItems, existingJobs, existingStages, materials },
    validation: {
      bundle: {
        characters: readJson<Record<string, { id?: string; expressions?: string[] }>>(path.join(ROOT, 'src/data/story/characters.json')),
        storySceneIds: new Set<string>(),
        storyPackIds: new Set(['act1_ch1']),
        stageIds: new Set(Object.keys(existingStages)),
        stages: existingStages,
        areaIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(MASTER, 'areas.json')))),
        items: existingItems,
        enemies: existingEnemies,
        monsters: existingMonsters,
        skills: existingSkills,
        jobs: existingJobs,
        materials,
        residueNames: readJson<Record<string, unknown>>(path.join(MASTER, 'residueNames.json')),
      },
      loreRegistry,
      assetFiles,
      presentationRegistry: readJson<Record<string, SkillPresentationSpec>>(PRESENTATION_FILE),
    },
  };
}

function runPresentationEvidence(packagePath: string): ContentPackage {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), path.join(ROOT, 'scripts/content-present.mts'), packagePath], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`content:present failed with exit code ${String(result.status)}.`);
  return readJson<ContentPackage>(packagePath);
}

const args = process.argv.slice(2);
const sourceArg = args.find(arg => !arg.startsWith('--'));
if (!sourceArg) throw new Error('Usage: npm run content:orchestrate -- <request-or-package.json> [--plan-only|--stage=ASSETS|--regenerate=PRESENTATION]');
const sourcePath = path.resolve(ROOT, sourceArg);
const source = readJson<unknown>(sourcePath);
const requestedStage = pipelineStage(option('stage'));
const regenerateStage = pipelineStage(option('regenerate'));
let pkg: ContentPackage;
let packagePath: string;

if (isContentPackage(source)) {
  pkg = source;
  packagePath = sourcePath;
} else {
  const request = source as ContentOrchestrationRequest;
  pkg = createOrchestratedContentPackage(request);
  packagePath = path.join(ROOT, `content/packages/${pkg.id}.json`);
  writeJson(packagePath, pkg);
  console.log(`PLANNED ${pkg.id}: ${pkg.targets.length} target(s), ${pkg.deliverables.length} deliverable(s), ${pkg.dependencies.length} dependency edge(s).`);
}

if (args.includes('--plan-only')) {
  console.log(`Package plan: ${path.relative(ROOT, packagePath)}`);
  process.exit(0);
}

if (regenerateStage) {
  pkg = invalidateContentPipelineStage(pkg, regenerateStage);
  writeJson(packagePath, pkg);
}
const stages = regenerateStage ? [regenerateStage] : requestedStage ? [requestedStage] : [...CONTENT_PIPELINE_STAGES];
for (const id of stages) {
  const result = runContentPipelineStage(pkg, id, contexts(pkg));
  pkg = result.package;
  writeJson(packagePath, pkg);
  if (result.assetQueue) writeJson(path.join(ROOT, result.assetQueue.promptQueuePath), result.assetQueue);
  console.log(`${result.stage.state.padEnd(4)} ${id}: ${result.stage.summary ?? 'no summary'}`);
  if (result.stage.state === 'FAIL') {
    process.exitCode = 2;
    break;
  }
  if (id === 'PRESENTATION' && pkg.presentation.some(record => record.state === 'READY')) {
    pkg = runPresentationEvidence(packagePath);
  }
}

console.log(`PIPELINE ${pkg.orchestration?.state ?? 'UNKNOWN'} · revision ${pkg.revision} · ${path.relative(ROOT, packagePath)}`);
