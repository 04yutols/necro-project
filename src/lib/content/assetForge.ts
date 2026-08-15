import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  buildAssetPrompt,
  expectedFinalAlpha,
  standardAssetContactSheetPath,
  standardAssetOptimizedPath,
  standardAssetOriginalPath,
  standardAssetOutputPath,
  standardAssetPromptQueuePath,
  validateAssetSpec,
} from './assetSpec';
import type { AssetRecord, ContentEvidence, ContentPackage } from './contentPackage';

export type AssetForgeFinding = {
  level: 'PASS' | 'WARN' | 'FAIL';
  assetId: string;
  field: string;
  message: string;
};

export type AssetPromptQueue = {
  schemaVersion: 1;
  packageId: string;
  packageRevision: number;
  promptQueuePath: string;
  jobs: Array<{
    assetId: string;
    ownerId: string;
    usage: NonNullable<AssetRecord['spec']>['usage'];
    originalPath: string;
    outputPath: string;
    referenceAssetRefs: string[];
    referenceAssetPaths: string[];
    prompt: string;
  }>;
};

export type AssetForgeResult = {
  package: ContentPackage;
  findings: AssetForgeFinding[];
  processedAssetIds: string[];
  contactSheetPath?: string;
};

type PreparedImage = {
  asset: AssetRecord;
  buffer: Buffer;
  originalBytes: number;
  originalWidth?: number;
  originalHeight?: number;
};

