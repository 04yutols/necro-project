import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export type SnapshotFileRecord = {
  targetPath: string;
  existedBefore: boolean;
  snapshotPath?: string;
  beforeHash?: string;
  appliedHash: string;
};

export type ContentSnapshotManifest = {
  schemaVersion: 1;
  packageId: string;
  packageRevision: number;
  createdAt: string;
  files: SnapshotFileRecord[];
};

export type ApplyFileTransactionOptions = {
  rootDir: string;
  snapshotRootDir: string;
  snapshotName: string;
  packageId: string;
  packageRevision: number;
  writes: ReadonlyMap<string, Buffer | string>;
  createdAt?: string;
};

export type UndoFileTransactionOptions = {
  rootDir: string;
  snapshotRootDir: string;
  snapshotPath: string;
  force?: boolean;
};

export type SnapshotConflictRecord = {
  targetPath: string;
  expectedAppliedHash: string;
  currentHash?: string;
  currentExists: boolean;
  conflict: boolean;
};

export type ContentSnapshotInspection = {
  manifest: ContentSnapshotManifest;
  files: SnapshotConflictRecord[];
  hasConflicts: boolean;
};

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function isInsideOrEqual(parent: string, child: string): boolean {
  return path.resolve(parent) === path.resolve(child) || isInside(parent, child);
}

function canonicalExistingPath(value: string): string {
  const resolved = path.resolve(value);
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
}

export function normalizeTransactionPath(value: string): string {
  if (!value || path.isAbsolute(value)) throw new Error(`Path must be a non-empty repository-relative path: ${value}`);
  const normalized = value.replaceAll('\\', '/');
  if (normalized.split('/').some(segment => segment === '' || segment === '..')) throw new Error(`Unsafe repository path: ${value}`);
  return normalized;
}

function resolveInside(rootDir: string, relativePath: string): string {
  const normalized = normalizeTransactionPath(relativePath);
  const resolved = path.resolve(rootDir, normalized);
  if (!isInside(path.resolve(rootDir), resolved)) throw new Error(`Path escapes root: ${relativePath}`);
  let existingParent = path.dirname(resolved);
  while (!fs.existsSync(existingParent)) {
    const next = path.dirname(existingParent);
    if (next === existingParent) throw new Error(`Could not resolve parent path: ${relativePath}`);
    existingParent = next;
  }
  const realParent = fs.realpathSync(existingParent);
  if (!isInsideOrEqual(path.resolve(rootDir), realParent)) throw new Error(`Path parent escapes root through a symlink: ${relativePath}`);
  return resolved;
}

function atomicWrite(filePath: string, data: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

function restoreOriginals(rootDir: string, originals: Map<string, Buffer | undefined>): void {
  for (const [relativePath, original] of [...originals.entries()].reverse()) {
    const target = resolveInside(rootDir, relativePath);
    if (original === undefined) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } else {
      atomicWrite(target, original);
    }
  }
}

export function makeSnapshotName(packageId: string, at = new Date()): string {
  if (!/^[a-z][a-z0-9_]*$/.test(packageId)) throw new Error(`Invalid package id: ${packageId}`);
  return `${packageId}__${at.toISOString().replace(/[:.]/g, '-')}`;
}

