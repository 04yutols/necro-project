import { prepareAssetPromptQueue, type AssetPromptQueue } from './assetForge';
import { standardAssetOutputPath, type AssetSpec } from './assetSpec';
import type { ContentFinding } from './contentBundle';
import type { GameplayArtifact } from './gameplayPackageAdapter';
import { materializeGameplayPackage } from './gameplayPackageAdapter';
import type { GameplayAuthoringContext } from './gameplayAuthoring';
import {
  CONTENT_COMPLETION_PROFILES,
  CONTENT_PIPELINE_STAGES,
  validateContentPackage,
  type AssetRecord,
  type ContentDeliverable,
  type ContentDependency,
  type ContentPackage,
  type ContentPackageOrchestration,
  type ContentPipelineStage,
  type ContentPipelineStageId,
  type ContentTarget,
  type ContentTargetKind,
  type SkillPresentationRecord,
} from './contentPackage';
import type { LoreEntry, LoreRelationship, LoreTimelineEvent } from './loreRegistry';
import { createFallbackPresentation, validateSkillPresentationSpec } from '../presentation/skillPresentation';
import type { ElementType, SkillAttackType } from '../../types/game';

export const CONTENT_ORCHESTRATION_REQUEST_VERSION = 1 as const;

export type OrchestrationAssetRequest = {
  id: string;
  kind: string;
  spec: AssetSpec;
  referenceAssetRefs?: string[];
  notes?: string;
};

export type OrchestrationPresentationRequest = {
  id: string;
  effectKey: string;
  element: ElementType;
  attackType: SkillAttackType;
  label: string;
};

export type OrchestrationTargetRequest = {
  id: string;
  kind: ContentTargetKind;
  nameJa: string;
  nameEn: string;
  description: string;
  loreRefs: string[];
  authoring?: GameplayArtifact;
  assets?: OrchestrationAssetRequest[];
  presentation?: OrchestrationPresentationRequest;
  artifacts?: Record<string, Record<string, unknown>>;
  acquisition?: Record<string, Record<string, unknown>>;
  dependsOnTargetIds?: string[];
};

export type ContentOrchestrationRequest = {
  schemaVersion: typeof CONTENT_ORCHESTRATION_REQUEST_VERSION;
  id: string;
  packageId: string;
  title: string;
  chapter: number;
  request: string;
  recipe: string;
  sourceRef: string;
  brief: ContentPackage['brief'];
  targets: OrchestrationTargetRequest[];
  lore: {
    registryRefs: string[];
    entries: LoreEntry[];
    relationships: LoreRelationship[];
    timelineEvents: LoreTimelineEvent[];
  };
};

export type ContentOrchestrationContext = {
  gameplay: GameplayAuthoringContext;
  validation?: Parameters<typeof validateContentPackage>[1];
};

export type ContentPipelineRunResult = {
  package: ContentPackage;
  stage: ContentPipelineStage;
  findings: ContentFinding[];
  assetQueue?: AssetPromptQueue;
};