function clonePackage(pkg: ContentPackage): ContentPackage {
  return structuredClone(pkg);
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function jsonBuffer(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function resolveRepositoryPath(rootDir: string, repositoryPath: string, mustExist: boolean): Promise<string> {
  if (!repositoryPath || repositoryPath.startsWith('/') || repositoryPath.startsWith('\\') || repositoryPath.replaceAll('\\', '/').split('/').some(segment => !segment || segment === '..')) {
    throw new Error(`Unsafe repository path: ${repositoryPath}`);
  }
  const root = await fs.realpath(rootDir);
  const lexical = path.resolve(root, repositoryPath);
  if (!isInside(root, lexical)) throw new Error(`Repository path escapes root: ${repositoryPath}`);
  try {
    const resolved = await fs.realpath(lexical);
    if (!isInside(root, resolved)) throw new Error(`Repository path resolves outside root: ${repositoryPath}`);
    return resolved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || mustExist) throw error;
  }

  let current = root;
  for (const segment of path.relative(root, path.dirname(lexical)).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error(`Symlinked asset directory is not allowed: ${repositoryPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      break;
    }
  }
  return lexical;
}

function extensionForOriginal(originalPath: string): string {
  return path.extname(originalPath).slice(1).toLowerCase();
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

async function chromaKeyToAlpha(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);
  const key = { r: 0, g: 255, b: 0 };
  for (let index = 0; index < output.length; index += info.channels) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const distance = Math.sqrt((r - key.r) ** 2 + (g - key.g) ** 2 + (b - key.b) ** 2);
    const alpha = distance <= 18 ? 0 : distance >= 150 ? 255 : Math.round(((distance - 18) / 132) * 255);
    output[index + 3] = Math.min(output[index + 3], alpha);
    if (alpha < 245) output[index + 1] = Math.min(g, Math.max(r, b) + 18);
  }
  return sharp(output, { raw: info }).png().toBuffer();
}

async function encodeWithinBudget(pipeline: sharp.Sharp, maxBytes: number): Promise<Buffer> {
  let last: Buffer = Buffer.alloc(0);
  for (const quality of [88, 82, 76, 70, 64, 56]) {
    last = await pipeline.clone().webp({ quality, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
    if (last.byteLength <= maxBytes) return last;
  }
  return last;
}

async function prepareImage(rootDir: string, pkg: ContentPackage, asset: AssetRecord): Promise<{ prepared?: PreparedImage; findings: AssetForgeFinding[] }> {
  const findings: AssetForgeFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL' as const, assetId: asset.id, field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN' as const, assetId: asset.id, field, message });
  if (!asset.spec) {
    fail('spec', '画像forgeにはAssetSpecが必要です。');
    return { findings };
  }
  for (const finding of validateAssetSpec(asset.spec)) findings.push({ ...finding, assetId: asset.id });
  const expectedOutput = standardAssetOutputPath(asset.ownerId, asset.spec);
  if (asset.outputPath !== expectedOutput) fail('outputPath', `標準出力先と一致しません: ${expectedOutput}`);
  if (!asset.originalPath) {
    fail('originalPath', '生成原本のパスがありません。先に content:assets:prompts を実行してください。');
    return { findings };
  }
  const expectedOriginalPrefix = `content/packages/${pkg.id}/originals/${asset.id}.`;
  if (!asset.originalPath.startsWith(expectedOriginalPrefix)) fail('originalPath', `原本は ${expectedOriginalPrefix}<ext> に保存してください。`);
  if (!originalExtensionIsSupported(asset)) fail('originalPath', '原本形式は png / jpg / jpeg / webp / svg のいずれかにしてください。');
  if (findings.some(finding => finding.level === 'FAIL')) return { findings };

  let originalFile: string;
  let original: Buffer;
  try {
    originalFile = await resolveRepositoryPath(rootDir, asset.originalPath, true);
    original = await fs.readFile(originalFile);
  } catch {
    fail('originalPath', `生成原本が存在しません: ${asset.originalPath}`);
    return { findings };
  }

  try {
    const originalMetadata = await sharp(original).metadata();
    if (!originalMetadata.width || !originalMetadata.height) {
      fail('originalPath', '原本の寸法を取得できません。');
      return { findings };
    }
    if (originalMetadata.width < asset.spec.width || originalMetadata.height < asset.spec.height) {
      warn('dimensions', `原本 ${originalMetadata.width}x${originalMetadata.height} を ${asset.spec.width}x${asset.spec.height} へ拡大します。再生成を推奨します。`);
    }
    if (asset.spec.transparency === 'ALPHA' && !originalMetadata.hasAlpha) {
      fail('alpha', 'ALPHA指定ですが原本にalpha channelがありません。');
      return { findings };
    }

    const decoded = asset.spec.transparency === 'CHROMA_KEY' ? await chromaKeyToAlpha(original) : original;
    let pipeline = sharp(decoded).rotate().resize(asset.spec.width, asset.spec.height, {
      fit: 'contain',
      background: expectedFinalAlpha(asset.spec) ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 7, g: 4, b: 13, alpha: 1 },
      withoutEnlargement: false,
    });
    if (!expectedFinalAlpha(asset.spec)) pipeline = pipeline.flatten({ background: '#07040d' });
    const optimized = await encodeWithinBudget(pipeline, asset.spec.maxBytes);
    if (optimized.byteLength > asset.spec.maxBytes) fail('bytes', `WebP最適化後も容量上限を超えています: ${optimized.byteLength} > ${asset.spec.maxBytes}`);
    const finalMetadata = await sharp(optimized).metadata();
    const hasAlpha = Boolean(finalMetadata.hasAlpha);
    if (expectedFinalAlpha(asset.spec) !== hasAlpha) fail('alpha', `最終alpha=${hasAlpha} がAssetSpecと一致しません。`);
    if (finalMetadata.width !== asset.spec.width || finalMetadata.height !== asset.spec.height) fail('dimensions', '最終寸法がAssetSpecと一致しません。');
    if (findings.some(finding => finding.level === 'FAIL')) return { findings };

    const next: AssetRecord = {
      ...asset,
      state: 'READY',
      format: 'webp',
      sourcePath: standardAssetOptimizedPath(pkg.id, asset.id),
      outputPath: expectedOutput,
      width: finalMetadata.width,
      height: finalMetadata.height,
      alpha: hasAlpha,
      safeArea: { ...asset.spec.safeArea },
      bytes: optimized.byteLength,
      contentHash: sha256(optimized),
    };
    findings.push({ level: 'PASS', assetId: asset.id, field: 'forge', message: `${optimized.byteLength} bytesのWebPへ最適化しました。原本は保持されます。` });
    return {
      findings,
      prepared: {
        asset: next,
        buffer: optimized,
        originalBytes: original.byteLength,
        originalWidth: originalMetadata.width,
        originalHeight: originalMetadata.height,
      },
    };
  } catch (error) {
    fail('decode', `画像を処理できません: ${error instanceof Error ? error.message : String(error)}`);
    return { findings };
  }
}

async function createContactSheet(images: PreparedImage[]): Promise<Buffer> {
  const columns = Math.min(3, Math.max(1, images.length));
  const cardWidth = 340;
  const cardHeight = 390;
  const headerHeight = 82;
  const rows = Math.ceil(images.length / columns);
  const width = columns * cardWidth + 32;
  const height = headerHeight + rows * cardHeight + 24;
  const composites: sharp.OverlayOptions[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const item = images[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = 16 + column * cardWidth;
    const top = headerHeight + row * cardHeight;
    const thumbnail = await sharp(item.buffer)
      .resize(cardWidth - 32, 310, { fit: 'contain', background: '#0b0712' })
      .webp({ quality: 84 })
      .toBuffer();
    composites.push({ input: thumbnail, left: left + 16, top: top + 8 });
    const usage = item.asset.spec?.usage ?? item.asset.kind;
    const label = Buffer.from(`<svg width="${cardWidth - 24}" height="54" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="8" fill="#120d1c" stroke="#8B00FF" stroke-opacity="0.38"/>
      <text x="12" y="22" fill="#eadfff" font-family="sans-serif" font-size="14" font-weight="700">${escapeXml(item.asset.id)}</text>
      <text x="12" y="42" fill="#9a8cb7" font-family="sans-serif" font-size="11">${escapeXml(usage)} · ${item.asset.width}x${item.asset.height} · ${item.asset.bytes} bytes</text>
    </svg>`);
    composites.push({ input: label, left: left + 12, top: top + 322 });
  }

  const header = Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#07040d"/>
    <text x="24" y="34" fill="#eadfff" font-family="sans-serif" font-size="20" font-weight="700">VISUAL ASSET CONTACT SHEET</text>
    <text x="24" y="58" fill="#a78bfa" font-family="sans-serif" font-size="12">design consistency · silhouette · palette · safe area · expression</text>
  </svg>`);
  composites.unshift({ input: header, left: 0, top: 0 });
  return sharp({ create: { width, height, channels: 4, background: '#07040d' } })
    .composite(composites)
    .webp({ quality: 86, effort: 6 })
    .toBuffer();
}

async function listFiles(rootDir: string, repositoryDir: string): Promise<string[]> {
  let directory: string;
  try {
    directory = await resolveRepositoryPath(rootDir, repositoryDir, true);
  } catch {
    return [];
  }
  const result: string[] = [];
  const visit = async (current: string): Promise<void> => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) result.push(path.relative(await fs.realpath(rootDir), absolute).replaceAll(path.sep, '/'));
    }
  };
  await visit(directory);
  return result.sort();
}