export function applyFileTransaction(options: ApplyFileTransactionOptions): { snapshotPath: string; manifest: ContentSnapshotManifest } {
  if (options.writes.size === 0) throw new Error('Content transaction requires at least one file write.');
  const rootDir = canonicalExistingPath(options.rootDir);
  const snapshotRootDir = canonicalExistingPath(options.snapshotRootDir);
  if (!isInside(rootDir, snapshotRootDir)) throw new Error('snapshotRootDir must be inside rootDir.');
  const snapshotName = normalizeTransactionPath(options.snapshotName);
  if (snapshotName.includes('/')) throw new Error('snapshotName must not contain directories.');
  const snapshotPath = path.join(snapshotRootDir, snapshotName);
  if (fs.existsSync(snapshotPath)) throw new Error(`Snapshot already exists: ${snapshotPath}`);

  const orderedWrites = [...options.writes.entries()]
    .map(([relativePath, data]) => [normalizeTransactionPath(relativePath), Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const duplicateCheck = new Set(orderedWrites.map(([relativePath]) => relativePath));
  if (duplicateCheck.size !== orderedWrites.length) throw new Error('Duplicate transaction target path.');

  fs.mkdirSync(path.join(snapshotPath, 'files'), { recursive: true });
  const originals = new Map<string, Buffer | undefined>();
  const records: SnapshotFileRecord[] = [];
  try {
    for (const [relativePath, applied] of orderedWrites) {
      const target = resolveInside(rootDir, relativePath);
      const existedBefore = fs.existsSync(target);
      const original = existedBefore ? fs.readFileSync(target) : undefined;
      originals.set(relativePath, original);
      const snapshotRelative = existedBefore ? `files/${relativePath}` : undefined;
      if (snapshotRelative && original) atomicWrite(resolveInside(snapshotPath, snapshotRelative), original);
      records.push({
        targetPath: relativePath,
        existedBefore,
        ...(snapshotRelative ? { snapshotPath: snapshotRelative } : {}),
        ...(original ? { beforeHash: sha256(original) } : {}),
        appliedHash: sha256(applied),
      });
    }

    for (const [relativePath, applied] of orderedWrites) atomicWrite(resolveInside(rootDir, relativePath), applied);
    const manifest: ContentSnapshotManifest = {
      schemaVersion: 1,
      packageId: options.packageId,
      packageRevision: options.packageRevision,
      createdAt: options.createdAt ?? new Date().toISOString(),
      files: records,
    };
    atomicWrite(path.join(snapshotPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return { snapshotPath, manifest };
  } catch (error) {
    restoreOriginals(rootDir, originals);
    throw error;
  }
}

export function readContentSnapshotManifest(snapshotPath: string): ContentSnapshotManifest {
  const raw = JSON.parse(fs.readFileSync(path.join(snapshotPath, 'manifest.json'), 'utf8')) as unknown;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('Invalid snapshot manifest.');
  const manifest = raw as Partial<ContentSnapshotManifest>;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported snapshot manifest.');
  return manifest as ContentSnapshotManifest;
}

export function inspectFileTransaction(options: Omit<UndoFileTransactionOptions, 'force'>): ContentSnapshotInspection {
  const rootDir = canonicalExistingPath(options.rootDir);
  const snapshotRootDir = canonicalExistingPath(options.snapshotRootDir);
  const snapshotPath = canonicalExistingPath(options.snapshotPath);
  if (!isInside(snapshotRootDir, snapshotPath)) throw new Error('snapshotPath must be inside snapshotRootDir.');
  const manifest = readContentSnapshotManifest(snapshotPath);
  const files = manifest.files.map(record => {
    const targetPath = resolveInside(rootDir, record.targetPath);
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : undefined;
    const currentHash = current ? sha256(current) : undefined;
    return {
      targetPath: record.targetPath,
      expectedAppliedHash: record.appliedHash,
      ...(currentHash ? { currentHash } : {}),
      currentExists: current !== undefined,
      conflict: currentHash !== record.appliedHash,
    };
  });
  return { manifest, files, hasConflicts: files.some(file => file.conflict) };
}

export function undoFileTransaction(options: UndoFileTransactionOptions): ContentSnapshotManifest {
  const rootDir = canonicalExistingPath(options.rootDir);
  const snapshotRootDir = canonicalExistingPath(options.snapshotRootDir);
  const snapshotPath = canonicalExistingPath(options.snapshotPath);
  if (!isInside(snapshotRootDir, snapshotPath)) throw new Error('snapshotPath must be inside snapshotRootDir.');
  const manifest = readContentSnapshotManifest(snapshotPath);

  const resolvedRecords = manifest.files.map(record => {
    const targetPath = resolveInside(rootDir, record.targetPath);
    const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : undefined;
    const currentHash = current ? sha256(current) : undefined;
    if (!options.force && currentHash !== record.appliedHash) {
      throw new Error(`Undo conflict: ${record.targetPath} changed after apply. Use --force only after reviewing the diff.`);
    }
    let original: Buffer | undefined;
    if (record.existedBefore) {
      if (!record.snapshotPath) throw new Error(`Snapshot is missing original path for ${record.targetPath}.`);
      const originalPath = resolveInside(snapshotPath, record.snapshotPath);
      original = fs.readFileSync(originalPath);
      if (record.beforeHash && sha256(original) !== record.beforeHash) throw new Error(`Snapshot hash mismatch: ${record.targetPath}`);
    }
    return { record, targetPath, current, original };
  });

  try {
    for (const { record, targetPath, original } of [...resolvedRecords].reverse()) {
      if (record.existedBefore && original) atomicWrite(targetPath, original);
      else if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    }
  } catch (error) {
    for (const { targetPath, current } of resolvedRecords) {
      if (current) atomicWrite(targetPath, current);
      else if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    }
    throw error;
  }
  return manifest;
}
