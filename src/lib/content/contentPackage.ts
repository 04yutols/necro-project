import { createHash } from 'crypto';
import {
  CONTENT_SCOPES,
  validateContentBundle,
  type ContentChange,
  type ContentFinding,
  type ContentValidationContext,
} from './contentBundle';
import {
  isLoreRegistry,
  validateLoreRegistry,
  type LoreEntry,
  type LoreRegistry,
  type LoreRelationship,
  type LoreTimelineEvent,
} from './loreRegistry';
import { assetUsageRequiresReference, standardAssetOutputPath, validateAssetSpec, type AssetSpec } from './assetSpec';
import type { ElementType, SkillAttackType } from '../../types/game';
import { validateSkillPresentationSpec, type SkillPresentationSpec } from '../presentation/skillPresentation';

export const CONTENT_PACKAGE_STATES = ['DRAFT', 'VALIDATED', 'REVIEWED', 'APPROVED', 'APPLIED', 'BLOCKED'] as const;
export const CONTENT_PACKAGE_SCOPES = ['character-profile', 'combat-unit', 'skill', 'asset', 'skill-presentation', 'acquisition-link'] as const;
export const CONTENT_TARGET_KINDS = ['story-character', 'combat-unit', 'weapon', 'skill', 'abyssal-residue', 'encounter'] as const;
export const DELIVERABLE_STATES = ['PLANNED', 'READY', 'BLOCKED'] as const;
export const ARTIFACT_STATES = ['PLANNED', 'READY', 'BLOCKED'] as const;
export const EVIDENCE_STATES = ['PENDING', 'PASS', 'WARN', 'FAIL'] as const;
export const ACTOR_TYPES = ['human', 'codex', 'automation'] as const;
export const CONTENT_LOCALES = ['ja', 'en'] as const;
export const LOCALIZATION_KINDS = ['name', 'description', 'dialogue', 'alt', 'subtitle'] as const;
export const CONTENT_PIPELINE_STAGES = ['LORE', 'STATS', 'SKILLS', 'ASSETS', 'PRESENTATION', 'ACQUISITION', 'VALIDATION'] as const;
export const CONTENT_PIPELINE_STAGE_STATES = ['PENDING', 'RUNNING', 'PASS', 'WARN', 'FAIL', 'BLOCKED'] as const;
export const CONTENT_PIPELINE_STATES = ['PLANNED', 'RUNNING', 'INCOMPLETE', 'PARTIAL', 'READY'] as const;
export const CONTENT_REVIEW_ITEM_STATES = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED'] as const;
export const CONTENT_REVIEW_AUDIT_ACTIONS = [
  'REVIEW_INITIALIZED',
  'ITEM_APPROVED',
  'CHANGES_REQUESTED',
  'ITEM_RESET',
  'STAGE_REGENERATED',
  'UNDO_COMPLETED',
  'UNDO_CONFLICT',
] as const;

export type ContentPackageState = (typeof CONTENT_PACKAGE_STATES)[number];
export type ContentPackageScope = (typeof CONTENT_PACKAGE_SCOPES)[number];
export type ContentTargetKind = (typeof CONTENT_TARGET_KINDS)[number];
export type DeliverableState = (typeof DELIVERABLE_STATES)[number];
export type ArtifactState = (typeof ARTIFACT_STATES)[number];
export type EvidenceState = (typeof EVIDENCE_STATES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export type LocalizationKind = (typeof LOCALIZATION_KINDS)[number];
export type ContentPipelineStageId = (typeof CONTENT_PIPELINE_STAGES)[number];
export type ContentPipelineStageState = (typeof CONTENT_PIPELINE_STAGE_STATES)[number];
export type ContentPipelineState = (typeof CONTENT_PIPELINE_STATES)[number];
export type ContentReviewItemState = (typeof CONTENT_REVIEW_ITEM_STATES)[number];
export type ContentReviewAuditAction = (typeof CONTENT_REVIEW_AUDIT_ACTIONS)[number];

export type ContentTarget = {
  id: string;
  kind: ContentTargetKind;
  loreRefs: string[];
};

export type ContentDeliverable = {
  id: string;
  ownerId: string;
  scope: ContentPackageScope;
  kind: string;
  required: boolean;
  state: DeliverableState;
  outputRefs: string[];
  artifact?: Record<string, unknown>;
  notes?: string;
};

export type ContentDependency = {
  id: string;
  from: string;
  to: string;
  relation: 'REQUIRES' | 'USES' | 'INTEGRATES';
  reason: string;
};

export type AssetRecord = {
  id: string;
  ownerId: string;
  kind: string;
  state: ArtifactState;
  mediaType: 'image' | 'audio';
  format: 'png' | 'webp' | 'jpg' | 'svg' | 'mp3' | 'wav' | 'ogg';
  originalPath?: string;
  sourcePath?: string;
  outputPath: string;
  width?: number;
  height?: number;
  alpha?: boolean;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  bytes?: number;
  contentHash?: string;
  provenancePromptRef?: string;
  referenceAssetRefs: string[];
  spec?: AssetSpec;
  notes?: string;
};

export type SkillPresentationRecord = {
  id: string;
  ownerId: string;
  effectKey: string;
  state: ArtifactState;
  element?: ElementType;
  attackType?: SkillAttackType;
  label?: string;
  timeline?: SkillPresentationSpec['timeline'];
  vfx?: SkillPresentationSpec['vfx'];
  sfx?: SkillPresentationSpec['sfx'];
  accessibility?: SkillPresentationSpec['accessibility'];
  performance?: SkillPresentationSpec['performance'];
  notes?: string;
};

export type ContentEvidence = {
  id: string;
  ownerId: string;
  kind: string;
  status: EvidenceState;
  summary: string;
  artifactPath?: string;
  contentHash?: string;
  createdAt: string;
};

export type ContentLocalization = {
  id: string;
  ownerId: string;
  locale: ContentLocale;
  kind: LocalizationKind;
  text: string;
};

export type ContentPackageHistory = {
  from: ContentPackageState;
  to: ContentPackageState;
  actor: string;
  actorType: ActorType;
  at: string;
  comment?: string;
};

export type ContentReviewItem = {
  ref: string;
  status: ContentReviewItemState;
  contentHash: string;
  reviewer?: string;
  reviewedAt?: string;
  comment?: string;
};

export type ContentReviewAuditEvent = {
  id: string;
  action: ContentReviewAuditAction;
  actor: string;
  actorType: ActorType;
  at: string;
  comment: string;
  subjectRef?: string;
  details?: Record<string, unknown>;
};

export type ContentPipelineStage = {
  id: ContentPipelineStageId;
  state: ContentPipelineStageState;
  dependsOn: ContentPipelineStageId[];
  attempt: number;
  artifactRefs: string[];
  summary?: string;
  findings?: Array<{ level: 'WARN' | 'FAIL'; message: string }>;
  startedAt?: string;
  completedAt?: string;
};

export type ContentPackageOrchestration = {
  request: {
    id: string;
    text: string;
    recipe: string;
    sourceRef: string;
  };
  releaseScope: {
    chapter: number;
    state: 'IN_SCOPE' | 'DEFERRED';
    reason: string;
  };
  state: ContentPipelineState;
  stages: ContentPipelineStage[];
  updatedAt: string;
};

export type ContentPackage = {
  schemaVersion: 2;
  id: string;
  title: string;
  revision: number;
  chapter: number;
  status: ContentPackageState;
  brief: {
    playerExperience: string;
    themes: string[];
    mustInclude: string[];
    avoid: string[];
  };
  targets: ContentTarget[];
  lore: {
    registryRefs: string[];
    entries: LoreEntry[];
    relationships: LoreRelationship[];
    timelineEvents: LoreTimelineEvent[];
  };
  deliverables: ContentDeliverable[];
  dependencies: ContentDependency[];
  changes: ContentChange[];
  assets: AssetRecord[];
  presentation: SkillPresentationRecord[];
  localization: ContentLocalization[];
  evidence: ContentEvidence[];
  orchestration?: ContentPackageOrchestration;
  provenance: {
    createdAt: string;
    createdBy: { name: string; type: ActorType };
    generator: { name: string; model?: string; version?: string };
    prompts: Array<{ id: string; purpose: string; text: string }>;
    references: Array<{ id: string; kind: 'file' | 'image' | 'url' | 'request'; uri: string; contentHash?: string }>;
    hashAlgorithm: 'sha256';
    contentHash?: string;
  };
  review: {
    history: ContentPackageHistory[];
    blockers: string[];
    snapshot?: string;
    items?: ContentReviewItem[];
    audit?: ContentReviewAuditEvent[];
  };
};

export type AssetFileInfo = {
  exists: boolean;
  bytes?: number;
  sha256?: string;
};

export type ContentPackageValidationContext = {
  bundle?: ContentValidationContext;
  loreRegistry?: LoreRegistry;
  assetFiles?: Record<string, AssetFileInfo>;
  presentationRegistry?: Record<string, SkillPresentationSpec>;
};

type DeliverableRequirement = { scope: ContentPackageScope; kind: string; label: string };
type EvidenceRequirement = { kind: string; label: string };
type ChangeRequirement = { scopes: ContentChange['scope'][]; label: string };
type LocalizationRequirement = { locale: ContentLocale; kind: LocalizationKind; label: string };

export type CompletionProfile = {
  deliverables: DeliverableRequirement[];
  evidence: EvidenceRequirement[];
  localization: LocalizationRequirement[];
  change?: ChangeRequirement;
};

const BILINGUAL_NAME_AND_ALT: LocalizationRequirement[] = [
  { locale: 'ja', kind: 'name', label: '日本語名' },
  { locale: 'en', kind: 'name', label: '英語名' },
  { locale: 'ja', kind: 'alt', label: '日本語画像alt' },
  { locale: 'en', kind: 'alt', label: '英語画像alt' },
];

export const CONTENT_COMPLETION_PROFILES: Record<ContentTargetKind, CompletionProfile> = {
  'story-character': {
    change: { scopes: ['story-character'], label: '人物マスターデータ' },
    deliverables: [
      { scope: 'character-profile', kind: 'profile', label: '人物プロフィール' },
      { scope: 'character-profile', kind: 'relationships', label: '人物関係・時系列' },
      { scope: 'asset', kind: 'portrait-base', label: '基準立ち絵' },
      { scope: 'asset', kind: 'expression-set', label: '使用表情差分' },
      { scope: 'acquisition-link', kind: 'story-entry', label: '登場シーン接続' },
    ],
    evidence: [],
    localization: BILINGUAL_NAME_AND_ALT,
  },
  'combat-unit': {
    change: { scopes: ['enemy', 'monster', 'job'], label: 'enemy / monster / Aldo jobマスターデータ' },
    deliverables: [
      { scope: 'combat-unit', kind: 'identity', label: '戦闘ユニット種別' },
      { scope: 'combat-unit', kind: 'stats', label: '8ステータス・耐性・リソース' },
      { scope: 'combat-unit', kind: 'growth', label: '成長曲線' },
      { scope: 'combat-unit', kind: 'skill-set', label: '通常行動・スキル・AI条件' },
      { scope: 'asset', kind: 'battle-visual', label: 'バトル表示' },
      { scope: 'asset', kind: 'icon', label: 'ユニットアイコン' },
      { scope: 'skill-presentation', kind: 'unit-lifecycle', label: '出現・攻撃・被弾・撃破演出' },
      { scope: 'acquisition-link', kind: 'runtime', label: 'ステージ・使役・報酬接続' },
    ],
    evidence: [{ kind: 'balance-simulation', label: 'EHP・TTK・AV・コスト評価' }],
    localization: BILINGUAL_NAME_AND_ALT,
  },
  weapon: {
    change: { scopes: ['weapon'], label: '武器マスターデータ' },
    deliverables: [
      { scope: 'asset', kind: 'inventory-icon', label: '武器インベントリアイコン' },
      { scope: 'asset', kind: 'detail-art', label: '武器詳細・カード画像' },
      { scope: 'acquisition-link', kind: 'drop-source', label: '入手元' },
      { scope: 'acquisition-link', kind: 'inventory-equip', label: '所持・装備接続' },
    ],
    evidence: [{ kind: 'weapon-balance', label: '武器バランス検証' }],
    localization: BILINGUAL_NAME_AND_ALT,
  },
  skill: {
    change: { scopes: ['skill'], label: 'スキルマスターデータ' },
    deliverables: [
      { scope: 'skill', kind: 'mechanics', label: '威力・コスト・対象・状態異常' },
      { scope: 'asset', kind: 'skill-icon', label: 'スキルアイコン' },
      { scope: 'skill-presentation', kind: 'timeline', label: 'VFX・SFX・ダメージ時刻' },
      { scope: 'acquisition-link', kind: 'owner', label: '職業・魔物・敵AI接続' },
    ],
    evidence: [
      { kind: 'skill-balance', label: 'スキルバランス検証' },
      { kind: 'presentation-preview', label: '演出プレビュー証跡' },
    ],
    localization: BILINGUAL_NAME_AND_ALT,
  },
  'abyssal-residue': {
    change: { scopes: ['residue-name'], label: '残滓名称データ' },
    deliverables: [
      { scope: 'asset', kind: 'slot-visual', label: '残滓スロット画像' },
      { scope: 'acquisition-link', kind: 'name-pool', label: '名称プール・ドロップ・装備UI接続' },
    ],
    evidence: [],
    localization: BILINGUAL_NAME_AND_ALT,
  },
  encounter: {
    change: { scopes: ['stage'], label: 'ステージ・WAVE・報酬マスターデータ' },
    deliverables: [
      { scope: 'combat-unit', kind: 'enemy-data', label: '敵・WAVEデータ' },
      { scope: 'asset', kind: 'background', label: '戦闘背景' },
      { scope: 'asset', kind: 'enemy-visual', label: '敵表示' },
      { scope: 'acquisition-link', kind: 'stage-wave', label: 'ステージ・WAVE接続' },
      { scope: 'acquisition-link', kind: 'reward', label: '報酬接続' },
      { scope: 'acquisition-link', kind: 'story-trigger', label: 'ストーリートリガー接続' },
    ],
    evidence: [
      { kind: 'combat-simulation', label: 'TTK・被ダメージ検証' },
      { kind: 'clear-flow', label: '解放・戦闘・リザルト永続化証跡' },
    ],
    localization: BILINGUAL_NAME_AND_ALT,
  },
};

export const ALLOWED_PACKAGE_TRANSITIONS: Record<ContentPackageState, readonly ContentPackageState[]> = {
  DRAFT: ['VALIDATED', 'BLOCKED'],
  VALIDATED: ['DRAFT', 'REVIEWED', 'BLOCKED'],
  REVIEWED: ['DRAFT', 'APPROVED', 'BLOCKED'],
  APPROVED: ['DRAFT', 'APPLIED', 'BLOCKED'],
  APPLIED: [],
  BLOCKED: ['DRAFT'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(isNonEmptyString);
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function validId(value: unknown): value is string {
  return isNonEmptyString(value) && /^[a-z][a-z0-9_]*$/.test(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(value).filter(key => !allowedSet.has(key));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function isSafeRepositoryPath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.startsWith('/') || value.startsWith('\\')) return false;
  const normalized = value.replaceAll('\\', '/');
  return !normalized.split('/').some(segment => segment === '..' || segment === '');
}

function isGeneratedAssetPath(value: string, mediaType: unknown): boolean {
  return mediaType === 'image'
    ? value.startsWith('public/images/generated/')
    : mediaType === 'audio' && value.startsWith('public/audio/generated/');
}

function formatMatchesMediaType(format: unknown, mediaType: unknown): boolean {
  if (mediaType === 'image') return ['png', 'webp', 'jpg', 'svg'].includes(String(format));
  if (mediaType === 'audio') return ['mp3', 'wav', 'ogg'].includes(String(format));
  return false;
}

function pathMatchesFormat(filePath: unknown, format: unknown): boolean {
  return typeof filePath === 'string' && typeof format === 'string' && filePath.toLowerCase().endsWith(`.${format.toLowerCase()}`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
  }
  return result;
}

function packageHashPayload(pkg: ContentPackage): Record<string, unknown> {
  return {
    schemaVersion: pkg.schemaVersion,
    id: pkg.id,
    title: pkg.title,
    chapter: pkg.chapter,
    brief: pkg.brief,
    targets: pkg.targets,
    lore: pkg.lore,
    deliverables: pkg.deliverables,
    dependencies: pkg.dependencies,
    changes: pkg.changes,
    assets: pkg.assets,
    presentation: pkg.presentation,
    localization: pkg.localization,
  };
}

export function calculateContentPackageHash(pkg: ContentPackage): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(packageHashPayload(pkg)))).digest('hex');
}