async function findOrphans(rootDir: string, pkg: ContentPackage): Promise<AssetForgeFinding[]> {
  const known = new Set<string>();
  for (const asset of pkg.assets) {
    if (asset.originalPath) known.add(asset.originalPath);
    if (asset.sourcePath) known.add(asset.sourcePath);
  }
  known.add(standardAssetContactSheetPath(pkg.id));
  known.add(standardAssetPromptQueuePath(pkg.id));
  const files = [
    ...(await listFiles(rootDir, `content/packages/${pkg.id}/originals`)),
    ...(await listFiles(rootDir, `content/packages/${pkg.id}/optimized`)),
  ];
  return files
    .filter(file => !known.has(file))
    .map(file => ({ level: 'WARN' as const, assetId: pkg.id, field: 'orphan', message: `manifest未登録ファイルです: ${file}` }));
}

async function atomicWriteSet(rootDir: string, writes: Map<string, Buffer>): Promise<void> {
  const backups = new Map<string, Buffer | null>();
  const committed: string[] = [];
  try {
    for (const [repositoryPath, buffer] of writes) {
      const target = await resolveRepositoryPath(rootDir, repositoryPath, false);
      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        backups.set(target, await fs.readFile(target));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        backups.set(target, null);
      }
      const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(temporary, buffer, { flag: 'wx' });
      await fs.rename(temporary, target);
      committed.push(target);
    }
  } catch (error) {
    for (const target of committed.reverse()) {
      const backup = backups.get(target);
      if (backup) await fs.writeFile(target, backup);
      else await fs.rm(target, { force: true });
    }
    throw error;
  }
}