const STAGE_DEPENDENCIES: Record<ContentPipelineStageId, ContentPipelineStageId[]> = {
  LORE: [],
  STATS: ['LORE'],
  SKILLS: ['STATS'],
  ASSETS: ['LORE'],
  PRESENTATION: ['SKILLS', 'ASSETS'],
  ACQUISITION: ['STATS', 'SKILLS'],
  VALIDATION: ['LORE', 'STATS', 'SKILLS', 'ASSETS', 'PRESENTATION', 'ACQUISITION'],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stageList(): ContentPipelineStage[] {
  return CONTENT_PIPELINE_STAGES.map(id => ({
    id,
    state: 'PENDING',
    dependsOn: [...STAGE_DEPENDENCIES[id]],
    attempt: 0,
    artifactRefs: [],
  }));
}

function deliverableId(targetId: string, scope: string, kind: string): string {
  return `${targetId}_${scope}_${kind}`.replaceAll('-', '_');
}

function localization(target: OrchestrationTargetRequest): ContentPackage['localization'] {
  return [
    { id: `${target.id}_name_ja`, ownerId: target.id, locale: 'ja', kind: 'name', text: target.nameJa },
    { id: `${target.id}_name_en`, ownerId: target.id, locale: 'en', kind: 'name', text: target.nameEn },
    { id: `${target.id}_alt_ja`, ownerId: target.id, locale: 'ja', kind: 'alt', text: `${target.nameJa}のゲーム内ビジュアル` },
    { id: `${target.id}_alt_en`, ownerId: target.id, locale: 'en', kind: 'alt', text: `Game visual for ${target.nameEn}` },
    { id: `${target.id}_description_ja`, ownerId: target.id, locale: 'ja', kind: 'description', text: target.description },
  ];
}

function assetsForTarget(target: OrchestrationTargetRequest): AssetRecord[] {
  return (target.assets ?? []).map(asset => ({
    id: asset.id,
    ownerId: target.id,
    kind: asset.kind,
    state: 'PLANNED',
    mediaType: 'image',
    format: 'webp',
    outputPath: standardAssetOutputPath(target.id, asset.spec),
    referenceAssetRefs: [...(asset.referenceAssetRefs ?? [])],
    spec: clone(asset.spec),
    notes: asset.notes,
  }));
}

function presentationForTarget(target: OrchestrationTargetRequest): SkillPresentationRecord[] {
  if (!target.presentation) return [];
  return [{
    id: target.presentation.id,
    ownerId: target.id,
    effectKey: target.presentation.effectKey,
    state: 'PLANNED',
    element: target.presentation.element,
    attackType: target.presentation.attackType,
    label: target.presentation.label,
    notes: 'PRESENTATION工程で決定論fallbackを専用effectKeyの草案へ展開する。',
  }];
}

function deliverablesForTarget(target: OrchestrationTargetRequest): ContentDeliverable[] {
  const profile = CONTENT_COMPLETION_PROFILES[target.kind];
  const assets = target.assets ?? [];
  const result = profile.deliverables.map(requirement => {
    const id = deliverableId(target.id, requirement.scope, requirement.kind);
    const matchingAsset = assets.find(asset => asset.kind === requirement.kind);
    const outputRefs = matchingAsset
      ? [`asset:${matchingAsset.id}`]
      : requirement.scope === 'skill-presentation' && target.presentation
        ? [`presentation:${target.presentation.id}`]
        : [];
    const artifact = target.artifacts?.[requirement.kind] ?? (requirement.scope === 'acquisition-link'
      ? target.acquisition?.[requirement.kind]
      : target.authoring && ((target.kind === 'skill' && requirement.scope === 'skill') || (target.kind === 'combat-unit' && requirement.scope === 'combat-unit' && requirement.kind === 'stats'))
        ? clone(target.authoring) as unknown as Record<string, unknown>
        : undefined);
    return {
      id,
      ownerId: target.id,
      scope: requirement.scope,
      kind: requirement.kind,
      required: true,
      state: 'PLANNED' as const,
      outputRefs,
      ...(artifact ? { artifact } : {}),
    };
  });
  if (target.authoring && !result.some(item => item.artifact && 'authoringKind' in item.artifact)) {
    result.push({
      id: `${target.id}_master_data`, ownerId: target.id, scope: 'combat-unit', kind: 'master-data', required: true,
      state: 'PLANNED', outputRefs: [], artifact: clone(target.authoring) as unknown as Record<string, unknown>,
    });
  }
  return result;
}

function dependenciesForTargets(targets: OrchestrationTargetRequest[], deliverables: ContentDeliverable[]): ContentDependency[] {
  const dependencies: ContentDependency[] = [];
  const byOwner = new Map<string, ContentDeliverable[]>();
  for (const deliverable of deliverables) byOwner.set(deliverable.ownerId, [...(byOwner.get(deliverable.ownerId) ?? []), deliverable]);
  const add = (from: string, to: string, relation: ContentDependency['relation'], reason: string) => {
    const id = `dep_${dependencies.length + 1}_${from.split(':').at(-1)}_${to.split(':').at(-1)}`.replaceAll('-', '_');
    dependencies.push({ id, from, to, relation, reason });
  };
  for (const target of targets) {
    const owned = byOwner.get(target.id) ?? [];
    const authored = owned.find(item => item.artifact && 'authoringKind' in item.artifact);
    for (const deliverable of owned) {
      if (authored && deliverable.id !== authored.id && ['asset', 'skill-presentation', 'acquisition-link'].includes(deliverable.scope)) {
        add(`deliverable:${deliverable.id}`, `deliverable:${authored.id}`, 'REQUIRES', '表示・演出・入手導線は確定した仕様とIDに依存する。');
      }
      const assetRef = deliverable.outputRefs.find(ref => ref.startsWith('asset:'));
      if (assetRef && deliverable.scope === 'skill-presentation') add(`deliverable:${deliverable.id}`, assetRef, 'USES', '演出は対応する画像仕様を使用する。');
    }
    for (const dependencyTargetId of target.dependsOnTargetIds ?? []) {
      add(`target:${target.id}`, `target:${dependencyTargetId}`, 'REQUIRES', '元依頼で指定された対象間依存。');
    }
  }
  return dependencies;
}

export function createOrchestratedContentPackage(
  request: ContentOrchestrationRequest,
  createdAt = new Date().toISOString(),
): ContentPackage {
  if (request.schemaVersion !== CONTENT_ORCHESTRATION_REQUEST_VERSION) throw new Error('Orchestration request schemaVersion must be 1.');
  if (request.chapter !== 1) throw new Error('第2章以降はDEFERREDです。現在は第1章packageだけを草案化できます。');
  if (!request.targets.length) throw new Error('Orchestration requestにはtargetが1件以上必要です。');
  const targets: ContentTarget[] = request.targets.map(target => ({ id: target.id, kind: target.kind, loreRefs: [...target.loreRefs] }));
  const deliverables = request.targets.flatMap(deliverablesForTarget);
  const orchestration: ContentPackageOrchestration = {
    request: { id: request.id, text: request.request, recipe: request.recipe, sourceRef: request.sourceRef },
    releaseScope: { chapter: request.chapter, state: 'IN_SCOPE', reason: '現在のrelease scopeである第1章「亡国の王都」に限定。' },
    state: 'PLANNED',
    stages: stageList(),
    updatedAt: createdAt,
  };
  return {
    schemaVersion: 2,
    id: request.packageId,
    title: request.title,
    revision: 1,
    chapter: request.chapter,
    status: 'DRAFT',
    brief: clone(request.brief),
    targets,
    lore: clone(request.lore),
    deliverables,
    dependencies: dependenciesForTargets(request.targets, deliverables),
    changes: [],
    assets: request.targets.flatMap(assetsForTarget),
    presentation: request.targets.flatMap(presentationForTarget),
    localization: request.targets.flatMap(localization),
    evidence: request.targets.flatMap(target => CONTENT_COMPLETION_PROFILES[target.kind].evidence.map(requirement => ({
      id: `${target.id}_${requirement.kind.replaceAll('-', '_')}`,
      ownerId: target.id,
      kind: requirement.kind,
      status: 'PENDING' as const,
      summary: `${requirement.label}は対応工程の実行待ち。`,
      createdAt,
    }))),
    orchestration,
    provenance: {
      createdAt,
      createdBy: { name: 'content-package-orchestrator', type: 'automation' },
      generator: { name: 'Necromance Brave Package Orchestrator', version: 'phase5' },
      prompts: [{ id: request.id, purpose: request.recipe, text: request.request }],
      references: [{ id: request.id, kind: 'request', uri: request.sourceRef }],
      hashAlgorithm: 'sha256',
    },
    review: { history: [], blockers: [] },
  };
}

function stageFor(pkg: ContentPackage, id: ContentPipelineStageId): ContentPipelineStage {
  const stage = pkg.orchestration?.stages.find(item => item.id === id);
  if (!stage) throw new Error(`Pipeline stage is missing: ${id}`);
  return stage;
}

function orchestrationFor(pkg: ContentPackage): ContentPackageOrchestration {
  if (!pkg.orchestration) throw new Error('Package has no orchestration metadata.');
  return pkg.orchestration;
}

function recomputePipelineState(orchestration: ContentPackageOrchestration): void {
  const states = orchestration.stages.map(stage => stage.state);
  orchestration.state = states.some(state => state === 'FAIL' || state === 'BLOCKED')
    ? 'PARTIAL'
    : states.every(state => state === 'PASS')
      ? 'READY'
      : states.some(state => state === 'RUNNING')
        ? 'RUNNING'
        : states.every(state => state === 'PENDING')
          ? 'PLANNED'
          : 'INCOMPLETE';
}

function dependentStageIds(root: ContentPipelineStageId): Set<ContentPipelineStageId> {
  const result = new Set<ContentPipelineStageId>([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of CONTENT_PIPELINE_STAGES) {
      if (!result.has(id) && STAGE_DEPENDENCIES[id].some(dependency => result.has(dependency))) {
        result.add(id);
        changed = true;
      }
    }
  }
  return result;
}

export function invalidateContentPipelineStage(source: ContentPackage, id: ContentPipelineStageId): ContentPackage {
  const pkg = clone(source);
  if (!pkg.orchestration) throw new Error('Package has no orchestration metadata.');
  for (const stage of pkg.orchestration.stages) {
    if (!dependentStageIds(id).has(stage.id)) continue;
    stage.state = 'PENDING';
    stage.artifactRefs = [];
    delete stage.summary;
    delete stage.findings;
    delete stage.startedAt;
    delete stage.completedAt;
  }
  pkg.orchestration.updatedAt = new Date().toISOString();
  recomputePipelineState(pkg.orchestration);
  delete pkg.provenance.contentHash;
  return pkg;
}

function markAuthoringDeliverablesReady(pkg: ContentPackage, kinds: GameplayArtifact['authoringKind'][]): string[] {
  const refs: string[] = [];
  for (const deliverable of pkg.deliverables) {
    const artifact = deliverable.artifact as (GameplayArtifact & Record<string, unknown>) | undefined;
    if (!artifact || !kinds.includes(artifact.authoringKind)) continue;
    const request = artifact.request as { id?: string };
    const change = pkg.changes.find(item => item.id === request.id);
    if (!change) continue;
    deliverable.state = 'READY';
    deliverable.outputRefs = [`change:${change.scope}:${change.id}`];
    refs.push(`deliverable:${deliverable.id}`, `change:${change.scope}:${change.id}`);
    if (artifact.authoringKind === 'combat-unit') {
      for (const sibling of pkg.deliverables.filter(item => item.ownerId === deliverable.ownerId && item.scope === 'combat-unit')) {
        sibling.state = 'READY';
        sibling.outputRefs = [`change:${change.scope}:${change.id}`];
        refs.push(`deliverable:${sibling.id}`);
      }
    }
  }
  return [...new Set(refs)];
}

function stageFailure(pkg: ContentPackage, stage: ContentPipelineStage, message: string, at: string): ContentPipelineRunResult {
  stage.state = 'FAIL';
  stage.summary = message;
  stage.findings = [{ level: 'FAIL', message }];
  stage.completedAt = at;
  for (const dependent of pkg.orchestration?.stages ?? []) {
    if (dependent.id !== stage.id && dependentStageIds(stage.id).has(dependent.id) && dependent.state === 'PENDING') {
      dependent.state = 'BLOCKED';
      dependent.summary = `${stage.id}失敗のため停止。`;
    }
  }
  if (pkg.orchestration) {
    pkg.orchestration.updatedAt = at;
    recomputePipelineState(pkg.orchestration);
  }
  return { package: pkg, stage, findings: [{ level: 'FAIL', scope: 'orchestration', id: stage.id, field: 'state', message }] };
}

export function runContentPipelineStage(
  source: ContentPackage,
  id: ContentPipelineStageId,
  ctx: ContentOrchestrationContext,
  at = new Date().toISOString(),
): ContentPipelineRunResult {
  let pkg = clone(source);
  if (pkg.status !== 'DRAFT') throw new Error('Pipeline regeneration is allowed only for DRAFT packages.');
  if (!pkg.orchestration) throw new Error('Package has no orchestration metadata.');
  if (pkg.chapter !== 1 || pkg.orchestration.releaseScope.state !== 'IN_SCOPE') throw new Error('DEFERRED package cannot run the production pipeline.');
  const originalStage = stageFor(pkg, id);
  if (originalStage.state !== 'PENDING' && originalStage.state !== 'BLOCKED') pkg = invalidateContentPipelineStage(pkg, id);
  const stage = stageFor(pkg, id);
  const blockedBy = stage.dependsOn.filter(dependency => !['PASS', 'WARN'].includes(stageFor(pkg, dependency).state));
  if (blockedBy.length) return stageFailure(pkg, stage, `依存工程が未完了です: ${blockedBy.join(', ')}`, at);
  stage.state = 'RUNNING';
  stage.attempt += 1;
  stage.startedAt = at;
  orchestrationFor(pkg).state = 'RUNNING';
  orchestrationFor(pkg).updatedAt = at;
  let findings: ContentFinding[] = [];
  let assetQueue: AssetPromptQueue | undefined;
  try {
    if (id === 'LORE') {
      const known = new Set([...pkg.lore.registryRefs, ...pkg.lore.entries.map(entry => entry.id)]);
      const missing = pkg.targets.flatMap(target => target.loreRefs.filter(ref => !known.has(ref)));
      if (missing.length) throw new Error(`Lore参照が依頼内で解決できません: ${[...new Set(missing)].join(', ')}`);
      stage.artifactRefs = [...pkg.lore.registryRefs.map(ref => `lore:${ref}`), ...pkg.lore.entries.map(entry => `lore:${entry.id}`)];
      stage.summary = `Lore ${stage.artifactRefs.length}参照を固定。`;
    } else if (id === 'STATS' || id === 'SKILLS') {
      const kinds: GameplayArtifact['authoringKind'][] = id === 'STATS' ? ['combat-unit', 'weapon', 'residue-name'] : ['skill'];
      const result = materializeGameplayPackage(pkg, ctx.gameplay, at, { kinds });
      pkg = result.package;
      const current = stageFor(pkg, id);
      current.attempt = stage.attempt;
      current.startedAt = stage.startedAt;
      findings = result.findings;
      if (findings.some(finding => finding.level === 'FAIL')) return stageFailure(pkg, current, `${id} authoring gateで失敗しました。`, at);
      current.artifactRefs = markAuthoringDeliverablesReady(pkg, kinds);
      current.summary = `${result.generatedChanges.length} master change / ${result.generatedEvidence.length} evidenceを生成。`;
    } else if (id === 'ASSETS') {
      const result = prepareAssetPromptQueue(pkg);
      pkg = result.package;
      const current = stageFor(pkg, id);
      current.attempt = stage.attempt;
      current.startedAt = stage.startedAt;
      assetQueue = result.queue;
      findings = result.findings.map(finding => ({ level: finding.level, scope: 'asset', id: finding.assetId, field: finding.field, message: finding.message }));
      if (findings.some(finding => finding.level === 'FAIL')) return stageFailure(pkg, current, 'AssetSpecまたは画像依存に失敗しました。', at);
      current.artifactRefs = result.queue.jobs.map(job => `asset:${job.assetId}`);
      current.summary = `${result.queue.jobs.length}画像のAssetSpec・生成プロンプト・参照順を草案化。`;
    } else if (id === 'PRESENTATION') {
      const refs: string[] = [];
      for (const record of pkg.presentation) {
        if (!record.element || !record.attackType || !record.label) throw new Error(`Presentation blueprintが不足しています: ${record.id}`);
        const spec = createFallbackPresentation(record.element, record.attackType, record.effectKey);
        const validation = validateSkillPresentationSpec(spec);
        if (validation.some(finding => finding.level === 'FAIL')) throw new Error(`${record.effectKey}: ${validation.map(item => item.message).join(' / ')}`);
        Object.assign(record, spec, { state: 'READY' as const, label: record.label });
        const skillChange = pkg.changes.find(change => change.scope === 'skill' && change.id === record.ownerId);
        if (skillChange) skillChange.data = { ...skillChange.data, effectKey: record.effectKey };
        refs.push(`presentation:${record.id}`);
        for (const deliverable of pkg.deliverables.filter(item => item.ownerId === record.ownerId && item.scope === 'skill-presentation')) {
          deliverable.state = 'READY';
          deliverable.outputRefs = [`presentation:${record.id}`];
          refs.push(`deliverable:${deliverable.id}`);
        }
      }
      stage.artifactRefs = refs;
      stage.summary = `${pkg.presentation.length}件のVFX/SFX timeline草案を生成。`;
      pkg.revision += 1;
    } else if (id === 'ACQUISITION') {
      const refs: string[] = [];
      const missing: string[] = [];
      const encounterIds = new Set(pkg.targets.filter(target => target.kind === 'encounter').map(target => target.id));
      for (const deliverable of pkg.deliverables.filter(item => item.scope === 'acquisition-link' || (encounterIds.has(item.ownerId) && item.scope === 'combat-unit'))) {
        if (!deliverable.artifact) {
          missing.push(deliverable.id);
          continue;
        }
        deliverable.state = 'READY';
        deliverable.outputRefs = [`deliverable:${deliverable.id}`];
        refs.push(`deliverable:${deliverable.id}`);
      }
      if (missing.length) throw new Error(`入手・登場導線の草案が不足しています: ${missing.join(', ')}`);
      stage.artifactRefs = refs;
      stage.summary = `${refs.length}件のstage・wave・drop・story接続草案を生成。`;
      pkg.revision += 1;
    } else {
      findings = validateContentPackage(pkg, ctx.validation);
      const structuralFails = findings.filter(finding => finding.level === 'FAIL' && finding.scope !== 'orchestration');
      if (structuralFails.length) return stageFailure(pkg, stageFor(pkg, id), `${structuralFails.length}件の構造・参照エラーがあります。`, at);
      stage.artifactRefs = ['package:validation-report'];
      stage.summary = `${findings.filter(finding => finding.level === 'WARN').length}件の未完成項目を検出。画像原本など人間・生成ツール待ちを保持。`;
    }
    const completed = stageFor(pkg, id);
    completed.state = findings.some(finding => finding.level === 'WARN') || (id === 'VALIDATION' && findings.some(finding => finding.level !== 'PASS')) ? 'WARN' : 'PASS';
    completed.findings = findings.filter(finding => finding.level === 'WARN' || finding.level === 'FAIL').map(finding => ({ level: finding.level as 'WARN' | 'FAIL', message: finding.message }));
    completed.completedAt = at;
    orchestrationFor(pkg).updatedAt = at;
    recomputePipelineState(orchestrationFor(pkg));
    delete pkg.provenance.contentHash;
    return { package: pkg, stage: completed, findings, assetQueue };
  } catch (error) {
    return stageFailure(pkg, stageFor(pkg, id), error instanceof Error ? error.message : String(error), at);
  }
}

export function runContentPipeline(
  source: ContentPackage,
  ctx: ContentOrchestrationContext,
  at = new Date().toISOString(),
): { package: ContentPackage; results: ContentPipelineRunResult[] } {
  let pkg = clone(source);
  const results: ContentPipelineRunResult[] = [];
  for (const id of CONTENT_PIPELINE_STAGES) {
    const result = runContentPipelineStage(pkg, id, ctx, at);
    results.push(result);
    pkg = result.package;
    if (result.stage.state === 'FAIL') break;
  }
  return { package: pkg, results };
}