export type ContentReviewRefKind = 'target' | 'change' | 'asset' | 'presentation' | 'evidence';

export function parseContentReviewRef(ref: string): { kind: ContentReviewRefKind; id: string } | undefined {
  const separator = ref.indexOf(':');
  if (separator <= 0 || separator === ref.length - 1) return undefined;
  const kind = ref.slice(0, separator);
  if (!['target', 'change', 'asset', 'presentation', 'evidence'].includes(kind)) return undefined;
  return { kind: kind as ContentReviewRefKind, id: ref.slice(separator + 1) };
}

export function getRequiredContentReviewRefs(pkg: ContentPackage): string[] {
  return [
    ...pkg.targets.map(item => `target:${item.id}`),
    ...pkg.changes.map(item => `change:${item.scope}:${item.id}`),
    ...pkg.assets.map(item => `asset:${item.id}`),
    ...pkg.presentation.map(item => `presentation:${item.id}`),
    ...pkg.evidence.map(item => `evidence:${item.id}`),
  ];
}

function contentReviewPayload(pkg: ContentPackage, ref: string): unknown {
  const parsed = parseContentReviewRef(ref);
  if (!parsed) return undefined;
  if (parsed.kind === 'target') {
    const target = pkg.targets.find(item => item.id === parsed.id);
    if (!target) return undefined;
    const ownedRefs = new Set<string>([
      target.id,
      ...pkg.deliverables.filter(item => item.ownerId === target.id).map(item => item.id),
      ...pkg.assets.filter(item => item.ownerId === target.id).map(item => item.id),
      ...pkg.presentation.filter(item => item.ownerId === target.id).map(item => item.id),
      ...pkg.evidence.filter(item => item.ownerId === target.id).map(item => item.id),
    ]);
    return {
      brief: pkg.brief,
      target,
      lore: pkg.lore,
      deliverables: pkg.deliverables.filter(item => item.ownerId === target.id),
      dependencies: pkg.dependencies.filter(item => ownedRefs.has(item.from) || ownedRefs.has(item.to)),
      localization: pkg.localization.filter(item => item.ownerId === target.id),
    };
  }
  if (parsed.kind === 'change') {
    const separator = parsed.id.indexOf(':');
    if (separator <= 0) return undefined;
    const scope = parsed.id.slice(0, separator);
    const id = parsed.id.slice(separator + 1);
    return pkg.changes.find(item => item.scope === scope && item.id === id);
  }
  if (parsed.kind === 'asset') {
    const asset = pkg.assets.find(item => item.id === parsed.id);
    if (!asset) return undefined;
    return {
      asset,
      localization: pkg.localization.filter(item => item.ownerId === asset.ownerId),
      prompt: pkg.provenance.prompts.find(item => item.id === asset.provenancePromptRef),
    };
  }
  if (parsed.kind === 'presentation') return pkg.presentation.find(item => item.id === parsed.id);
  return pkg.evidence.find(item => item.id === parsed.id);
}