function upsertPrompt(pkg: ContentPackage, asset: AssetRecord, prompt: string): void {
  const promptId = `asset_prompt_${asset.id}`;
  asset.provenancePromptRef = promptId;
  const index = pkg.provenance.prompts.findIndex(item => item.id === promptId);
  const record = { id: promptId, purpose: `${asset.kind} / ${asset.spec?.usage ?? 'asset'}`, text: prompt };
  if (index >= 0) pkg.provenance.prompts[index] = record;
  else pkg.provenance.prompts.push(record);
}

export function prepareAssetPromptQueue(pkg: ContentPackage): { package: ContentPackage; queue: AssetPromptQueue; findings: AssetForgeFinding[] } {
  const next = clonePackage(pkg);
  const findings: AssetForgeFinding[] = [];
  if (next.status !== 'DRAFT') findings.push({ level: 'FAIL', assetId: next.id, field: 'status', message: '画像プロンプトの更新はDRAFT packageだけに許可されます。' });
  const jobsById = new Map<string, AssetPromptQueue['jobs'][number]>();
  for (const asset of next.assets) {
    if (asset.mediaType !== 'image') continue;
    if (!asset.spec) {
      findings.push({ level: 'WARN', assetId: asset.id, field: 'spec', message: 'AssetSpecがないため画像生成キューから除外しました。' });
      continue;
    }
    for (const finding of validateAssetSpec(asset.spec)) findings.push({ ...finding, assetId: asset.id });
    asset.format = 'webp';
    asset.outputPath = standardAssetOutputPath(asset.ownerId, asset.spec);
    asset.originalPath ??= standardAssetOriginalPath(next.id, asset.id);
    const prompt = buildAssetPrompt(next, asset);
    upsertPrompt(next, asset, prompt);
    const referenceAssetPaths = asset.referenceAssetRefs.flatMap(referenceId => {
      const reference = next.assets.find(item => item.id === referenceId);
      const referencePath = reference?.sourcePath ?? reference?.originalPath;
      return referencePath ? [referencePath] : [];
    });
    jobsById.set(asset.id, {
      assetId: asset.id,
      ownerId: asset.ownerId,
      usage: asset.spec.usage,
      originalPath: asset.originalPath,
      outputPath: asset.outputPath,
      referenceAssetRefs: [...asset.referenceAssetRefs],
      referenceAssetPaths,
      prompt,
    });
  }
  const jobs: AssetPromptQueue['jobs'] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (assetId: string): void => {
    if (visited.has(assetId)) return;
    if (visiting.has(assetId)) {
      findings.push({ level: 'FAIL', assetId, field: 'referenceAssetRefs', message: '画像参照に循環があります。' });
      return;
    }
    visiting.add(assetId);
    const job = jobsById.get(assetId);
    for (const reference of job?.referenceAssetRefs ?? []) if (jobsById.has(reference)) visit(reference);
    visiting.delete(assetId);
    visited.add(assetId);
    if (job) jobs.push(job);
  };
  for (const assetId of jobsById.keys()) visit(assetId);
  const changed = JSON.stringify(next.assets) !== JSON.stringify(pkg.assets) || JSON.stringify(next.provenance.prompts) !== JSON.stringify(pkg.provenance.prompts);
  if (changed) next.revision += 1;
  delete next.provenance.contentHash;
  return {
    package: next,
    queue: {
      schemaVersion: 1,
      packageId: next.id,
      packageRevision: next.revision,
      promptQueuePath: standardAssetPromptQueuePath(next.id),
      jobs,
    },
    findings,
  };
}

