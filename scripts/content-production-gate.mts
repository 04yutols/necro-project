import fs from 'fs';
import path from 'path';
import { validateContentPackage, type ContentPackage } from '../src/lib/content/contentPackage';
import { auditContentProductionQuality, type ProductionQualityFinding } from '../src/lib/content/productionQualityGate';
import { buildContentPackageWorkspaceContext, findContentPackageFile, listContentPackageFiles } from '../src/lib/content/contentWorkspace';
import { PRESENTATION_SFX_PROFILES } from '../src/lib/presentation/sfxProfiles';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith('--'));
const requireApplied = args.includes('--require-applied');
const writeReport = args.includes('--write-report');

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function repositoryPath(filePath: string): string {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else if (entry.isFile()) files.push(repositoryPath(absolute));
  }
  return files;
}

function allKnownAssetOutputs(): Set<string> {
  return new Set(listContentPackageFiles(ROOT).flatMap(item => item.package.assets.map(asset => asset.outputPath)));
}

function packageMediaFiles(pkg: ContentPackage): Set<string> {
  const directories = new Set<string>();
  for (const asset of pkg.assets) {
    for (const file of [asset.sourcePath, asset.originalPath]) {
      if (!file?.startsWith('content/packages/')) continue;
      const segments = file.split('/');
      if (segments.length >= 3) directories.add(segments.slice(0, 3).join('/'));
    }
  }
  directories.add(`content/packages/${pkg.id}`);
  return new Set([...directories].flatMap(directory => walkFiles(path.join(ROOT, directory))).filter(file => /\.(?:png|webp|jpe?g|svg|mp3|wav|ogg)$/i.test(file) && !file.includes('/reviews/')));
}

function run(pkg: ContentPackage, relativePath: string): { status: 'PASS' | 'FAIL'; findings: Array<ProductionQualityFinding | { level: string; category: string; id: string; field: string; message: string }> } {
  const masterDir = path.join(ROOT, 'src/data/master');
  const skills = readJson<Record<string, { effectKey?: string }>>(path.join(masterDir, 'skills.json'));
  const repositoryFiles = new Set(pkg.assets.flatMap(asset => [asset.sourcePath, asset.originalPath]).filter((file): file is string => Boolean(file) && fs.existsSync(path.join(ROOT, file))));
  const structural = validateContentPackage(pkg, buildContentPackageWorkspaceContext(pkg, ROOT))
    .filter(item => item.level !== 'PASS')
    .map(item => ({ ...item, category: 'STRUCTURE' }));
  const quality = auditContentProductionQuality(pkg, {
    repositoryFiles,
    packageMediaFiles: packageMediaFiles(pkg),
    generatedFiles: new Set(walkFiles(path.join(ROOT, 'public/images/generated')).concat(walkFiles(path.join(ROOT, 'public/audio/generated')))),
    knownGeneratedAssetPaths: allKnownAssetOutputs(),
    sfxProfileKeys: new Set(Object.keys(PRESENTATION_SFX_PROFILES)),
    stageIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(masterDir, 'stages.json')))),
    enemyIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(masterDir, 'enemies.json')))),
    itemIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(masterDir, 'items.json')))),
    materialIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(masterDir, 'materials.json')))),
    appliedPresentationKeys: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(ROOT, 'src/data/presentation/skillPresentations.json')))),
    masterSkillEffectKeys: new Set(Object.values(skills).map(item => item.effectKey).filter((item): item is string => Boolean(item))),
    requireApplied,
  });
  const findings = [...structural, ...quality];
  for (const finding of findings) if (finding.level !== 'PASS') console.log(`${finding.level.padEnd(4)} ${finding.category}/${finding.id} ${finding.field}: ${finding.message}`);
  const status = findings.some(item => item.level === 'FAIL') ? 'FAIL' : 'PASS';
  console.log(`PRODUCTION ${status} ${pkg.id}: ${findings.filter(item => item.level === 'FAIL').length} fail(s), ${findings.filter(item => item.level === 'WARN').length} warning(s).`);
  if (writeReport) {
    const reportPath = path.join(ROOT, `content/packages/${pkg.id}/reviews/production-quality.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ schemaVersion: 1, packageId: pkg.id, packageRevision: pkg.revision, source: relativePath, createdAt: new Date().toISOString(), status, findings }, null, 2)}\n`, 'utf8');
    console.log(`Report: ${repositoryPath(reportPath)}`);
  }
  return { status, findings };
}

const packages = target
  ? [findContentPackageFile((() => {
      const absolute = path.resolve(ROOT, target);
      const raw = readJson<ContentPackage>(absolute);
      return raw.id;
    })(), ROOT)]
  : listContentPackageFiles(ROOT);
if (packages.length === 0) throw new Error('Content Packageが見つかりません。');
const results = packages.map(item => run(item.package, item.relativePath));
if (results.some(item => item.status === 'FAIL')) process.exitCode = 2;
