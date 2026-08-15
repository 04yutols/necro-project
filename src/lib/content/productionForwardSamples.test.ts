import fs from 'fs';
import os from 'os';
import path from 'path';
import areas from '../../data/master/areas.json';
import enemies from '../../data/master/enemies.json';
import items from '../../data/master/items.json';
import jobs from '../../data/master/jobs.json';
import materials from '../../data/master/materials.json';
import monsters from '../../data/master/monsters.json';
import residueNames from '../../data/master/residueNames.json';
import skills from '../../data/master/skills.json';
import stages from '../../data/master/stages.json';
import storyCharacters from '../../data/story/characters.json';
import loreRegistry from '../../../content/lore/registry.json';
import {
  transitionContentPackage,
  validateContentPackage,
  type ContentPackage,
  type ContentPackageValidationContext,
} from './contentPackage';
import {
  getContentReviewSummary,
  reviewContentItem,
  syncContentReviewItems,
} from './contentReviewWorkflow';
import {
  applyFileTransaction,
  inspectFileTransaction,
  makeSnapshotName,
  undoFileTransaction,
} from './contentTransaction';
import type { LoreRegistry } from './loreRegistry';
import {
  auditContentProductionQuality,
  type ProductionQualityContext,
} from './productionQualityGate';
import {
  createProductionForwardSamples,
  productionSampleAssetFiles,
  type ProductionForwardSample,
} from './productionForwardSamples';

const existingStageIds = new Set(Object.keys(stages));

function validationContext(pkg: ContentPackage): ContentPackageValidationContext {
  return {
    loreRegistry: loreRegistry as unknown as LoreRegistry,
    assetFiles: productionSampleAssetFiles(pkg),
    presentationRegistry: {},
    bundle: {
      characters: storyCharacters,
      storySceneIds: new Set(),
      storyPackIds: new Set(['act1_ch1']),
      stageIds: existingStageIds,
      stages,
      areaIds: new Set(Object.keys(areas)),
      items,
      enemies,
      monsters,
      skills,
      jobs,
      materials,
      residueNames,
    },
  };
}

function productionContext(pkg: ContentPackage, requireApplied = false): ProductionQualityContext {
  return {
    repositoryFiles: new Set(pkg.assets.flatMap(item => [item.sourcePath].filter((value): value is string => Boolean(value)))),
    packageMediaFiles: new Set(pkg.assets.flatMap(item => [item.sourcePath].filter((value): value is string => Boolean(value)))),
    generatedFiles: new Set(pkg.assets.map(item => item.outputPath)),
    knownGeneratedAssetPaths: new Set(pkg.assets.map(item => item.outputPath)),
    sfxProfileKeys: new Set(['rune_cast', 'abyss_impact']),
    stageIds: existingStageIds,
    enemyIds: new Set(Object.keys(enemies)),
    itemIds: new Set(Object.keys(items)),
    materialIds: new Set(Object.keys(materials)),
    appliedPresentationKeys: new Set(pkg.presentation.map(item => item.effectKey)),
    masterSkillEffectKeys: new Set([
      ...Object.values(skills).map(item => item.effectKey).filter((value): value is string => typeof value === 'string'),
      ...pkg.changes.filter(item => item.scope === 'skill').map(item => item.data.effectKey).filter((value): value is string => typeof value === 'string'),
      ...pkg.presentation.filter(item => !pkg.changes.some(change => change.scope === 'skill' && change.id === item.ownerId)).map(item => item.effectKey),
    ]),
    requireApplied,
  };
}

function transitionOrThrow(
  pkg: ContentPackage,
  to: ContentPackage['status'],
  context: ContentPackageValidationContext,
  options: { actor: string; actorType: 'human' | 'automation'; comment?: string; snapshot?: string },
): ContentPackage {
  const result = transitionContentPackage(pkg, to, { ...options, at: '2026-08-01T01:00:00.000Z' }, context);
  if (!result.ok) throw new Error(result.findings.map(item => `${item.scope}.${item.field}: ${item.message}`).join('\n'));
  return result.package;
}

