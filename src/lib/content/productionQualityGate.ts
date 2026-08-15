import type { ContentPackage, ContentLocalization } from './contentPackage';

export const PRODUCTION_QUALITY_LIMITS = {
  initialTransferBytes: 1_500_000,
  heapUsedBytes: 128 * 1024 * 1024,
  heapGrowthBytes: 16 * 1024 * 1024,
  frameP95Ms: 25,
  longFrameMs: 34,
  maxLongFrames: 2,
  minTouchTargetPx: 44,
  nameJaCharacters: 24,
  nameEnCharacters: 48,
  altJaCharacters: 160,
  altEnCharacters: 220,
  dialogueCharacters: 240,
} as const;

export const PRODUCTION_QUALITY_CATEGORIES = [
  'LOCALIZATION',
  'ACCESSIBILITY',
  'ASSET_REFERENCE',
  'PRESENTATION_REFERENCE',
  'ACQUISITION',
  'RUNTIME',
] as const;

export type ProductionQualityCategory = (typeof PRODUCTION_QUALITY_CATEGORIES)[number];
export type ProductionQualityFinding = {
  level: 'PASS' | 'WARN' | 'FAIL';
  category: ProductionQualityCategory;
  id: string;
  field: string;
  message: string;
};

export type ProductionQualityContext = {
  repositoryFiles?: ReadonlySet<string>;
  packageMediaFiles?: ReadonlySet<string>;
  generatedFiles?: ReadonlySet<string>;
  knownGeneratedAssetPaths?: ReadonlySet<string>;
  sfxProfileKeys: ReadonlySet<string>;
  stageIds: ReadonlySet<string>;
  enemyIds: ReadonlySet<string>;
  itemIds: ReadonlySet<string>;
  materialIds: ReadonlySet<string>;
  appliedPresentationKeys?: ReadonlySet<string>;
  masterSkillEffectKeys?: ReadonlySet<string>;
  requireApplied?: boolean;
};

