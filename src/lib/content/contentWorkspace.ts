import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { ContentValidationContext } from './contentBundle';
import {
  isContentPackage,
  isSafeRepositoryPath,
  type ContentPackage,
  type ContentPackageValidationContext,
} from './contentPackage';
import { isLoreRegistry, type LoreRegistry } from './loreRegistry';
import type { SkillPresentationSpec } from '../presentation/skillPresentation';

const STORY_PACK_FILES = ['ch1_scenes.json', 'ch2_scenes.json'];

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function repositoryFile(rootDir: string, relativePath: string): string | undefined {
  if (!isSafeRepositoryPath(relativePath)) return undefined;
  const root = fs.realpathSync(rootDir);
  const lexical = path.resolve(root, relativePath);
  const resolved = fs.existsSync(lexical) ? fs.realpathSync(lexical) : lexical;
  const relative = path.relative(root, resolved);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined;
  return resolved;
}

export type ContentPackageFile = {
  package: ContentPackage;
  absolutePath: string;
  relativePath: string;
};

export function listContentPackageFiles(rootDir = process.cwd()): ContentPackageFile[] {
  const directory = path.join(rootDir, 'content/packages');
  if (!fs.existsSync(directory)) return [];
  const result: ContentPackageFile[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const absolutePath = path.join(directory, entry.name);
    try {
      const raw = readJson<unknown>(absolutePath);
      if (!isContentPackage(raw)) continue;
      result.push({ package: raw, absolutePath, relativePath: path.relative(rootDir, absolutePath).replaceAll(path.sep, '/') });
    } catch {
      // Malformed drafts are reported by content:validate and omitted from the Review Studio.
    }
  }
  return result.sort((a, b) => a.package.id.localeCompare(b.package.id));
}

export function findContentPackageFile(packageId: string, rootDir = process.cwd()): ContentPackageFile {
  if (!/^[a-z][a-z0-9_]*$/.test(packageId)) throw new Error('Package idの形式が不正です。');
  const found = listContentPackageFiles(rootDir).find(item => item.package.id === packageId);
  if (!found) throw new Error(`Content Packageが見つかりません: ${packageId}`);
  return found;
}

export function writeContentPackageFile(file: ContentPackageFile, pkg: ContentPackage): void {
  if (pkg.id !== file.package.id) throw new Error('Package idの変更はできません。');
  const temporary = path.join(path.dirname(file.absolutePath), `.${path.basename(file.absolutePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, file.absolutePath);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

export function buildContentPackageWorkspaceContext(pkg: ContentPackage, rootDir = process.cwd()): ContentPackageValidationContext {
  const masterDir = path.join(rootDir, 'src/data/master');
  const storyDir = path.join(rootDir, 'src/data/story');
  const existingStages = readJson<Record<string, unknown>>(path.join(masterDir, 'stages.json'));
  const storySceneIds = new Set<string>();
  const storyPackIds = new Set<string>();
  for (const fileName of STORY_PACK_FILES) {
    const filePath = path.join(storyDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    const pack = readJson<{ id?: string; scenes?: Array<{ id?: string }> }>(filePath);
    const packId = pack.id ?? (fileName === 'ch1_scenes.json' ? 'act1_ch1' : 'act1_ch2');
    storyPackIds.add(packId);
    for (const scene of pack.scenes ?? []) if (scene.id) storySceneIds.add(scene.id);
  }
  const bundle: ContentValidationContext = {
    characters: readJson<Record<string, { id?: string; expressions?: string[] }>>(path.join(storyDir, 'characters.json')),
    storySceneIds,
    storyPackIds,
    stageIds: new Set(Object.keys(existingStages)),
    stages: existingStages,
    areaIds: new Set(Object.keys(readJson<Record<string, unknown>>(path.join(masterDir, 'areas.json')))),
    items: readJson<Record<string, unknown>>(path.join(masterDir, 'items.json')),
    enemies: readJson<Record<string, unknown>>(path.join(masterDir, 'enemies.json')),
    monsters: readJson<Record<string, unknown>>(path.join(masterDir, 'monsters.json')),
    skills: readJson<Record<string, unknown>>(path.join(masterDir, 'skills.json')),
    jobs: readJson<Record<string, unknown>>(path.join(masterDir, 'jobs.json')),
    materials: readJson<Record<string, unknown>>(path.join(masterDir, 'materials.json')),
    residueNames: readJson<Record<string, unknown>>(path.join(masterDir, 'residueNames.json')),
  };
  const loreRaw = readJson<unknown>(path.join(rootDir, 'content/lore/registry.json'));
  const loreRegistry: LoreRegistry | undefined = isLoreRegistry(loreRaw) ? loreRaw : undefined;
  const assetFiles: NonNullable<ContentPackageValidationContext['assetFiles']> = {};
  for (const asset of pkg.assets) {
    if (!asset.sourcePath) continue;
    const filePath = repositoryFile(rootDir, asset.sourcePath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) assetFiles[asset.sourcePath] = { exists: false };
    else assetFiles[asset.sourcePath] = { exists: true, bytes: fs.statSync(filePath).size, sha256: sha256File(filePath) };
  }
  const presentationRegistry = readJson<Record<string, SkillPresentationSpec>>(path.join(rootDir, 'src/data/presentation/skillPresentations.json'));
  return { bundle, loreRegistry, assetFiles, presentationRegistry };
}