function evidenceStatus(findings: AssetForgeFinding[], assetId: string): ContentEvidence['status'] {
  const relevant = findings.filter(finding => finding.assetId === assetId);
  if (relevant.some(finding => finding.level === 'FAIL')) return 'FAIL';
  if (relevant.some(finding => finding.level === 'WARN')) return 'WARN';
  return 'PASS';
}

function upsertEvidence(pkg: ContentPackage, evidence: ContentEvidence): void {
  const index = pkg.evidence.findIndex(item => item.id === evidence.id);
  if (index >= 0) pkg.evidence[index] = evidence;
  else pkg.evidence.push(evidence);
}

export async function forgePackageAssets(rootDir: string, packagePath: string, pkg: ContentPackage): Promise<AssetForgeResult> {
  const next = clonePackage(pkg);
  const findings: AssetForgeFinding[] = [];
  if (next.status !== 'DRAFT') {
    return { package: next, findings: [{ level: 'FAIL', assetId: next.id, field: 'status', message: '画像forgeはDRAFT packageだけに許可されます。' }], processedAssetIds: [] };
  }
  const assetIds = new Set(next.assets.map(asset => asset.id));
  for (const asset of next.assets) {
    for (const reference of asset.referenceAssetRefs) {
      if (!assetIds.has(reference)) findings.push({ level: 'FAIL', assetId: asset.id, field: 'referenceAssetRefs', message: `参照画像assetが存在しません: ${reference}` });
    }
  }

  const prepared: PreparedImage[] = [];
  for (const asset of next.assets) {
    if (asset.mediaType !== 'image' || !asset.spec) continue;
    const result = await prepareImage(rootDir, next, asset);
    findings.push(...result.findings);
    if (result.prepared) prepared.push(result.prepared);
  }
  if (prepared.length === 0 && !findings.some(finding => finding.level === 'FAIL')) findings.push({ level: 'WARN', assetId: next.id, field: 'assets', message: 'forge対象のAssetSpec付き画像がありません。' });
  findings.push(...await findOrphans(rootDir, next));
  if (findings.some(finding => finding.level === 'FAIL')) return { package: next, findings, processedAssetIds: [] };

  for (const item of prepared) {
    const index = next.assets.findIndex(asset => asset.id === item.asset.id);
    next.assets[index] = item.asset;
    for (const deliverable of next.deliverables) {
      if (deliverable.scope !== 'asset' || deliverable.ownerId !== item.asset.ownerId || deliverable.kind !== item.asset.kind) continue;
      deliverable.state = 'READY';
      const ref = `asset:${item.asset.id}`;
      if (!deliverable.outputRefs.includes(ref)) deliverable.outputRefs.push(ref);
    }
  }

  const contactSheetPath = standardAssetContactSheetPath(next.id);
  const contactSheet = await createContactSheet(prepared);
  const now = new Date().toISOString();
  for (const item of prepared) {
    const status = evidenceStatus(findings, item.asset.id);
    const warnings = findings.filter(finding => finding.assetId === item.asset.id && finding.level === 'WARN').map(finding => finding.message);
    upsertEvidence(next, {
      id: `asset_quality_${item.asset.id}`,
      ownerId: item.asset.ownerId,
      kind: 'asset-quality',
      status,
      summary: status === 'PASS' ? '寸法・形式・alpha・容量・命名・参照検査を通過。contact sheetで人間の造形一貫性レビューが必要。' : warnings.join(' '),
      artifactPath: contactSheetPath,
      contentHash: item.asset.contentHash,
      createdAt: now,
    });
  }
  next.revision += 1;
  delete next.provenance.contentHash;

  const writes = new Map<string, Buffer>();
  for (const item of prepared) writes.set(item.asset.sourcePath as string, item.buffer);
  writes.set(contactSheetPath, contactSheet);
  const rootAbsolute = await fs.realpath(rootDir);
  const packageAbsolute = await fs.realpath(path.resolve(packagePath));
  if (!isInside(rootAbsolute, packageAbsolute)) throw new Error('Package path must be inside repository root.');
  const packageRelative = path.relative(rootAbsolute, packageAbsolute).replaceAll(path.sep, '/');
  writes.set(packageRelative, jsonBuffer(next));
  await atomicWriteSet(rootDir, writes);

  return { package: next, findings, processedAssetIds: prepared.map(item => item.asset.id), contactSheetPath };
}

