import * as fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { forgePackageAssets, inspectPackageAssets, prepareAssetPromptQueue } from './assetForge';
import type { AssetSpec } from './assetSpec';
import type { ContentPackage } from './contentPackage';

const spec: AssetSpec = {
  schemaVersion: 1,
  usage: 'weapon-card',
  variant: 'default',
  width: 192,
  height: 256,
  aspectRatio: { width: 3, height: 4 },
  transparency: 'OPAQUE',
  safeArea: { top: 16, right: 16, bottom: 16, left: 16 },
  consistencyGroup: 'ash_blade',
  style: { medium: 'painted game art', palette: ['black', 'purple'], lighting: 'rim light', mood: 'solemn', materials: ['steel', 'ash'] },
  mustInclude: ['crown guard'],
  avoid: ['text'],
  maxBytes: 120_000,
};

function draft(): ContentPackage {
  return {
    schemaVersion: 2,
    id: 'asset_forge_test',
    title: 'Asset Forge Test',
    revision: 1,
    chapter: 1,
    status: 'DRAFT',
    brief: { playerExperience: '灰の剣を得る。', themes: ['灰'], mustInclude: [], avoid: [] },
    targets: [{ id: 'ash_blade', kind: 'weapon', loreRefs: ['royal_capital'] }],
    lore: { registryRefs: [], entries: [], relationships: [], timelineEvents: [] },
    deliverables: [{ id: 'ash_blade_art', ownerId: 'ash_blade', scope: 'asset', kind: 'detail-art', required: true, state: 'PLANNED', outputRefs: [] }],
    dependencies: [],
    changes: [],
    assets: [{
      id: 'ash_blade_card', ownerId: 'ash_blade', kind: 'detail-art', state: 'PLANNED', mediaType: 'image', format: 'webp',
      outputPath: 'public/images/generated/weapons/ash_blade/card-default.webp', referenceAssetRefs: [], spec,
    }],
    presentation: [],
    localization: [],
    evidence: [],
    provenance: { createdAt: '2026-08-01T00:00:00.000Z', createdBy: { name: 'Codex', type: 'codex' }, generator: { name: 'test' }, prompts: [], references: [], hashAlgorithm: 'sha256' },
    review: { history: [], blockers: [] },
  };
}

describe('Visual Asset Forge', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-forge-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test('画像生成キューへ標準原本パスと再現可能なpromptを保存する', () => {
    const result = prepareAssetPromptQueue(draft());
    expect(result.findings.filter(finding => finding.level === 'FAIL')).toEqual([]);
    expect(result.queue.jobs[0].originalPath).toBe('content/packages/asset_forge_test/originals/ash_blade_card.png');
    expect(result.queue.jobs[0].prompt).toContain('Gothic-Morphism');
    expect(result.queue.jobs[0].referenceAssetPaths).toEqual([]);
    expect(result.package.provenance.prompts[0].id).toBe('asset_prompt_ash_blade_card');
  });

  test('原本をWebP化しmanifest・evidence・contact sheetを一括更新する', async () => {
    const prepared = prepareAssetPromptQueue(draft()).package;
    const packagePath = path.join(root, 'content/packages/asset-forge-test.json');
    const originalPath = path.join(root, prepared.assets[0].originalPath as string);
    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    await fs.mkdir(path.dirname(packagePath), { recursive: true });
    await fs.writeFile(packagePath, JSON.stringify(prepared));
    await sharp({ create: { width: 384, height: 512, channels: 3, background: '#20102c' } }).png().toFile(originalPath);

    const result = await forgePackageAssets(root, packagePath, prepared);
    expect(result.findings.filter(finding => finding.level === 'FAIL')).toEqual([]);
    expect(result.package.assets[0]).toEqual(expect.objectContaining({ state: 'READY', format: 'webp', width: 192, height: 256, alpha: false }));
    expect(result.package.deliverables[0].state).toBe('READY');
    expect(result.package.evidence[0]).toEqual(expect.objectContaining({ kind: 'asset-quality', status: 'PASS' }));
    await expect(fs.stat(path.join(root, 'content/packages/asset_forge_test/optimized/ash_blade_card.webp'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(root, 'content/packages/asset_forge_test/reviews/contact-sheet.webp'))).resolves.toBeDefined();
    expect((await inspectPackageAssets(root, result.package)).filter(finding => finding.level === 'FAIL')).toEqual([]);
  });

  test('壊れた参照assetがある場合は何もforgeしない', async () => {
    const prepared = prepareAssetPromptQueue(draft()).package;
    prepared.assets[0].referenceAssetRefs = ['missing_anchor'];
    const packagePath = path.join(root, 'content/packages/asset-forge-test.json');
    const originalPath = path.join(root, prepared.assets[0].originalPath as string);
    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    await fs.mkdir(path.dirname(packagePath), { recursive: true });
    await fs.writeFile(packagePath, JSON.stringify(prepared));
    await sharp({ create: { width: 384, height: 512, channels: 3, background: '#20102c' } }).png().toFile(originalPath);

    const result = await forgePackageAssets(root, packagePath, prepared);
    expect(result.findings).toContainEqual(expect.objectContaining({ level: 'FAIL', field: 'referenceAssetRefs' }));
    await expect(fs.stat(path.join(root, 'content/packages/asset_forge_test/optimized/ash_blade_card.webp'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