function humanApproveAll(pkg: ContentPackage): ContentPackage {
  let next = syncContentReviewItems(pkg, {
    actor: 'phase7-reviewer',
    actorType: 'human',
    at: '2026-08-01T01:10:00.000Z',
    comment: 'Phase 7前方互換レビューを開始。',
  }).package;
  for (const item of next.review.items ?? []) {
    const result = reviewContentItem(next, {
      ref: item.ref,
      status: 'APPROVED',
      actor: 'phase7-reviewer',
      actorType: 'human',
      comment: '世界観・数値・画像・演出・接続を確認。',
      at: '2026-08-01T01:15:00.000Z',
    });
    if (!result.ok) throw new Error(`${item.ref}: ${result.message}`);
    next = result.package;
  }
  expect(getContentReviewSummary(next).complete).toBe(true);
  return next;
}

function runLifecycle(sample: ProductionForwardSample): void {
  const context = validationContext(sample.package);
  const draftFindings = validateContentPackage(sample.package, context);
  expect(draftFindings.filter(item => item.level === 'FAIL')).toEqual([]);
  expect(auditContentProductionQuality(sample.package, productionContext(sample.package)).filter(item => item.level === 'FAIL')).toEqual([]);

  let pkg = transitionOrThrow(sample.package, 'VALIDATED', context, {
    actor: 'phase7-validator',
    actorType: 'automation',
  });
  pkg = humanApproveAll(pkg);
  pkg = transitionOrThrow(pkg, 'REVIEWED', context, {
    actor: 'phase7-reviewer',
    actorType: 'human',
    comment: '全項目レビュー済み。ゲーム接続確認へ進める。',
  });
  pkg = transitionOrThrow(pkg, 'APPROVED', context, {
    actor: 'phase7-release-owner',
    actorType: 'human',
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `necro-${sample.kind.toLowerCase()}-`));
  const snapshotRoot = path.join(tempRoot, '.content-snapshots');
  fs.mkdirSync(snapshotRoot);
  const snapshotName = makeSnapshotName(pkg.id, new Date('2026-08-01T01:30:00.000Z'));
  const runtimePath = `runtime/content/${sample.kind.toLowerCase()}.json`;
  const writes = new Map<string, string>([
    [runtimePath, `${JSON.stringify(pkg, null, 2)}\n`],
    ...pkg.assets.map(item => [item.outputPath, `<svg aria-label="${item.id}" xmlns="http://www.w3.org/2000/svg"/>\n`] as [string, string]),
  ]);

  try {
    const applied = applyFileTransaction({
      rootDir: tempRoot,
      snapshotRootDir: snapshotRoot,
      snapshotName,
      packageId: pkg.id,
      packageRevision: pkg.revision,
      writes,
      createdAt: '2026-08-01T01:30:00.000Z',
    });
    pkg = transitionOrThrow(pkg, 'APPLIED', context, {
      actor: 'phase7-applier',
      actorType: 'automation',
      snapshot: `.content-snapshots/${snapshotName}`,
    });

    const runtimePackage = JSON.parse(fs.readFileSync(path.join(tempRoot, runtimePath), 'utf8')) as ContentPackage;
    for (const check of sample.runtimeChecks) expect(check.test(runtimePackage)).toBe(true);
    for (const assetRecord of pkg.assets) expect(fs.existsSync(path.join(tempRoot, assetRecord.outputPath))).toBe(true);
    expect(inspectFileTransaction({ rootDir: tempRoot, snapshotRootDir: snapshotRoot, snapshotPath: applied.snapshotPath }).hasConflicts).toBe(false);
    expect(auditContentProductionQuality(pkg, productionContext(pkg, true)).filter(item => item.level === 'FAIL')).toEqual([]);

    undoFileTransaction({ rootDir: tempRoot, snapshotRootDir: snapshotRoot, snapshotPath: applied.snapshotPath });
    expect(fs.existsSync(path.join(tempRoot, runtimePath))).toBe(false);
    for (const assetRecord of pkg.assets) expect(fs.existsSync(path.join(tempRoot, assetRecord.outputPath))).toBe(false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

describe('Phase 7 production forward samples', () => {
  test('4種類のサンプルを固定する', () => {
    expect(createProductionForwardSamples().map(sample => sample.kind)).toEqual([
      'STORY',
      'CONTROLLED_MONSTER',
      'WEAPON',
      'BOSS',
    ]);
  });

  test.each(createProductionForwardSamples().map(sample => [sample.kind, sample] as const))(
    '%s: 生成→レビュー→適用→ゲーム内接続確認→Undoを再現する',
    (_kind, sample) => runLifecycle(sample),
  );
});