export function calculateContentReviewItemHash(pkg: ContentPackage, ref: string): string | undefined {
  const payload = contentReviewPayload(pkg, ref);
  if (payload === undefined) return undefined;
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

function findDependencyCycle(edges: Map<string, string[]>): string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (node: string): string[] | undefined => {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return [...path.slice(start), node];
    }
    if (visited.has(node)) return undefined;
    visiting.add(node);
    path.push(node);
    for (const next of edges.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return undefined;
  };

  for (const node of edges.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return undefined;
}

function isStrictCompletenessState(state: unknown): boolean {
  return state === 'VALIDATED' || state === 'REVIEWED' || state === 'APPROVED' || state === 'APPLIED';
}

export function validateContentPackage(value: unknown, ctx: ContentPackageValidationContext = {}): ContentFinding[] {
  const findings: ContentFinding[] = [];
  const add = (level: ContentFinding['level'], scope: string, id: string, field: string, message: string) =>
    findings.push({ level, scope, id, field, message });

  if (!isRecord(value)) return [{ level: 'FAIL', scope: 'package', id: '?', field: 'root', message: 'Content Package はオブジェクトである必要があります。' }];
  const packageId = typeof value.id === 'string' ? value.id : '?';
  const strict = isStrictCompletenessState(value.status);
  const incomplete = (scope: string, id: string, field: string, message: string) => add(strict ? 'FAIL' : 'WARN', scope, id, field, message);
  const rejectUnknown = (record: Record<string, unknown>, allowed: readonly string[], scope: string, id: string, prefix = '') => {
    for (const key of unknownKeys(record, allowed)) add('FAIL', scope, id, prefix ? `${prefix}.${key}` : key, `未定義フィールドです: ${key}`);
  };

  rejectUnknown(value, ['schemaVersion', 'id', 'title', 'revision', 'chapter', 'status', 'brief', 'targets', 'lore', 'deliverables', 'dependencies', 'changes', 'assets', 'presentation', 'localization', 'evidence', 'orchestration', 'provenance', 'review'], 'package', packageId);

  if (value.schemaVersion !== 2) add('FAIL', 'package', packageId, 'schemaVersion', 'Content Package の schemaVersion は 2 である必要があります。');
  if (!validId(value.id)) add('FAIL', 'package', packageId, 'id', 'package id は snake_case で指定してください。');
  if (!isNonEmptyString(value.title)) add('FAIL', 'package', packageId, 'title', 'title は非空文字列である必要があります。');
  if (!Number.isInteger(value.revision) || Number(value.revision) < 1) add('FAIL', 'package', packageId, 'revision', 'revision は1以上の整数である必要があります。');
  if (!Number.isInteger(value.chapter) || Number(value.chapter) < 1) add('FAIL', 'package', packageId, 'chapter', 'chapter は1以上の整数である必要があります。');
  if (Number(value.chapter) > 1) add('FAIL', 'package', packageId, 'chapter', '第2章以降はDEFERREDです。release scopeが変更されるまでpackageの制作・適用は禁止されています。');
  if (!(CONTENT_PACKAGE_STATES as readonly unknown[]).includes(value.status)) add('FAIL', 'package', packageId, 'status', '未対応のpackage statusです。');

  if (!isRecord(value.brief)) {
    add('FAIL', 'package', packageId, 'brief', 'brief が必要です。');
  } else {
    rejectUnknown(value.brief, ['playerExperience', 'themes', 'mustInclude', 'avoid'], 'package', packageId, 'brief');
    if (!isNonEmptyString(value.brief.playerExperience)) add('FAIL', 'package', packageId, 'brief.playerExperience', 'playerExperience は非空文字列である必要があります。');
    if (!isStringArray(value.brief.themes, false)) add('FAIL', 'package', packageId, 'brief.themes', 'themes は1件以上必要です。');
    if (!isStringArray(value.brief.mustInclude)) add('FAIL', 'package', packageId, 'brief.mustInclude', 'mustInclude は文字列配列である必要があります。');
    if (!isStringArray(value.brief.avoid)) add('FAIL', 'package', packageId, 'brief.avoid', 'avoid は文字列配列である必要があります。');
  }

  const arrayFields = ['targets', 'deliverables', 'dependencies', 'changes', 'assets', 'presentation', 'localization', 'evidence'] as const;
  for (const field of arrayFields) if (!Array.isArray(value[field])) add('FAIL', 'package', packageId, field, `${field} は配列である必要があります。`);
  if (!Array.isArray(value.targets) || value.targets.length === 0) add('FAIL', 'package', packageId, 'targets', 'targets は1件以上必要です。');
  if (!isRecord(value.lore)) add('FAIL', 'package', packageId, 'lore', 'lore セクションが必要です。');
  if (!isRecord(value.provenance)) add('FAIL', 'package', packageId, 'provenance', 'provenance セクションが必要です。');
  if (!isRecord(value.review)) add('FAIL', 'package', packageId, 'review', 'review セクションが必要です。');

  if (!Array.isArray(value.targets) || !Array.isArray(value.deliverables) || !Array.isArray(value.dependencies) || !Array.isArray(value.changes) || !Array.isArray(value.assets) || !Array.isArray(value.presentation) || !Array.isArray(value.localization) || !Array.isArray(value.evidence) || !isRecord(value.lore) || !isRecord(value.provenance) || !isRecord(value.review)) return findings;

  const pkg = value as unknown as ContentPackage;
  if (value.orchestration !== undefined) {
    if (!isRecord(value.orchestration)) {
      add('FAIL', 'orchestration', packageId, 'root', 'orchestration はオブジェクトである必要があります。');
    } else {
      const orchestration = value.orchestration;
      rejectUnknown(orchestration, ['request', 'releaseScope', 'state', 'stages', 'updatedAt'], 'orchestration', packageId);
      if (!isRecord(orchestration.request)) add('FAIL', 'orchestration', packageId, 'request', '元依頼の記録が必要です。');
      else {
        rejectUnknown(orchestration.request, ['id', 'text', 'recipe', 'sourceRef'], 'orchestration', packageId, 'request');
        if (!validId(orchestration.request.id)) add('FAIL', 'orchestration', packageId, 'request.id', 'request id は snake_case で指定してください。');
        for (const field of ['text', 'recipe', 'sourceRef'] as const) if (!isNonEmptyString(orchestration.request[field])) add('FAIL', 'orchestration', packageId, `request.${field}`, `${field} は非空文字列である必要があります。`);
      }
      if (!isRecord(orchestration.releaseScope)) add('FAIL', 'orchestration', packageId, 'releaseScope', 'release scope判定が必要です。');
      else {
        rejectUnknown(orchestration.releaseScope, ['chapter', 'state', 'reason'], 'orchestration', packageId, 'releaseScope');
        if (orchestration.releaseScope.chapter !== value.chapter) add('FAIL', 'orchestration', packageId, 'releaseScope.chapter', 'package chapterと一致していません。');
        if (!['IN_SCOPE', 'DEFERRED'].includes(String(orchestration.releaseScope.state))) add('FAIL', 'orchestration', packageId, 'releaseScope.state', 'IN_SCOPEまたはDEFERREDを指定してください。');
        if (Number(value.chapter) === 1 && orchestration.releaseScope.state !== 'IN_SCOPE') add('FAIL', 'orchestration', packageId, 'releaseScope.state', '第1章packageはIN_SCOPEである必要があります。');
        if (Number(value.chapter) > 1 && orchestration.releaseScope.state !== 'DEFERRED') add('FAIL', 'orchestration', packageId, 'releaseScope.state', '第2章以降はDEFERREDである必要があります。');
        if (!isNonEmptyString(orchestration.releaseScope.reason)) add('FAIL', 'orchestration', packageId, 'releaseScope.reason', 'scope判定理由が必要です。');
      }
      if (!(CONTENT_PIPELINE_STATES as readonly unknown[]).includes(orchestration.state)) add('FAIL', 'orchestration', packageId, 'state', '未対応のpipeline stateです。');
      if (!isIsoDate(orchestration.updatedAt)) add('FAIL', 'orchestration', packageId, 'updatedAt', 'updatedAtはISO日時で指定してください。');
      if (!Array.isArray(orchestration.stages)) {
        add('FAIL', 'orchestration', packageId, 'stages', 'stagesは配列である必要があります。');
      } else {
        const stageIds = new Set<string>();
        for (const rawStage of orchestration.stages) {
          if (!isRecord(rawStage)) {
            add('FAIL', 'orchestration', packageId, 'stages', '各stageはオブジェクトである必要があります。');
            continue;
          }
          const stageId = String(rawStage.id ?? '?');
          rejectUnknown(rawStage, ['id', 'state', 'dependsOn', 'attempt', 'artifactRefs', 'summary', 'findings', 'startedAt', 'completedAt'], 'orchestration', stageId, 'stage');
          if (!(CONTENT_PIPELINE_STAGES as readonly unknown[]).includes(rawStage.id)) add('FAIL', 'orchestration', stageId, 'id', '未対応のpipeline stageです。');
          if (stageIds.has(stageId)) add('FAIL', 'orchestration', stageId, 'id', 'stage idが重複しています。');
          stageIds.add(stageId);
          if (!(CONTENT_PIPELINE_STAGE_STATES as readonly unknown[]).includes(rawStage.state)) add('FAIL', 'orchestration', stageId, 'state', '未対応のstage stateです。');
          if (!isStringArray(rawStage.dependsOn)) add('FAIL', 'orchestration', stageId, 'dependsOn', 'dependsOnはstage id配列である必要があります。');
          if (!Number.isInteger(rawStage.attempt) || Number(rawStage.attempt) < 0) add('FAIL', 'orchestration', stageId, 'attempt', 'attemptは0以上の整数である必要があります。');
          if (!isStringArray(rawStage.artifactRefs)) add('FAIL', 'orchestration', stageId, 'artifactRefs', 'artifactRefsは文字列配列である必要があります。');
          if (rawStage.startedAt !== undefined && !isIsoDate(rawStage.startedAt)) add('FAIL', 'orchestration', stageId, 'startedAt', 'startedAtはISO日時で指定してください。');
          if (rawStage.completedAt !== undefined && !isIsoDate(rawStage.completedAt)) add('FAIL', 'orchestration', stageId, 'completedAt', 'completedAtはISO日時で指定してください。');
          if (rawStage.findings !== undefined && (!Array.isArray(rawStage.findings) || rawStage.findings.some(item => !isRecord(item) || !['WARN', 'FAIL'].includes(String(item.level)) || !isNonEmptyString(item.message)))) add('FAIL', 'orchestration', stageId, 'findings', 'findingsはlevel/messageを持つ配列である必要があります。');
          if (rawStage.state === 'FAIL') add('FAIL', 'orchestration', stageId, 'state', `工程が失敗しています: ${String(rawStage.summary ?? stageId)}`);
          else if (rawStage.state !== 'PASS') incomplete('orchestration', stageId, 'state', `工程が未完了です: ${rawStage.state}`);
        }
        for (const rawStage of orchestration.stages) {
          if (!isRecord(rawStage) || !Array.isArray(rawStage.dependsOn)) continue;
          for (const dependency of rawStage.dependsOn) if (!stageIds.has(String(dependency))) add('FAIL', 'orchestration', String(rawStage.id), 'dependsOn', `依存stageが存在しません: ${String(dependency)}`);
        }
        const allStagesPresent = CONTENT_PIPELINE_STAGES.every(id => stageIds.has(id));
        if (!allStagesPresent) add('FAIL', 'orchestration', packageId, 'stages', '標準7工程をすべて定義してください。');
        if (strict && orchestration.stages.some(stage => isRecord(stage) && stage.state !== 'PASS')) add('FAIL', 'orchestration', packageId, 'state', '全工程PASSになるまでVALIDATED以降へ進めません。');
        if (orchestration.state === 'READY' && orchestration.stages.some(stage => isRecord(stage) && stage.state !== 'PASS')) add('FAIL', 'orchestration', packageId, 'state', 'READYは全工程PASSの場合だけ指定できます。');
        if (orchestration.state === 'PARTIAL' && !orchestration.stages.some(stage => isRecord(stage) && ['FAIL', 'BLOCKED'].includes(String(stage.state)))) add('FAIL', 'orchestration', packageId, 'state', 'PARTIALにはFAILまたはBLOCKED工程が必要です。');
      }
    }
  }
  const targetIds = new Set<string>();
  for (const raw of value.targets) {
    if (!isRecord(raw)) {
      add('FAIL', 'target', '?', 'root', '各targetはオブジェクトである必要があります。');
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '?';
    rejectUnknown(raw, ['id', 'kind', 'loreRefs'], 'target', id);
    if (!validId(raw.id)) add('FAIL', 'target', id, 'id', 'target id は snake_case で指定してください。');
    if (targetIds.has(id)) add('FAIL', 'target', id, 'id', 'target id が重複しています。');
    targetIds.add(id);
    if (!(CONTENT_TARGET_KINDS as readonly unknown[]).includes(raw.kind)) add('FAIL', 'target', id, 'kind', '未対応のtarget kindです。');
    if (!isStringArray(raw.loreRefs, false)) incomplete('target', id, 'loreRefs', '世界観整合の根拠となるloreRefsが1件以上必要です。');
  }

  const loreEntries = Array.isArray(value.lore.entries) ? value.lore.entries : [];
  const loreRelationships = Array.isArray(value.lore.relationships) ? value.lore.relationships : [];
  const loreTimeline = Array.isArray(value.lore.timelineEvents) ? value.lore.timelineEvents : [];
  if (!isStringArray(value.lore.registryRefs)) add('FAIL', 'package', packageId, 'lore.registryRefs', 'registryRefs は文字列配列である必要があります。');
  rejectUnknown(value.lore, ['registryRefs', 'entries', 'relationships', 'timelineEvents'], 'package', packageId, 'lore');
  if (!Array.isArray(value.lore.entries)) add('FAIL', 'package', packageId, 'lore.entries', 'entries は配列である必要があります。');
  if (!Array.isArray(value.lore.relationships)) add('FAIL', 'package', packageId, 'lore.relationships', 'relationships は配列である必要があります。');
  if (!Array.isArray(value.lore.timelineEvents)) add('FAIL', 'package', packageId, 'lore.timelineEvents', 'timelineEvents は配列である必要があります。');

  let globalLore: LoreRegistry | undefined;
  if (ctx.loreRegistry) {
    globalLore = ctx.loreRegistry;
    for (const finding of validateLoreRegistry(globalLore)) {
      if (finding.level !== 'PASS') add(finding.level, finding.scope, finding.id, finding.field, finding.message);
    }
  } else if ((value.lore.registryRefs as unknown[] | undefined)?.length) {
    incomplete('package', packageId, 'lore.registryRefs', 'Lore Registryが読み込まれていないため参照を検証できません。');
  }

  const globalLoreIds = new Set(globalLore?.entries.map(entry => entry.id) ?? []);
  for (const raw of loreEntries) {
    if (isRecord(raw) && typeof raw.id === 'string' && globalLoreIds.has(raw.id)) add('FAIL', 'lore', raw.id, 'id', '既存Lore Registryのentryをpackage proposalで上書きできません。');
  }
  const combinedRegistry: LoreRegistry = {
    schemaVersion: 1,
    updatedAt: new Date(0).toISOString(),
    entries: [...(globalLore?.entries ?? []), ...(loreEntries as LoreEntry[])],
    relationships: [...(globalLore?.relationships ?? []), ...(loreRelationships as LoreRelationship[])],
    timeline: [...(globalLore?.timeline ?? []), ...(loreTimeline as LoreTimelineEvent[])],
  };
  for (const finding of validateLoreRegistry(combinedRegistry)) {
    if (finding.level !== 'PASS' && !globalLoreIds.has(finding.id)) add(finding.level, 'lore', finding.id, finding.field, finding.message);
  }

  const knownLoreIds = new Set(combinedRegistry.entries.map(entry => entry.id));
  for (const ref of Array.isArray(value.lore.registryRefs) ? value.lore.registryRefs : []) {
    if (!knownLoreIds.has(String(ref))) incomplete('package', packageId, 'lore.registryRefs', `Lore参照が存在しません: ${String(ref)}`);
  }

  const deliverables = value.deliverables.filter(isRecord) as unknown as ContentDeliverable[];
  if (deliverables.length !== value.deliverables.length) add('FAIL', 'package', packageId, 'deliverables', 'すべてのdeliverableはオブジェクトである必要があります。');
  const deliverableIds = new Set<string>();
  for (const deliverable of deliverables) {
    const id = typeof deliverable.id === 'string' ? deliverable.id : '?';
    rejectUnknown(deliverable as unknown as Record<string, unknown>, ['id', 'ownerId', 'scope', 'kind', 'required', 'state', 'outputRefs', 'artifact', 'notes'], 'deliverable', id);
    if (!validId(deliverable.id)) add('FAIL', 'deliverable', id, 'id', 'deliverable id は snake_case で指定してください。');
    if (deliverableIds.has(id)) add('FAIL', 'deliverable', id, 'id', 'deliverable id が重複しています。');
    deliverableIds.add(id);
    if (!targetIds.has(deliverable.ownerId)) add('FAIL', 'deliverable', id, 'ownerId', `targetが存在しません: ${String(deliverable.ownerId)}`);
    if (!(CONTENT_PACKAGE_SCOPES as readonly unknown[]).includes(deliverable.scope)) add('FAIL', 'deliverable', id, 'scope', '未対応のdeliverable scopeです。');
    if (!isNonEmptyString(deliverable.kind)) add('FAIL', 'deliverable', id, 'kind', 'kind は非空文字列である必要があります。');
    if (typeof deliverable.required !== 'boolean') add('FAIL', 'deliverable', id, 'required', 'required はbooleanである必要があります。');
    if (!(DELIVERABLE_STATES as readonly unknown[]).includes(deliverable.state)) add('FAIL', 'deliverable', id, 'state', '未対応のdeliverable stateです。');
    if (!isStringArray(deliverable.outputRefs)) add('FAIL', 'deliverable', id, 'outputRefs', 'outputRefs は文字列配列である必要があります。');
    if (deliverable.artifact !== undefined && !isRecord(deliverable.artifact)) add('FAIL', 'deliverable', id, 'artifact', 'artifact はオブジェクトである必要があります。');
    if (deliverable.state === 'READY' && deliverable.outputRefs.length === 0 && deliverable.artifact === undefined) add('FAIL', 'deliverable', id, 'state', 'READYにはoutputRefsまたはartifactが必要です。');
    if (deliverable.state === 'BLOCKED' && !isNonEmptyString(deliverable.notes)) add('FAIL', 'deliverable', id, 'notes', 'BLOCKEDの理由をnotesへ記録してください。');
    if (deliverable.required && deliverable.state !== 'READY') incomplete('deliverable', id, 'state', `必須成果物がREADYではありません: ${deliverable.scope}/${deliverable.kind}`);
  }

  const assets = value.assets.filter(isRecord) as unknown as AssetRecord[];
  if (assets.length !== value.assets.length) add('FAIL', 'package', packageId, 'assets', 'すべてのassetはオブジェクトである必要があります。');
  const assetIds = new Set<string>();
  const assetOutputPaths = new Set<string>();
  for (const asset of assets) {
    const id = typeof asset.id === 'string' ? asset.id : '?';
    rejectUnknown(asset as unknown as Record<string, unknown>, ['id', 'ownerId', 'kind', 'state', 'mediaType', 'format', 'originalPath', 'sourcePath', 'outputPath', 'width', 'height', 'alpha', 'safeArea', 'bytes', 'contentHash', 'provenancePromptRef', 'referenceAssetRefs', 'spec', 'notes'], 'asset', id);
    if (!validId(asset.id)) add('FAIL', 'asset', id, 'id', 'asset id は snake_case で指定してください。');
    if (assetIds.has(id)) add('FAIL', 'asset', id, 'id', 'asset id が重複しています。');
    assetIds.add(id);
    if (!targetIds.has(asset.ownerId)) add('FAIL', 'asset', id, 'ownerId', `targetが存在しません: ${String(asset.ownerId)}`);
    if (!isNonEmptyString(asset.kind)) add('FAIL', 'asset', id, 'kind', 'kind は非空文字列である必要があります。');
    if (!(ARTIFACT_STATES as readonly unknown[]).includes(asset.state)) add('FAIL', 'asset', id, 'state', '未対応のasset stateです。');
    if (!['image', 'audio'].includes(String(asset.mediaType))) add('FAIL', 'asset', id, 'mediaType', 'mediaType は image / audio のいずれかです。');
    if (!['png', 'webp', 'jpg', 'svg', 'mp3', 'wav', 'ogg'].includes(String(asset.format))) add('FAIL', 'asset', id, 'format', '未対応のasset formatです。');
    if (!formatMatchesMediaType(asset.format, asset.mediaType)) add('FAIL', 'asset', id, 'format', 'formatがmediaTypeと一致しません。');
    if (!isSafeRepositoryPath(asset.outputPath) || !isGeneratedAssetPath(asset.outputPath, asset.mediaType)) add('FAIL', 'asset', id, 'outputPath', 'outputPath は生成物用 public/images/generated または public/audio/generated 配下の相対パスにしてください。');
    if (!pathMatchesFormat(asset.outputPath, asset.format)) add('FAIL', 'asset', id, 'outputPath', 'outputPathの拡張子がformatと一致しません。');
    if (assetOutputPaths.has(asset.outputPath)) add('FAIL', 'asset', id, 'outputPath', '同じoutputPathがpackage内で重複しています。');
    assetOutputPaths.add(asset.outputPath);
    if (!isStringArray(asset.referenceAssetRefs)) add('FAIL', 'asset', id, 'referenceAssetRefs', 'referenceAssetRefs は文字列配列である必要があります。');
    if (asset.originalPath !== undefined && (!isSafeRepositoryPath(asset.originalPath) || !String(asset.originalPath).startsWith(`content/packages/${packageId}/originals/`))) add('FAIL', 'asset', id, 'originalPath', `originalPath は content/packages/${packageId}/originals/ 配下にしてください。`);
    if (asset.spec !== undefined) {
      for (const finding of validateAssetSpec(asset.spec)) add(finding.level, 'asset', id, finding.field, finding.message);
      if (asset.mediaType !== 'image') add('FAIL', 'asset', id, 'spec', 'AssetSpecはimage assetだけに指定できます。');
      else if (validateAssetSpec(asset.spec).every(finding => finding.level !== 'FAIL')) {
        const expectedPath = standardAssetOutputPath(asset.ownerId, asset.spec);
        if (asset.outputPath !== expectedPath) add('FAIL', 'asset', id, 'outputPath', `AssetSpecの標準出力先と一致しません: ${expectedPath}`);
        if (assetUsageRequiresReference(asset.spec.usage) && asset.referenceAssetRefs.length === 0) incomplete('asset', id, 'referenceAssetRefs', `${asset.spec.usage} は同一デザインの基準画像assetを1件以上参照してください。`);
      }
    }
    if (asset.state === 'BLOCKED' && !isNonEmptyString(asset.notes)) add('FAIL', 'asset', id, 'notes', 'BLOCKEDの理由をnotesへ記録してください。');
    if (asset.state === 'READY') {
      if (!isSafeRepositoryPath(asset.sourcePath) || !String(asset.sourcePath).startsWith('content/packages/')) add('FAIL', 'asset', id, 'sourcePath', 'READY assetのsourcePathは content/packages 配下の相対パスにしてください。');
      if (!pathMatchesFormat(asset.sourcePath, asset.format)) add('FAIL', 'asset', id, 'sourcePath', 'sourcePathの拡張子がformatと一致しません。');
      if (!isSha256(asset.contentHash)) add('FAIL', 'asset', id, 'contentHash', 'READY assetにはsha256 contentHashが必要です。');
      if (!Number.isInteger(asset.bytes) || Number(asset.bytes) < 1) add('FAIL', 'asset', id, 'bytes', 'READY assetには1以上のbytesが必要です。');
      if (asset.mediaType === 'image') {
        if (!Number.isInteger(asset.width) || Number(asset.width) < 1) add('FAIL', 'asset', id, 'width', 'READY imageにはwidthが必要です。');
        if (!Number.isInteger(asset.height) || Number(asset.height) < 1) add('FAIL', 'asset', id, 'height', 'READY imageにはheightが必要です。');
        if (typeof asset.alpha !== 'boolean') add('FAIL', 'asset', id, 'alpha', 'READY imageにはalpha指定が必要です。');
        const safeAreaKeys: Array<keyof NonNullable<AssetRecord['safeArea']>> = ['top', 'right', 'bottom', 'left'];
        if (isRecord(asset.safeArea)) rejectUnknown(asset.safeArea, safeAreaKeys, 'asset', id, 'safeArea');
        if (!isRecord(asset.safeArea) || !safeAreaKeys.every(key => Number.isFinite(asset.safeArea?.[key]))) add('FAIL', 'asset', id, 'safeArea', 'READY imageには四辺のsafeAreaが必要です。');
      }
      const file = asset.sourcePath ? ctx.assetFiles?.[asset.sourcePath] : undefined;
      if (!file?.exists) incomplete('asset', id, 'sourcePath', `staging assetが存在しません: ${String(asset.sourcePath)}`);
      else {
        if (file.sha256 && asset.contentHash !== file.sha256) add('FAIL', 'asset', id, 'contentHash', 'assetのcontentHashが実ファイルと一致しません。');
        if (file.bytes !== undefined && asset.bytes !== file.bytes) add('FAIL', 'asset', id, 'bytes', 'assetのbytesが実ファイルと一致しません。');
      }
    }
  }

  const presentation = value.presentation.filter(isRecord) as unknown as SkillPresentationRecord[];
  if (presentation.length !== value.presentation.length) add('FAIL', 'package', packageId, 'presentation', 'すべてのpresentationはオブジェクトである必要があります。');
  const presentationIds = new Set<string>();
  const presentationEffectKeys = new Set<string>();
  for (const spec of presentation) {
    const id = typeof spec.id === 'string' ? spec.id : '?';
    rejectUnknown(spec as unknown as Record<string, unknown>, ['id', 'ownerId', 'effectKey', 'state', 'element', 'attackType', 'label', 'timeline', 'vfx', 'sfx', 'accessibility', 'performance', 'notes'], 'presentation', id);
    if (!validId(spec.id)) add('FAIL', 'presentation', id, 'id', 'presentation id は snake_case で指定してください。');
    if (presentationIds.has(id)) add('FAIL', 'presentation', id, 'id', 'presentation id が重複しています。');
    presentationIds.add(id);
    if (!targetIds.has(spec.ownerId)) add('FAIL', 'presentation', id, 'ownerId', `targetが存在しません: ${String(spec.ownerId)}`);
    if (!isNonEmptyString(spec.effectKey)) add('FAIL', 'presentation', id, 'effectKey', 'effectKey は非空文字列である必要があります。');
    if (value.status !== 'APPLIED' && ctx.presentationRegistry?.[spec.effectKey]) add('FAIL', 'presentation', id, 'effectKey', '既存のSkill Presentation registryを上書きできません。新しいeffectKeyを使用してください。');
    if (presentationEffectKeys.has(spec.effectKey)) add('FAIL', 'presentation', id, 'effectKey', 'effectKey がpackage内で重複しています。');
    presentationEffectKeys.add(spec.effectKey);
    if (!(ARTIFACT_STATES as readonly unknown[]).includes(spec.state)) add('FAIL', 'presentation', id, 'state', '未対応のpresentation stateです。');
    if (spec.state === 'READY') {
      if (isRecord(spec.timeline)) rejectUnknown(spec.timeline, ['castMs', 'travelMs', 'impactMs', 'aftermathMs', 'damageTimingsMs'], 'presentation', id, 'timeline');
      if (isRecord(spec.vfx)) {
        rejectUnknown(spec.vfx, ['implementation', 'particleBudget', 'domNodeBudget', 'blendMode', 'colors', 'textureAssetRefs', 'hitStopMs', 'cameraShake', 'screenFlash', 'targetMarker', 'shapeCue'], 'presentation', id, 'vfx');
        if (isRecord(spec.vfx.colors)) rejectUnknown(spec.vfx.colors, ['primary', 'secondary', 'accent'], 'presentation', id, 'vfx.colors');
        if (isRecord(spec.vfx.cameraShake)) rejectUnknown(spec.vfx.cameraShake, ['intensity', 'durationMs'], 'presentation', id, 'vfx.cameraShake');
        if (isRecord(spec.vfx.screenFlash)) rejectUnknown(spec.vfx.screenFlash, ['color', 'opacity', 'durationMs'], 'presentation', id, 'vfx.screenFlash');
      }
      if (isRecord(spec.sfx)) {
        rejectUnknown(spec.sfx, ['cues'], 'presentation', id, 'sfx');
        for (const [index, cue] of (Array.isArray(spec.sfx.cues) ? spec.sfx.cues : []).entries()) if (isRecord(cue)) rejectUnknown(cue, ['profileKey', 'atMs', 'pitch', 'volume', 'layer'], 'presentation', id, `sfx.cues.${index}`);
      }
      if (isRecord(spec.accessibility)) rejectUnknown(spec.accessibility, ['reducedMotion', 'reducedParticleScale', 'flashHzMax', 'colorIndependent'], 'presentation', id, 'accessibility');
      if (isRecord(spec.performance)) rejectUnknown(spec.performance, ['lowDeviceParticleBudget', 'maxDomNodes', 'targetFrameMs'], 'presentation', id, 'performance');
      const timelineKeys: Array<keyof Omit<NonNullable<SkillPresentationRecord['timeline']>, 'damageTimingsMs'>> = ['castMs', 'travelMs', 'impactMs', 'aftermathMs'];
      const timelineReady = isRecord(spec.timeline) && timelineKeys.every(key => Number.isFinite(spec.timeline?.[key]) && Number(spec.timeline?.[key]) >= 0) && Array.isArray(spec.timeline?.damageTimingsMs) && spec.timeline.damageTimingsMs.length > 0 && spec.timeline.damageTimingsMs.every(time => Number.isFinite(time) && time >= 0);
      const colorsReady = isRecord(spec.vfx?.colors) && ['primary', 'secondary', 'accent'].every(key => isNonEmptyString(spec.vfx?.colors[key as keyof SkillPresentationSpec['vfx']['colors']]));
      const cameraReady = isRecord(spec.vfx?.cameraShake) && Number.isFinite(spec.vfx?.cameraShake.intensity) && Number.isFinite(spec.vfx?.cameraShake.durationMs);
      const flashReady = isRecord(spec.vfx?.screenFlash) && isNonEmptyString(spec.vfx?.screenFlash.color) && Number.isFinite(spec.vfx?.screenFlash.opacity) && Number.isFinite(spec.vfx?.screenFlash.durationMs);
      const vfxReady = isRecord(spec.vfx) && ['CSS', 'SVG', 'FRAMER', 'PIXI'].includes(String(spec.vfx.implementation)) && Number.isInteger(spec.vfx.particleBudget) && spec.vfx.particleBudget >= 0 && Number.isInteger(spec.vfx.domNodeBudget) && spec.vfx.domNodeBudget >= 0 && ['normal', 'screen', 'multiply', 'overlay', 'lighten'].includes(String(spec.vfx.blendMode)) && isStringArray(spec.vfx.textureAssetRefs) && Number.isFinite(spec.vfx.hitStopMs) && ['NONE', 'RING', 'CROSSHAIR', 'RUNE'].includes(String(spec.vfx.targetMarker)) && isNonEmptyString(spec.vfx.shapeCue) && colorsReady && cameraReady && flashReady;
      const sfxReady = isRecord(spec.sfx) && Array.isArray(spec.sfx.cues) && spec.sfx.cues.length > 0 && spec.sfx.cues.every(cue => isRecord(cue) && isNonEmptyString(cue.profileKey) && Number.isFinite(cue.atMs) && Number.isFinite(cue.pitch) && Number.isFinite(cue.volume) && ['CAST', 'TRAVEL', 'IMPACT', 'AFTERMATH'].includes(String(cue.layer)));
      const accessibilityReady = isRecord(spec.accessibility) && ['FADE_ONLY', 'STATIC_GLYPH', 'SHORTENED'].includes(String(spec.accessibility.reducedMotion)) && Number.isFinite(spec.accessibility.reducedParticleScale) && Number.isFinite(spec.accessibility.flashHzMax) && typeof spec.accessibility.colorIndependent === 'boolean';
      const performanceReady = isRecord(spec.performance) && Number.isInteger(spec.performance.lowDeviceParticleBudget) && Number.isInteger(spec.performance.maxDomNodes) && Number.isFinite(spec.performance.targetFrameMs);
      const identityReady = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'].includes(String(spec.element)) && ['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON', 'HEAL'].includes(String(spec.attackType)) && isNonEmptyString(spec.label);
      if (!timelineReady) add('FAIL', 'presentation', id, 'timeline', 'READY presentationには非負の各durationとdamageTimingsMsが必要です。');
      if (!vfxReady) add('FAIL', 'presentation', id, 'vfx', 'READY presentationにはrenderer・色・粒子/DOM予算・hit stop・camera・flash・target markerが必要です。');
      if (!sfxReady) add('FAIL', 'presentation', id, 'sfx', 'READY presentationにはprofile・時刻・pitch・volume・layerを持つSFX cueが必要です。');
      if (!accessibilityReady) add('FAIL', 'presentation', id, 'accessibility', 'READY presentationにはreduced-motion・点滅・色依存回避の指定が必要です。');
      if (!performanceReady) add('FAIL', 'presentation', id, 'performance', 'READY presentationには低性能端末・DOM・frame予算が必要です。');
      if (!identityReady) add('FAIL', 'presentation', id, 'element', 'READY presentationにはelement・attackType・labelが必要です。');
      if (timelineReady && vfxReady && sfxReady && accessibilityReady && performanceReady && identityReady) {
        const runtimeSpec: SkillPresentationSpec = {
          effectKey: spec.effectKey,
          element: spec.element!,
          attackType: spec.attackType!,
          label: spec.label!,
          timeline: spec.timeline!,
          vfx: spec.vfx!,
          sfx: spec.sfx!,
          accessibility: spec.accessibility!,
          performance: spec.performance!,
        };
        for (const finding of validateSkillPresentationSpec(runtimeSpec)) add(finding.level, 'presentation', id, finding.field, finding.message);
      }
    }
    if (spec.state === 'BLOCKED' && !isNonEmptyString(spec.notes)) add('FAIL', 'presentation', id, 'notes', 'BLOCKEDの理由をnotesへ記録してください。');
  }

  const evidence = value.evidence.filter(isRecord) as unknown as ContentEvidence[];
  if (evidence.length !== value.evidence.length) add('FAIL', 'package', packageId, 'evidence', 'すべてのevidenceはオブジェクトである必要があります。');
  const evidenceIds = new Set<string>();
  for (const item of evidence) {
    const id = typeof item.id === 'string' ? item.id : '?';
    rejectUnknown(item as unknown as Record<string, unknown>, ['id', 'ownerId', 'kind', 'status', 'summary', 'artifactPath', 'contentHash', 'createdAt'], 'evidence', id);
    if (!validId(item.id)) add('FAIL', 'evidence', id, 'id', 'evidence id は snake_case で指定してください。');
    if (evidenceIds.has(id)) add('FAIL', 'evidence', id, 'id', 'evidence id が重複しています。');
    evidenceIds.add(id);
    if (!targetIds.has(item.ownerId)) add('FAIL', 'evidence', id, 'ownerId', `targetが存在しません: ${String(item.ownerId)}`);
    if (!isNonEmptyString(item.kind)) add('FAIL', 'evidence', id, 'kind', 'kind は非空文字列である必要があります。');
    if (!(EVIDENCE_STATES as readonly unknown[]).includes(item.status)) add('FAIL', 'evidence', id, 'status', '未対応のevidence statusです。');
    if (!isNonEmptyString(item.summary)) add('FAIL', 'evidence', id, 'summary', 'summary は非空文字列である必要があります。');
    if (!isIsoDate(item.createdAt)) add('FAIL', 'evidence', id, 'createdAt', 'createdAt はISO日時で指定してください。');
    if (item.artifactPath !== undefined && !isSafeRepositoryPath(item.artifactPath)) add('FAIL', 'evidence', id, 'artifactPath', 'artifactPath は安全なリポジトリ相対パスにしてください。');
    if (item.contentHash !== undefined && !isSha256(item.contentHash)) add('FAIL', 'evidence', id, 'contentHash', 'contentHash はsha256で指定してください。');
    if (item.status === 'FAIL') incomplete('evidence', id, 'status', '検証証跡がFAILです。');
  }

  const localization = value.localization.filter(isRecord) as unknown as ContentLocalization[];
  if (localization.length !== value.localization.length) add('FAIL', 'package', packageId, 'localization', 'すべてのlocalizationはオブジェクトである必要があります。');
  const localizationIds = new Set<string>();
  const localizationKeys = new Set<string>();
  for (const item of localization) {
    const id = typeof item.id === 'string' ? item.id : '?';
    rejectUnknown(item as unknown as Record<string, unknown>, ['id', 'ownerId', 'locale', 'kind', 'text'], 'localization', id);
    if (!validId(item.id)) add('FAIL', 'localization', id, 'id', 'localization id は snake_case で指定してください。');
    if (localizationIds.has(id)) add('FAIL', 'localization', id, 'id', 'localization id が重複しています。');
    localizationIds.add(id);
    if (!targetIds.has(item.ownerId)) add('FAIL', 'localization', id, 'ownerId', `targetが存在しません: ${String(item.ownerId)}`);
    if (!(CONTENT_LOCALES as readonly unknown[]).includes(item.locale)) add('FAIL', 'localization', id, 'locale', 'locale は ja / en のいずれかです。');
    if (!(LOCALIZATION_KINDS as readonly unknown[]).includes(item.kind)) add('FAIL', 'localization', id, 'kind', '未対応のlocalization kindです。');
    if (!isNonEmptyString(item.text)) add('FAIL', 'localization', id, 'text', 'text は非空文字列である必要があります。');
    const key = `${item.ownerId}:${item.locale}:${item.kind}`;
    if (localizationKeys.has(key)) add('FAIL', 'localization', id, 'kind', `同一targetのlocale + kindが重複しています: ${key}`);
    localizationKeys.add(key);
  }

  const knownRefs = new Set<string>([
    ...[...targetIds].map(id => `target:${id}`),
    ...[...deliverableIds].map(id => `deliverable:${id}`),
    ...[...assetIds].map(id => `asset:${id}`),
    ...[...presentationIds].map(id => `presentation:${id}`),
    ...[...localizationIds].map(id => `localization:${id}`),
    ...[...evidenceIds].map(id => `evidence:${id}`),
    ...[...knownLoreIds].map(id => `lore:${id}`),
    ...combinedRegistry.relationships.map(item => `relationship:${item.id}`),
    ...combinedRegistry.timeline.map(item => `timeline:${item.id}`),
  ]);
  for (const raw of value.changes) {
    if (!isRecord(raw)) continue;
    if (typeof raw.scope === 'string' && typeof raw.id === 'string') knownRefs.add(`change:${raw.scope}:${raw.id}`);
  }

  for (const target of value.targets.filter(isRecord)) {
    const id = typeof target.id === 'string' ? target.id : '?';
    for (const loreRef of Array.isArray(target.loreRefs) ? target.loreRefs : []) if (!knownLoreIds.has(String(loreRef))) incomplete('target', id, 'loreRefs', `Lore参照が存在しません: ${String(loreRef)}`);
  }
  for (const deliverable of deliverables) {
    for (const ref of deliverable.outputRefs) if (!knownRefs.has(ref)) add('FAIL', 'deliverable', deliverable.id, 'outputRefs', `成果物参照が存在しません: ${ref}`);
    if (deliverable.scope === 'asset' && deliverable.state === 'READY' && !deliverable.outputRefs.some(ref => ref.startsWith('asset:'))) add('FAIL', 'deliverable', deliverable.id, 'outputRefs', 'READYのasset成果物はasset recordを参照してください。');
    if (deliverable.scope === 'skill-presentation' && deliverable.state === 'READY' && !deliverable.outputRefs.some(ref => ref.startsWith('presentation:'))) add('FAIL', 'deliverable', deliverable.id, 'outputRefs', 'READYのskill-presentation成果物はpresentation recordを参照してください。');
  }
  for (const asset of assets) {
    for (const ref of asset.referenceAssetRefs) if (!assetIds.has(ref)) add('FAIL', 'asset', asset.id, 'referenceAssetRefs', `参照assetが存在しません: ${ref}`);
  }
  for (const spec of presentation) {
    for (const ref of spec.vfx?.textureAssetRefs ?? []) if (!assetIds.has(ref)) add('FAIL', 'presentation', spec.id, 'vfx.textureAssetRefs', `参照assetが存在しません: ${ref}`);
  }

  const dependencies = value.dependencies.filter(isRecord) as unknown as ContentDependency[];
  if (dependencies.length !== value.dependencies.length) add('FAIL', 'package', packageId, 'dependencies', 'すべてのdependencyはオブジェクトである必要があります。');
  const dependencyIds = new Set<string>();
  const graph = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const id = typeof dependency.id === 'string' ? dependency.id : '?';
    rejectUnknown(dependency as unknown as Record<string, unknown>, ['id', 'from', 'to', 'relation', 'reason'], 'dependency', id);
    if (!validId(dependency.id)) add('FAIL', 'dependency', id, 'id', 'dependency id は snake_case で指定してください。');
    if (dependencyIds.has(id)) add('FAIL', 'dependency', id, 'id', 'dependency id が重複しています。');
    dependencyIds.add(id);
    if (!knownRefs.has(dependency.from)) add('FAIL', 'dependency', id, 'from', `依存元参照が存在しません: ${String(dependency.from)}`);
    if (!knownRefs.has(dependency.to)) add('FAIL', 'dependency', id, 'to', `依存先参照が存在しません: ${String(dependency.to)}`);
    if (!['REQUIRES', 'USES', 'INTEGRATES'].includes(String(dependency.relation))) add('FAIL', 'dependency', id, 'relation', '未対応のdependency relationです。');
    if (!isNonEmptyString(dependency.reason)) add('FAIL', 'dependency', id, 'reason', 'reason は非空文字列である必要があります。');
    if (dependency.from === dependency.to) add('FAIL', 'dependency', id, 'to', '自己依存は禁止です。');
    if (dependency.relation === 'REQUIRES') graph.set(dependency.from, [...(graph.get(dependency.from) ?? []), dependency.to]);
  }
  const cycle = findDependencyCycle(graph);
  if (cycle) add('FAIL', 'package', packageId, 'dependencies', `REQUIRES依存が循環しています: ${cycle.join(' -> ')}`);

  for (const target of value.targets.filter(isRecord) as unknown as ContentTarget[]) {
    const profile = CONTENT_COMPLETION_PROFILES[target.kind];
    if (!profile) continue;
    if (profile.change && !value.changes.some(change => isRecord(change) && profile.change?.scopes.includes(change.scope as ContentChange['scope']) && change.id === target.id)) incomplete('target', target.id, 'changes', `必須成果物がありません: ${profile.change.label}`);
    for (const requirement of profile.deliverables) {
      const matches = deliverables.filter(deliverable => deliverable.ownerId === target.id && deliverable.scope === requirement.scope && deliverable.kind === requirement.kind && deliverable.required);
      if (matches.length === 0) incomplete('target', target.id, 'deliverables', `必須成果物が定義されていません: ${requirement.label} (${requirement.scope}/${requirement.kind})`);
      else if (!matches.some(deliverable => deliverable.state === 'READY')) incomplete('target', target.id, 'deliverables', `必須成果物がREADYではありません: ${requirement.label}`);
    }
    for (const requirement of profile.evidence) {
      const matches = evidence.filter(item => item.ownerId === target.id && item.kind === requirement.kind);
      if (matches.length === 0) incomplete('target', target.id, 'evidence', `必須証跡がありません: ${requirement.label}`);
      else if (!matches.some(item => item.status === 'PASS' || item.status === 'WARN')) incomplete('target', target.id, 'evidence', `必須証跡が完了していません: ${requirement.label}`);
    }
    for (const requirement of profile.localization) {
      if (!localization.some(item => item.ownerId === target.id && item.locale === requirement.locale && item.kind === requirement.kind)) incomplete('target', target.id, 'localization', `必須ローカライズがありません: ${requirement.label} (${requirement.locale}/${requirement.kind})`);
    }
  }

  if (value.changes.length > 0) {
    for (const raw of value.changes) if (isRecord(raw)) rejectUnknown(raw, ['scope', 'id', 'packId', 'data'], 'change', typeof raw.id === 'string' ? raw.id : '?');
    if (!ctx.bundle) {
      incomplete('package', packageId, 'changes', 'マスターデータ文脈がないためdata changeを検証できません。');
    } else if (isRecord(value.brief)) {
      const bundleFindings = validateContentBundle({
        schemaVersion: 1,
        id: packageId,
        title: value.title,
        chapter: value.chapter,
        creativeBrief: {
          themes: value.brief.themes,
          mustInclude: value.brief.mustInclude,
          avoid: value.brief.avoid,
        },
        changes: value.changes,
      }, ctx.bundle);
      for (const finding of bundleFindings) if (finding.level !== 'PASS') add(finding.level, `change:${finding.scope}`, finding.id, finding.field, finding.message);
    }
  }

  const promptIds = new Set<string>();
  rejectUnknown(value.provenance, ['createdAt', 'createdBy', 'generator', 'prompts', 'references', 'hashAlgorithm', 'contentHash'], 'provenance', packageId);
  if (!isIsoDate(value.provenance.createdAt)) add('FAIL', 'provenance', packageId, 'createdAt', 'createdAt はISO日時で指定してください。');
  if (!isRecord(value.provenance.createdBy) || !isNonEmptyString(value.provenance.createdBy.name) || !(ACTOR_TYPES as readonly unknown[]).includes(value.provenance.createdBy.type)) add('FAIL', 'provenance', packageId, 'createdBy', 'createdByにはnameと有効なtypeが必要です。');
  else rejectUnknown(value.provenance.createdBy, ['name', 'type'], 'provenance', packageId, 'createdBy');
  if (!isRecord(value.provenance.generator) || !isNonEmptyString(value.provenance.generator.name)) add('FAIL', 'provenance', packageId, 'generator', 'generator.name が必要です。');
  else rejectUnknown(value.provenance.generator, ['name', 'model', 'version'], 'provenance', packageId, 'generator');
  if (!Array.isArray(value.provenance.prompts) || value.provenance.prompts.length === 0) add('FAIL', 'provenance', packageId, 'prompts', '生成・制作に使ったpromptを1件以上記録してください。');
  else for (const raw of value.provenance.prompts) {
    if (!isRecord(raw)) {
      add('FAIL', 'provenance', packageId, 'prompts', '各promptはオブジェクトである必要があります。');
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '?';
    rejectUnknown(raw, ['id', 'purpose', 'text'], 'provenance', id, 'prompts');
    if (!validId(raw.id) || !isNonEmptyString(raw.purpose) || !isNonEmptyString(raw.text)) add('FAIL', 'provenance', id, 'prompts', 'promptにはsnake_case id、purpose、textが必要です。');
    if (promptIds.has(id)) add('FAIL', 'provenance', id, 'id', 'prompt id が重複しています。');
    promptIds.add(id);
  }
  if (!Array.isArray(value.provenance.references) || value.provenance.references.length === 0) add('FAIL', 'provenance', packageId, 'references', '参照元を1件以上記録してください。');
  else for (const raw of value.provenance.references) {
    if (isRecord(raw)) rejectUnknown(raw, ['id', 'kind', 'uri', 'contentHash'], 'provenance', typeof raw.id === 'string' ? raw.id : '?', 'references');
    if (!isRecord(raw) || !validId(raw.id) || !['file', 'image', 'url', 'request'].includes(String(raw.kind)) || !isNonEmptyString(raw.uri)) add('FAIL', 'provenance', packageId, 'references', 'referenceにはsnake_case id、kind、uriが必要です。');
    if (isRecord(raw) && raw.contentHash !== undefined && !isSha256(raw.contentHash)) add('FAIL', 'provenance', String(raw.id ?? '?'), 'contentHash', 'reference contentHash はsha256で指定してください。');
  }
  if (value.provenance.hashAlgorithm !== 'sha256') add('FAIL', 'provenance', packageId, 'hashAlgorithm', 'hashAlgorithm は sha256 固定です。');
  for (const asset of assets) if (asset.provenancePromptRef && !promptIds.has(asset.provenancePromptRef)) add('FAIL', 'asset', asset.id, 'provenancePromptRef', `参照promptが存在しません: ${asset.provenancePromptRef}`);
  if (!isSha256(value.provenance.contentHash)) {
    incomplete('provenance', packageId, 'contentHash', '内容のsha256 contentHashが未記録です。VALIDATED遷移時に自動計算できます。');
  } else if (value.provenance.contentHash !== calculateContentPackageHash(pkg)) {
    add('FAIL', 'provenance', packageId, 'contentHash', 'contentHashが現在のpackage内容と一致しません。内容変更後はDRAFTへ戻して再検証してください。');
  }

  if (!Array.isArray(value.review.history)) add('FAIL', 'review', packageId, 'history', 'review.history は配列である必要があります。');
  rejectUnknown(value.review, ['history', 'blockers', 'snapshot', 'items', 'audit'], 'review', packageId);
  if (!isStringArray(value.review.blockers)) add('FAIL', 'review', packageId, 'blockers', 'review.blockers は文字列配列である必要があります。');
  if (Array.isArray(value.review.history)) {
    let current: ContentPackageState = 'DRAFT';
    for (const raw of value.review.history) {
      if (!isRecord(raw)) {
        add('FAIL', 'review', packageId, 'history', '各historyはオブジェクトである必要があります。');
        continue;
      }
      const from = raw.from as ContentPackageState;
      const to = raw.to as ContentPackageState;
      rejectUnknown(raw, ['from', 'to', 'actor', 'actorType', 'at', 'comment'], 'review', packageId, 'history');
      if (from !== current) add('FAIL', 'review', packageId, 'history', `状態履歴が連続していません。期待from=${current}, 実際=${String(from)}`);
      if (!(CONTENT_PACKAGE_STATES as readonly unknown[]).includes(from) || !(CONTENT_PACKAGE_STATES as readonly unknown[]).includes(to) || !ALLOWED_PACKAGE_TRANSITIONS[from]?.includes(to)) add('FAIL', 'review', packageId, 'history', `許可されていない状態遷移です: ${String(from)} -> ${String(to)}`);
      if (!isNonEmptyString(raw.actor) || !(ACTOR_TYPES as readonly unknown[]).includes(raw.actorType) || !isIsoDate(raw.at)) add('FAIL', 'review', packageId, 'history', '履歴にはactor、actorType、ISO日時が必要です。');
      if ((to === 'REVIEWED' || to === 'APPROVED') && raw.actorType !== 'human') add('FAIL', 'review', packageId, 'history', `${to}は人間だけが実行できます。Codexは自己承認できません。`);
      if (to === 'REVIEWED' && !isNonEmptyString(raw.comment)) add('FAIL', 'review', packageId, 'history', 'REVIEWED遷移にはレビューコメントが必要です。');
      current = to;
    }
    if (current !== value.status) add('FAIL', 'review', packageId, 'history', `履歴の最終状態 ${current} とpackage.status ${String(value.status)} が一致しません。`);
    if ((value.status === 'REVIEWED' || value.status === 'APPROVED' || value.status === 'APPLIED') && !value.review.history.some(raw => isRecord(raw) && raw.to === 'REVIEWED' && raw.actorType === 'human')) add('FAIL', 'review', packageId, 'history', '人間によるREVIEWED履歴がありません。');
    if ((value.status === 'APPROVED' || value.status === 'APPLIED') && !value.review.history.some(raw => isRecord(raw) && raw.to === 'APPROVED' && raw.actorType === 'human')) add('FAIL', 'review', packageId, 'history', '人間によるAPPROVED履歴がありません。');
  }
  if (value.review.items !== undefined) {
    if (!Array.isArray(value.review.items)) {
      add('FAIL', 'review', packageId, 'items', 'review.items は配列である必要があります。');
    } else {
      const requiredRefs = new Set(getRequiredContentReviewRefs(pkg));
      const seenRefs = new Set<string>();
      for (const raw of value.review.items) {
        if (!isRecord(raw)) {
          add('FAIL', 'review', packageId, 'items', '各review itemはオブジェクトである必要があります。');
          continue;
        }
        const ref = String(raw.ref ?? '?');
        rejectUnknown(raw, ['ref', 'status', 'contentHash', 'reviewer', 'reviewedAt', 'comment'], 'review-item', ref);
        if (!requiredRefs.has(ref)) add('FAIL', 'review-item', ref, 'ref', '現在のpackageに存在しないレビュー参照です。');
        if (seenRefs.has(ref)) add('FAIL', 'review-item', ref, 'ref', 'レビュー参照が重複しています。');
        seenRefs.add(ref);
        if (!(CONTENT_REVIEW_ITEM_STATES as readonly unknown[]).includes(raw.status)) add('FAIL', 'review-item', ref, 'status', '未対応のレビュー状態です。');
        if (!isSha256(raw.contentHash)) add('FAIL', 'review-item', ref, 'contentHash', 'contentHashはsha256で指定してください。');
        const currentHash = calculateContentReviewItemHash(pkg, ref);
        if (currentHash && raw.contentHash !== currentHash) add(['REVIEWED', 'APPROVED', 'APPLIED'].includes(String(value.status)) ? 'FAIL' : 'WARN', 'review-item', ref, 'contentHash', '内容変更により承認が失効しています。レビュー項目を同期してください。');
        if (raw.status === 'APPROVED' && (!isNonEmptyString(raw.reviewer) || !isIsoDate(raw.reviewedAt))) add('FAIL', 'review-item', ref, 'reviewer', 'APPROVEDにはreviewerとreviewedAtが必要です。');
        if (raw.status === 'CHANGES_REQUESTED' && (!isNonEmptyString(raw.reviewer) || !isIsoDate(raw.reviewedAt) || !isNonEmptyString(raw.comment))) add('FAIL', 'review-item', ref, 'comment', 'CHANGES_REQUESTEDにはreviewer、reviewedAt、commentが必要です。');
      }
      if (['REVIEWED', 'APPROVED', 'APPLIED'].includes(String(value.status))) {
        for (const ref of requiredRefs) {
          const item = value.review.items.find(raw => isRecord(raw) && raw.ref === ref);
          const currentHash = calculateContentReviewItemHash(pkg, ref);
          if (!isRecord(item) || item.status !== 'APPROVED' || item.contentHash !== currentHash) add('FAIL', 'review-item', ref, 'status', 'REVIEWED以降へ進むには全項目の最新内容を承認してください。');
        }
      }
    }
  }
  if (value.review.audit !== undefined) {
    if (!Array.isArray(value.review.audit)) {
      add('FAIL', 'review', packageId, 'audit', 'review.audit は配列である必要があります。');
    } else {
      const auditIds = new Set<string>();
      for (const raw of value.review.audit) {
        if (!isRecord(raw)) {
          add('FAIL', 'review', packageId, 'audit', '各audit eventはオブジェクトである必要があります。');
          continue;
        }
        const id = String(raw.id ?? '?');
        rejectUnknown(raw, ['id', 'action', 'actor', 'actorType', 'at', 'comment', 'subjectRef', 'details'], 'review-audit', id);
        if (!validId(raw.id)) add('FAIL', 'review-audit', id, 'id', 'audit id はsnake_caseで指定してください。');
        if (auditIds.has(id)) add('FAIL', 'review-audit', id, 'id', 'audit idが重複しています。');
        auditIds.add(id);
        if (!(CONTENT_REVIEW_AUDIT_ACTIONS as readonly unknown[]).includes(raw.action)) add('FAIL', 'review-audit', id, 'action', '未対応のaudit actionです。');
        if (!isNonEmptyString(raw.actor) || !(ACTOR_TYPES as readonly unknown[]).includes(raw.actorType) || !isIsoDate(raw.at) || !isNonEmptyString(raw.comment)) add('FAIL', 'review-audit', id, 'root', 'audit eventにはactor、actorType、ISO日時、commentが必要です。');
        if (raw.subjectRef !== undefined && !isNonEmptyString(raw.subjectRef)) add('FAIL', 'review-audit', id, 'subjectRef', 'subjectRefは非空文字列で指定してください。');
        if (raw.details !== undefined && !isRecord(raw.details)) add('FAIL', 'review-audit', id, 'details', 'detailsはオブジェクトで指定してください。');
      }
    }
  }
  if (value.status === 'BLOCKED' && (!Array.isArray(value.review.blockers) || value.review.blockers.length === 0)) add('FAIL', 'review', packageId, 'blockers', 'BLOCKEDには1件以上のblockerが必要です。');
  if (value.status !== 'BLOCKED' && Array.isArray(value.review.blockers) && value.review.blockers.length > 0) add('WARN', 'review', packageId, 'blockers', 'BLOCKED以外の状態にblockerが残っています。');
  if (value.status === 'APPLIED' && (!isSafeRepositoryPath(value.review.snapshot) || !String(value.review.snapshot).startsWith('.content-snapshots/'))) add('FAIL', 'review', packageId, 'snapshot', 'APPLIEDには.content-snapshots配下の復旧snapshotが必要です。');

  if (!findings.some(finding => finding.level === 'FAIL')) add('PASS', 'package', packageId, 'root', 'Content Packageの構造・参照・必須成果物を検証しました。');
  return findings;
}

export function isContentPackage(value: unknown): value is ContentPackage {
  return isRecord(value) && value.schemaVersion === 2 && typeof value.id === 'string' && Array.isArray(value.targets) && Array.isArray(value.deliverables);
}

export type TransitionOptions = {
  actor: string;
  actorType: ActorType;
  at?: string;
  comment?: string;
  snapshot?: string;
};

export type TransitionResult =
  | { ok: true; package: ContentPackage; findings: ContentFinding[] }
  | { ok: false; findings: ContentFinding[] };

export function transitionContentPackage(
  pkg: ContentPackage,
  to: ContentPackageState,
  options: TransitionOptions,
  ctx: ContentPackageValidationContext = {},
): TransitionResult {
  const from = pkg.status;
  if (!ALLOWED_PACKAGE_TRANSITIONS[from].includes(to)) {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'status', message: `許可されていない状態遷移です: ${from} -> ${to}` }] };
  }
  if (!isNonEmptyString(options.actor) || !(ACTOR_TYPES as readonly unknown[]).includes(options.actorType)) {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'actor', message: '状態遷移にはactorとactorTypeが必要です。' }] };
  }
  if ((to === 'REVIEWED' || to === 'APPROVED') && options.actorType !== 'human') {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'actorType', message: `${to}は人間だけが実行できます。Codexは自己承認できません。` }] };
  }
  if (to === 'REVIEWED' && !isNonEmptyString(options.comment)) {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'comment', message: 'REVIEWED遷移にはレビューコメントが必要です。' }] };
  }
  if (to === 'BLOCKED' && !isNonEmptyString(options.comment)) {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'comment', message: 'BLOCKED遷移には理由が必要です。' }] };
  }
  if (to === 'APPLIED' && (!isSafeRepositoryPath(options.snapshot) || !String(options.snapshot).startsWith('.content-snapshots/'))) {
    return { ok: false, findings: [{ level: 'FAIL', scope: 'review', id: pkg.id, field: 'snapshot', message: 'APPLIED遷移には.content-snapshots配下のsnapshotが必要です。' }] };
  }

  const next = JSON.parse(JSON.stringify(pkg)) as ContentPackage;
  if (to === 'DRAFT') {
    next.review.blockers = [];
    delete next.provenance.contentHash;
    delete next.review.snapshot;
  }
  if (to === 'BLOCKED' && options.comment) next.review.blockers = [...new Set([...next.review.blockers, options.comment])];
  if (to === 'APPLIED') next.review.snapshot = options.snapshot;
  next.review.history.push({
    from,
    to,
    actor: options.actor,
    actorType: options.actorType,
    at: options.at ?? new Date().toISOString(),
    ...(options.comment ? { comment: options.comment } : {}),
  });
  next.status = to;
  if (to === 'VALIDATED') next.provenance.contentHash = calculateContentPackageHash(next);
  const findings = validateContentPackage(next, ctx);
  if (findings.some(finding => finding.level === 'FAIL')) return { ok: false, findings };
  return { ok: true, package: next, findings };
}

export function isLegacyContentBundle(value: unknown): boolean {
  return isRecord(value) && value.schemaVersion === 1 && Array.isArray(value.changes) && value.changes.every(change => isRecord(change) && (CONTENT_SCOPES as readonly unknown[]).includes(change.scope));
}