export async function inspectPackageAssets(rootDir: string, pkg: ContentPackage): Promise<AssetForgeFinding[]> {
  const findings: AssetForgeFinding[] = [];
  const ids = new Set(pkg.assets.map(asset => asset.id));
  for (const asset of pkg.assets) {
    for (const reference of asset.referenceAssetRefs) if (!ids.has(reference)) findings.push({ level: 'FAIL', assetId: asset.id, field: 'referenceAssetRefs', message: `参照画像assetが存在しません: ${reference}` });
    if (asset.mediaType !== 'image' || !asset.spec) continue;
    for (const finding of validateAssetSpec(asset.spec)) findings.push({ ...finding, assetId: asset.id });
    if (asset.outputPath !== standardAssetOutputPath(asset.ownerId, asset.spec)) findings.push({ level: 'FAIL', assetId: asset.id, field: 'outputPath', message: '標準出力パスと一致しません。' });
    if (asset.state !== 'READY' || !asset.sourcePath) {
      findings.push({ level: 'WARN', assetId: asset.id, field: 'state', message: '画像はまだREADYではありません。' });
      continue;
    }
    try {
      const file = await resolveRepositoryPath(rootDir, asset.sourcePath, true);
      const buffer = await fs.readFile(file);
      const metadata = await sharp(buffer).metadata();
      if (metadata.format !== 'webp') findings.push({ level: 'FAIL', assetId: asset.id, field: 'format', message: `実ファイル形式がWebPではありません: ${String(metadata.format)}` });
      if (metadata.width !== asset.spec.width || metadata.height !== asset.spec.height) findings.push({ level: 'FAIL', assetId: asset.id, field: 'dimensions', message: '実ファイル寸法がAssetSpecと一致しません。' });
      if (Boolean(metadata.hasAlpha) !== expectedFinalAlpha(asset.spec)) findings.push({ level: 'FAIL', assetId: asset.id, field: 'alpha', message: '実ファイルalphaがAssetSpecと一致しません。' });
      if (buffer.byteLength !== asset.bytes || sha256(buffer) !== asset.contentHash) findings.push({ level: 'FAIL', assetId: asset.id, field: 'contentHash', message: '実ファイルの容量またはhashがmanifestと一致しません。' });
      if (buffer.byteLength > asset.spec.maxBytes) findings.push({ level: 'FAIL', assetId: asset.id, field: 'bytes', message: '実ファイルが容量上限を超えています。' });
      if (!findings.some(finding => finding.assetId === asset.id && finding.level === 'FAIL')) findings.push({ level: 'PASS', assetId: asset.id, field: 'inspect', message: '画像manifestと実ファイルが一致しています。' });
    } catch {
      findings.push({ level: 'FAIL', assetId: asset.id, field: 'sourcePath', message: `最適化画像が存在しません: ${String(asset.sourcePath)}` });
    }
  }
  findings.push(...await findOrphans(rootDir, pkg));
  return findings;
}

export async function writeAssetPromptQueue(rootDir: string, packagePath: string, pkg: ContentPackage): Promise<{ package: ContentPackage; queue: AssetPromptQueue; findings: AssetForgeFinding[] }> {
  const result = prepareAssetPromptQueue(pkg);
  if (result.findings.some(finding => finding.level === 'FAIL')) return result;
  const root = await fs.realpath(rootDir);
  const absolutePackage = await fs.realpath(path.resolve(packagePath));
  if (!isInside(root, absolutePackage)) throw new Error('Package path must be inside repository root.');
  const packageRelative = path.relative(root, absolutePackage).replaceAll(path.sep, '/');
  await atomicWriteSet(rootDir, new Map([
    [result.queue.promptQueuePath, jsonBuffer(result.queue)],
    [packageRelative, jsonBuffer(result.package)],
  ]));
  return result;
}

export function originalExtensionIsSupported(asset: AssetRecord): boolean {
  return asset.originalPath ? ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extensionForOriginal(asset.originalPath)) : false;
}