export type RuntimeQualityMetrics = {
  id: string;
  viewportWidth: number;
  documentWidth: number;
  clippedTextCount: number;
  undersizedTargetCount: number;
  initialTransferBytes: number;
  heapUsedBytes?: number;
  heapGrowthBytes?: number;
  frameP95Ms: number;
  longFrameCount: number;
  consoleErrorCount: number;
  reducedMotionViolations: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valuesForKey(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value.flatMap(item => valuesForKey(item, key));
  if (!isRecord(value)) return [];
  return [
    ...(key in value ? [value[key]] : []),
    ...Object.values(value).flatMap(item => valuesForKey(item, key)),
  ];
}

function localized(pkg: ContentPackage, ownerId: string, locale: ContentLocalization['locale'], kind: ContentLocalization['kind']): ContentLocalization | undefined {
  return pkg.localization.find(item => item.ownerId === ownerId && item.locale === locale && item.kind === kind);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mediaPath(value: string): boolean {
  return /\.(?:png|webp|jpe?g|svg|mp3|wav|ogg)$/i.test(value);
}

export function auditContentProductionQuality(pkg: ContentPackage, ctx: ProductionQualityContext): ProductionQualityFinding[] {
  const findings: ProductionQualityFinding[] = [];
  const add = (level: ProductionQualityFinding['level'], category: ProductionQualityCategory, id: string, field: string, message: string) => findings.push({ level, category, id, field, message });
  const fail = (category: ProductionQualityCategory, id: string, field: string, message: string) => add('FAIL', category, id, field, message);

  if (ctx.requireApplied && pkg.status !== 'APPLIED') fail('RUNTIME', pkg.id, 'status', `production gateはAPPLIED packageだけをrelease可能とします。現在: ${pkg.status}`);

  for (const target of pkg.targets) {
    for (const [locale, kind, max] of [
      ['ja', 'name', PRODUCTION_QUALITY_LIMITS.nameJaCharacters],
      ['en', 'name', PRODUCTION_QUALITY_LIMITS.nameEnCharacters],
      ['ja', 'alt', PRODUCTION_QUALITY_LIMITS.altJaCharacters],
      ['en', 'alt', PRODUCTION_QUALITY_LIMITS.altEnCharacters],
    ] as const) {
      const item = localized(pkg, target.id, locale, kind);
      if (!item) fail('LOCALIZATION', target.id, `${locale}.${kind}`, `${locale} ${kind}がありません。`);
      else {
        if (item.text.length > max) fail('LOCALIZATION', item.id, 'text', `${kind}が表示上限${max}文字を超えています（${item.text.length}文字）。`);
        if (/\p{Cc}/u.test(item.text)) fail('LOCALIZATION', item.id, 'text', '制御文字を含むlocalizationは使用できません。');
      }
    }

    if (target.kind === 'story-character') {
      const profile = pkg.deliverables.find(item => item.ownerId === target.id && item.scope === 'character-profile' && item.kind === 'profile');
      const artifact = profile?.artifact;
      for (const field of ['wish', 'fear', 'values', 'voice']) {
        if (!isRecord(artifact) || !isText(artifact[field])) fail('LOCALIZATION', target.id, `profile.${field}`, `人物プロフィールに${field}がありません。`);
      }
    }
  }

  for (const change of pkg.changes.filter(item => item.scope === 'story-scene')) {
    const lines = Array.isArray(change.data.lines) ? change.data.lines : [];
    if (lines.length === 0) fail('LOCALIZATION', change.id, 'lines', 'story sceneに台詞がありません。');
    lines.forEach((line, index) => {
      if (!isRecord(line)) {
        fail('LOCALIZATION', change.id, `lines[${index}]`, '台詞はオブジェクトで指定してください。');
        return;
      }
      if (!isText(line.text)) fail('LOCALIZATION', change.id, `lines[${index}].text`, '日本語台詞がありません。');
      if (!isText(line.textEn)) fail('LOCALIZATION', change.id, `lines[${index}].textEn`, '英語台詞がありません。');
      if (isText(line.text) && line.text.length > PRODUCTION_QUALITY_LIMITS.dialogueCharacters) fail('LOCALIZATION', change.id, `lines[${index}].text`, '1台詞がモバイル表示上限を超えています。');
      if (isText(line.textEn) && line.textEn.length > PRODUCTION_QUALITY_LIMITS.dialogueCharacters) fail('LOCALIZATION', change.id, `lines[${index}].textEn`, '英語台詞がモバイル表示上限を超えています。');
    });
  }

  const assetById = new Map(pkg.assets.map(asset => [asset.id, asset]));
  const referencedAssetIds = new Set<string>();
  for (const deliverable of pkg.deliverables) for (const ref of deliverable.outputRefs) if (ref.startsWith('asset:')) referencedAssetIds.add(ref.slice('asset:'.length));
  for (const asset of pkg.assets) for (const ref of asset.referenceAssetRefs) referencedAssetIds.add(ref);
  for (const presentation of pkg.presentation) for (const ref of presentation.vfx?.textureAssetRefs ?? []) referencedAssetIds.add(ref);

  for (const asset of pkg.assets) {
    if (!referencedAssetIds.has(asset.id)) fail('ASSET_REFERENCE', asset.id, 'id', 'manifestにはありますがdeliverable・派生asset・presentationのどこからも参照されていません。');
    for (const ref of asset.referenceAssetRefs) {
      const source = assetById.get(ref);
      if (!source) fail('ASSET_REFERENCE', asset.id, 'referenceAssetRefs', `参照assetが存在しません: ${ref}`);
      else if (source.state !== 'READY') fail('ASSET_REFERENCE', asset.id, 'referenceAssetRefs', `参照assetがREADYではありません: ${ref}`);
    }
    if (asset.state === 'READY') {
      if (asset.sourcePath && ctx.repositoryFiles && !ctx.repositoryFiles.has(asset.sourcePath)) fail('ASSET_REFERENCE', asset.id, 'sourcePath', `staging assetが存在しません: ${asset.sourcePath}`);
      if (asset.originalPath && ctx.repositoryFiles && !ctx.repositoryFiles.has(asset.originalPath)) fail('ASSET_REFERENCE', asset.id, 'originalPath', `生成原本が存在しません: ${asset.originalPath}`);
    }
  }

  if (ctx.packageMediaFiles) {
    const manifested = new Set(pkg.assets.flatMap(asset => [asset.sourcePath, asset.originalPath].filter((item): item is string => Boolean(item))));
    for (const file of ctx.packageMediaFiles) if (mediaPath(file) && !manifested.has(file) && !pkg.evidence.some(item => item.artifactPath === file)) fail('ASSET_REFERENCE', pkg.id, 'orphan', `package内の未登録mediaです: ${file}`);
  }
  if (ctx.generatedFiles && ctx.knownGeneratedAssetPaths) {
    for (const file of ctx.generatedFiles) if (!ctx.knownGeneratedAssetPaths.has(file)) fail('ASSET_REFERENCE', pkg.id, 'generatedOrphan', `public生成先のorphan assetです: ${file}`);
  }

  const presentationRefs = new Set(pkg.deliverables.flatMap(item => item.outputRefs.filter(ref => ref.startsWith('presentation:')).map(ref => ref.slice('presentation:'.length))));
  const skillEffectKeys = new Set(pkg.changes.filter(item => item.scope === 'skill').map(item => item.data.effectKey).filter(isText));
  for (const presentation of pkg.presentation) {
    if (!presentationRefs.has(presentation.id) && !skillEffectKeys.has(presentation.effectKey)) fail('PRESENTATION_REFERENCE', presentation.id, 'effectKey', '演出がskillまたはpresentation deliverableから参照されていません。');
    for (const ref of presentation.vfx?.textureAssetRefs ?? []) {
      const asset = assetById.get(ref);
      if (!asset) fail('PRESENTATION_REFERENCE', presentation.id, 'vfx.textureAssetRefs', `VFX texture assetが存在しません: ${ref}`);
      else if (asset.state !== 'READY') fail('PRESENTATION_REFERENCE', presentation.id, 'vfx.textureAssetRefs', `VFX texture assetがREADYではありません: ${ref}`);
    }
    for (const [index, cue] of (presentation.sfx?.cues ?? []).entries()) {
      if (!ctx.sfxProfileKeys.has(cue.profileKey)) fail('PRESENTATION_REFERENCE', presentation.id, `sfx.cues[${index}].profileKey`, `SFX profileが存在しません: ${cue.profileKey}`);
    }
    if ((presentation.sfx?.cues.length ?? 0) > 0) {
      for (const locale of ['ja', 'en'] as const) if (!localized(pkg, presentation.ownerId, locale, 'subtitle')) fail('ACCESSIBILITY', presentation.id, `subtitle.${locale}`, `SFXを伴う演出には${locale}字幕が必要です。`);
    }
    if (!presentation.accessibility?.colorIndependent || !presentation.vfx?.shapeCue?.trim()) fail('ACCESSIBILITY', presentation.id, 'colorIndependent', '色以外の形状手掛かりが必要です。');
    if (!presentation.accessibility?.reducedMotion) fail('ACCESSIBILITY', presentation.id, 'reducedMotion', 'reduced-motion代替が必要です。');
    if ((presentation.accessibility?.flashHzMax ?? Number.POSITIVE_INFINITY) > 3) fail('ACCESSIBILITY', presentation.id, 'flashHzMax', '点滅は3Hz以下にしてください。');
    if ((presentation.performance?.targetFrameMs ?? 0) < 16.6) fail('ACCESSIBILITY', presentation.id, 'targetFrameMs', '60fps以上を前提とする非現実的なframe予算です。');
  }

  for (const target of pkg.targets.filter(item => item.kind === 'skill')) {
    const change = pkg.changes.find(item => item.scope === 'skill' && item.id === target.id);
    const key = change?.data.effectKey;
    if (!isText(key) || !pkg.presentation.some(item => item.ownerId === target.id && item.effectKey === key)) fail('PRESENTATION_REFERENCE', target.id, 'effectKey', 'skill changeと専用presentationのeffectKeyが接続されていません。');
  }

  const packageStageIds = new Set(pkg.changes.filter(item => item.scope === 'stage').map(item => item.id));
  const availableStageIds = new Set([...ctx.stageIds, ...packageStageIds]);
  const packageItemIds = new Set(pkg.changes.filter(item => item.scope === 'weapon').map(item => item.id));
  const availableItemIds = new Set([...ctx.itemIds, ...packageItemIds]);
  const packageEnemyIds = new Set(pkg.changes.filter(item => item.scope === 'enemy').map(item => item.id));
  const availableEnemyIds = new Set([...ctx.enemyIds, ...packageEnemyIds]);

  for (const deliverable of pkg.deliverables.filter(item => item.scope === 'acquisition-link' && item.required)) {
    if (deliverable.state !== 'READY' || !deliverable.artifact) fail('ACQUISITION', deliverable.id, 'artifact', '必須の登場・入手導線がruntime artifactへ接続されていません。');
    for (const raw of valuesForKey(deliverable.artifact, 'stageId')) if (!isText(raw) || !availableStageIds.has(raw)) fail('ACQUISITION', deliverable.id, 'stageId', `stageが存在しません: ${String(raw)}`);
    for (const raw of valuesForKey(deliverable.artifact, 'enemyId')) if (!isText(raw) || !availableEnemyIds.has(raw)) fail('ACQUISITION', deliverable.id, 'enemyId', `enemyが存在しません: ${String(raw)}`);
    for (const raw of valuesForKey(deliverable.artifact, 'itemId')) if (!isText(raw) || !availableItemIds.has(raw)) fail('ACQUISITION', deliverable.id, 'itemId', `itemが存在しません: ${String(raw)}`);
    for (const raw of valuesForKey(deliverable.artifact, 'materialId')) if (!isText(raw) || !ctx.materialIds.has(raw)) fail('ACQUISITION', deliverable.id, 'materialId', `materialが存在しません: ${String(raw)}`);
  }

  for (const target of pkg.targets.filter(item => item.kind === 'weapon')) {
    const dropLinks = pkg.deliverables.filter(item => item.ownerId === target.id && item.scope === 'acquisition-link' && item.kind === 'drop-source' && item.state === 'READY');
    if (!dropLinks.some(item => valuesForKey(item.artifact, 'itemId').includes(target.id))) fail('ACQUISITION', target.id, 'drop-source', '武器のdrop-sourceが自身のitemIdへ接続されていません。');
  }

  for (const change of pkg.changes.filter(item => item.scope === 'stage')) {
    for (const raw of valuesForKey(change.data.waves, 'enemyIds').flatMap(value => Array.isArray(value) ? value : [value])) if (!isText(raw) || !availableEnemyIds.has(raw)) fail('ACQUISITION', change.id, 'waves.enemyIds', `WAVE enemyが存在しません: ${String(raw)}`);
    for (const raw of valuesForKey(change.data.rewards, 'itemId')) if (!isText(raw) || (!availableItemIds.has(raw) && !ctx.materialIds.has(raw))) fail('ACQUISITION', change.id, 'rewards.dropTable', `報酬参照が存在しません: ${String(raw)}`);
  }

  if (ctx.appliedPresentationKeys && ctx.masterSkillEffectKeys) {
    for (const key of ctx.appliedPresentationKeys) if (!ctx.masterSkillEffectKeys.has(key)) fail('PRESENTATION_REFERENCE', key, 'effectKey', 'applied registryにある未使用effectKeyです。');
  }

  if (!findings.some(item => item.level === 'FAIL')) add('PASS', 'RUNTIME', pkg.id, 'root', 'localization・accessibility・asset・presentation・acquisitionのproduction gateを通過しました。');
  return findings;
}

export function auditRuntimeQualityMetrics(metrics: RuntimeQualityMetrics): ProductionQualityFinding[] {
  const findings: ProductionQualityFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL' as const, category: 'RUNTIME' as const, id: metrics.id, field, message });
  if (metrics.documentWidth > metrics.viewportWidth) fail('documentWidth', `横overflow ${metrics.documentWidth - metrics.viewportWidth}pxを検出しました。`);
  if (metrics.clippedTextCount > 0) fail('clippedTextCount', `${metrics.clippedTextCount}件の意図しないテキストclipがあります。`);
  if (metrics.undersizedTargetCount > 0) fail('undersizedTargetCount', `${metrics.undersizedTargetCount}件の44px未満タッチ対象があります。`);
  if (metrics.initialTransferBytes > PRODUCTION_QUALITY_LIMITS.initialTransferBytes) fail('initialTransferBytes', `初回転送${metrics.initialTransferBytes} bytesが上限${PRODUCTION_QUALITY_LIMITS.initialTransferBytes} bytesを超えています。`);
  if (metrics.heapUsedBytes !== undefined && metrics.heapUsedBytes > PRODUCTION_QUALITY_LIMITS.heapUsedBytes) fail('heapUsedBytes', `JS heapが上限${PRODUCTION_QUALITY_LIMITS.heapUsedBytes} bytesを超えています。`);
  if (metrics.heapGrowthBytes !== undefined && metrics.heapGrowthBytes > PRODUCTION_QUALITY_LIMITS.heapGrowthBytes) fail('heapGrowthBytes', `操作後heap増加が上限${PRODUCTION_QUALITY_LIMITS.heapGrowthBytes} bytesを超えています。`);
  if (metrics.frameP95Ms > PRODUCTION_QUALITY_LIMITS.frameP95Ms) fail('frameP95Ms', `frame p95 ${metrics.frameP95Ms.toFixed(2)}msが${PRODUCTION_QUALITY_LIMITS.frameP95Ms}msを超えています。`);
  if (metrics.longFrameCount > PRODUCTION_QUALITY_LIMITS.maxLongFrames) fail('longFrameCount', `${PRODUCTION_QUALITY_LIMITS.longFrameMs}ms超frameが${metrics.longFrameCount}件あります。`);
  if (metrics.consoleErrorCount > 0) fail('consoleErrorCount', `${metrics.consoleErrorCount}件のconsole errorがあります。`);
  if (metrics.reducedMotionViolations > 0) fail('reducedMotionViolations', `reduced-motion時に${metrics.reducedMotionViolations}件の長時間animationが残っています。`);
  if (findings.length === 0) findings.push({ level: 'PASS', category: 'RUNTIME', id: metrics.id, field: 'root', message: '端末layout・load・memory・frame・reduced-motion gateを通過しました。' });
  return findings;
}
