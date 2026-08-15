import type { AssetRecord, ContentPackage } from './contentPackage';

export const ASSET_USAGES = [
  'character-fullbody',
  'character-expression',
  'character-bust',
  'battle-unit',
  'weapon-icon',
  'weapon-card',
  'weapon-silhouette',
  'residue-icon',
  'skill-icon',
  'vfx-texture',
  'vfx-mask',
  'background',
] as const;

export const ASSET_TRANSPARENCY_MODES = ['OPAQUE', 'ALPHA', 'CHROMA_KEY'] as const;

export type AssetUsage = (typeof ASSET_USAGES)[number];
export type AssetTransparencyMode = (typeof ASSET_TRANSPARENCY_MODES)[number];

export type AssetSpec = {
  schemaVersion: 1;
  usage: AssetUsage;
  variant: string;
  width: number;
  height: number;
  aspectRatio: { width: number; height: number };
  transparency: AssetTransparencyMode;
  safeArea: { top: number; right: number; bottom: number; left: number };
  expression?: string;
  effectKey?: string;
  consistencyGroup?: string;
  style: {
    medium: string;
    palette: string[];
    lighting: string;
    mood: string;
    materials: string[];
  };
  mustInclude: string[];
  avoid: string[];
  maxBytes: number;
};

export type AssetSpecFinding = {
  level: 'WARN' | 'FAIL';
  field: string;
  message: string;
};

const CHARACTER_USAGES = new Set<AssetUsage>([
  'character-fullbody',
  'character-expression',
  'character-bust',
  'battle-unit',
]);
const WEAPON_USAGES = new Set<AssetUsage>(['weapon-icon', 'weapon-card', 'weapon-silhouette']);
const SKILL_USAGES = new Set<AssetUsage>(['skill-icon', 'vfx-texture', 'vfx-mask']);
const DERIVED_USAGES = new Set<AssetUsage>([
  'character-expression',
  'character-bust',
  'battle-unit',
  'weapon-icon',
  'weapon-silhouette',
  'vfx-texture',
  'vfx-mask',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isSafeSegment(value: unknown): value is string {
  return isNonEmptyString(value) && /^[a-z][a-z0-9_-]*$/.test(value);
}

function normalizedVariant(spec: AssetSpec): string {
  if (spec.usage === 'character-expression') return `expression-${spec.expression ?? spec.variant}`;
  const prefixes: Record<AssetUsage, string> = {
    'character-fullbody': 'fullbody',
    'character-expression': 'expression',
    'character-bust': 'bust',
    'battle-unit': 'battle',
    'weapon-icon': 'icon',
    'weapon-card': 'card',
    'weapon-silhouette': 'silhouette',
    'residue-icon': 'icon',
    'skill-icon': 'icon',
    'vfx-texture': 'vfx',
    'vfx-mask': 'mask',
    background: 'background',
  };
  return `${prefixes[spec.usage]}-${spec.variant}`;
}

export function standardAssetOutputPath(ownerId: string, spec: AssetSpec): string {
  const key = SKILL_USAGES.has(spec.usage) ? spec.effectKey ?? ownerId : ownerId;
  const folder = CHARACTER_USAGES.has(spec.usage)
    ? 'characters'
    : WEAPON_USAGES.has(spec.usage)
      ? 'weapons'
      : spec.usage === 'residue-icon'
        ? 'residues'
        : SKILL_USAGES.has(spec.usage)
          ? 'skills'
          : 'backgrounds';
  return `public/images/generated/${folder}/${key}/${normalizedVariant(spec)}.webp`;
}

export function standardAssetOriginalPath(packageId: string, assetId: string, extension = 'png'): string {
  return `content/packages/${packageId}/originals/${assetId}.${extension.toLowerCase()}`;
}

export function standardAssetOptimizedPath(packageId: string, assetId: string): string {
  return `content/packages/${packageId}/optimized/${assetId}.webp`;
}

export function standardAssetContactSheetPath(packageId: string): string {
  return `content/packages/${packageId}/reviews/contact-sheet.webp`;
}

export function standardAssetPromptQueuePath(packageId: string): string {
  return `content/packages/${packageId}/reviews/asset-prompts.json`;
}

export function validateAssetSpec(value: unknown): AssetSpecFinding[] {
  const findings: AssetSpecFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL' as const, field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN' as const, field, message });
  if (!isRecord(value)) return [{ level: 'FAIL', field: 'spec', message: 'AssetSpec はオブジェクトである必要があります。' }];

  const allowed = new Set([
    'schemaVersion', 'usage', 'variant', 'width', 'height', 'aspectRatio', 'transparency', 'safeArea',
    'expression', 'effectKey', 'consistencyGroup', 'style', 'mustInclude', 'avoid', 'maxBytes',
  ]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`spec.${key}`, `未定義フィールドです: ${key}`);
  if (value.schemaVersion !== 1) fail('spec.schemaVersion', 'AssetSpec schemaVersion は 1 である必要があります。');
  if (!(ASSET_USAGES as readonly unknown[]).includes(value.usage)) fail('spec.usage', '未対応の画像用途です。');
  if (!isSafeSegment(value.variant)) fail('spec.variant', 'variant は英小文字で始まる安全な識別子にしてください。');
  if (!Number.isInteger(value.width) || Number(value.width) < 64 || Number(value.width) > 4096) fail('spec.width', 'width は64〜4096の整数にしてください。');
  if (!Number.isInteger(value.height) || Number(value.height) < 64 || Number(value.height) > 4096) fail('spec.height', 'height は64〜4096の整数にしてください。');
  if (!(ASSET_TRANSPARENCY_MODES as readonly unknown[]).includes(value.transparency)) fail('spec.transparency', '透過方式は OPAQUE / ALPHA / CHROMA_KEY のいずれかです。');
  if (!Number.isInteger(value.maxBytes) || Number(value.maxBytes) < 1024) fail('spec.maxBytes', 'maxBytes は1024以上の整数にしてください。');
  if (!isStringArray(value.mustInclude)) fail('spec.mustInclude', 'mustInclude は文字列配列である必要があります。');
  if (!isStringArray(value.avoid)) fail('spec.avoid', 'avoid は文字列配列である必要があります。');
  if (value.expression !== undefined && !isSafeSegment(value.expression)) fail('spec.expression', 'expression は安全な識別子にしてください。');
  if (value.effectKey !== undefined && !isSafeSegment(value.effectKey)) fail('spec.effectKey', 'effectKey は安全な識別子にしてください。');
  if (value.consistencyGroup !== undefined && !isSafeSegment(value.consistencyGroup)) fail('spec.consistencyGroup', 'consistencyGroup は安全な識別子にしてください。');
  if (value.usage === 'character-expression' && !isSafeSegment(value.expression)) fail('spec.expression', 'character-expression には expression が必要です。');
  if (SKILL_USAGES.has(value.usage as AssetUsage) && !isSafeSegment(value.effectKey)) warn('spec.effectKey', 'skill系画像はeffectKeyを明示すると出力先が安定します。');

  if (!isRecord(value.aspectRatio)) {
    fail('spec.aspectRatio', 'aspectRatio が必要です。');
  } else {
    const ratioWidth = Number(value.aspectRatio.width);
    const ratioHeight = Number(value.aspectRatio.height);
    if (!Number.isInteger(ratioWidth) || ratioWidth < 1 || !Number.isInteger(ratioHeight) || ratioHeight < 1) {
      fail('spec.aspectRatio', 'aspectRatioのwidth/heightは1以上の整数にしてください。');
    } else if (Number.isInteger(value.width) && Number.isInteger(value.height) && Number(value.width) * ratioHeight !== Number(value.height) * ratioWidth) {
      fail('spec.aspectRatio', 'width/heightがaspectRatioと一致しません。');
    }
  }

  if (!isRecord(value.safeArea)) {
    fail('spec.safeArea', 'safeArea が必要です。');
  } else {
    const edges = ['top', 'right', 'bottom', 'left'] as const;
    for (const edge of edges) if (!Number.isInteger(value.safeArea[edge]) || Number(value.safeArea[edge]) < 0) fail(`spec.safeArea.${edge}`, 'safeAreaは0以上の整数pxにしてください。');
    if (Number(value.safeArea.left) + Number(value.safeArea.right) >= Number(value.width)) fail('spec.safeArea', '左右のsafeArea合計はwidth未満にしてください。');
    if (Number(value.safeArea.top) + Number(value.safeArea.bottom) >= Number(value.height)) fail('spec.safeArea', '上下のsafeArea合計はheight未満にしてください。');
  }

  if (!isRecord(value.style)) {
    fail('spec.style', 'style が必要です。');
  } else {
    const styleAllowed = new Set(['medium', 'palette', 'lighting', 'mood', 'materials']);
    for (const key of Object.keys(value.style)) if (!styleAllowed.has(key)) fail(`spec.style.${key}`, `未定義フィールドです: ${key}`);
    if (!isNonEmptyString(value.style.medium)) fail('spec.style.medium', 'medium が必要です。');
    if (!isStringArray(value.style.palette) || value.style.palette.length === 0) fail('spec.style.palette', 'palette は1件以上必要です。');
    if (!isNonEmptyString(value.style.lighting)) fail('spec.style.lighting', 'lighting が必要です。');
    if (!isNonEmptyString(value.style.mood)) fail('spec.style.mood', 'mood が必要です。');
    if (!isStringArray(value.style.materials)) fail('spec.style.materials', 'materials は文字列配列である必要があります。');
  }
  return findings;
}

function list(values: string[]): string {
  return values.length > 0 ? values.join('、') : 'なし';
}

export function buildAssetPrompt(pkg: ContentPackage, asset: AssetRecord): string {
  if (!asset.spec) throw new Error(`AssetSpec is required: ${asset.id}`);
  const spec = asset.spec;
  const target = pkg.targets.find(item => item.id === asset.ownerId);
  const backdrop = spec.transparency === 'CHROMA_KEY'
    ? '完全に均一な #00ff00 クロマキー背景。影、床面、反射、勾配、模様、照明むらを一切入れない'
    : spec.transparency === 'ALPHA'
      ? '被写体以外は透明になる切り抜き前提の単色背景。輪郭を明瞭にし、十分な余白を取る'
      : '黒曜石色から深い紫へ落ちる簡潔なゴシック背景';
  const consistency = spec.consistencyGroup
    ? `Consistency: ${spec.consistencyGroup} の基準デザインと顔、比率、装備、配色、素材を変えない。referenceAssetRefsを優先する。`
    : 'Consistency: 同一ownerの派生画像では造形、比率、配色、素材を維持する。';
  return [
    'Use case: stylized-concept',
    `Asset type: Necromance Brave game asset / ${spec.usage}`,
    `Primary request: ${pkg.title} の ${asset.kind}。対象ID ${asset.ownerId}、種別 ${target?.kind ?? 'asset'}、variant ${spec.variant}${spec.expression ? `、表情 ${spec.expression}` : ''}。`,
    `World and theme: ${pkg.brief.playerExperience}。主題は ${list(pkg.brief.themes)}。`,
    `Scene/backdrop: ${backdrop}。`,
    `Style/medium: ${spec.style.medium}。Gothic-Morphism、黒曜石ガラス、古びた羊皮紙、骨の縁取り、Void Purple #8B00FFを節度ある魔力光として使う。`,
    `Composition/framing: ${spec.width}x${spec.height}、aspect ratio ${spec.aspectRatio.width}:${spec.aspectRatio.height}。safe area top ${spec.safeArea.top}px / right ${spec.safeArea.right}px / bottom ${spec.safeArea.bottom}px / left ${spec.safeArea.left}px。明確なシルエット、UI縮小時にも判別可能。`,
    `Lighting/mood: ${spec.style.lighting}。${spec.style.mood}。`,
    `Color palette: ${list(spec.style.palette)}。`,
    `Materials/textures: ${list(spec.style.materials)}。`,
    `Must include: ${list([...pkg.brief.mustInclude, ...spec.mustInclude])}。`,
    consistency,
    `Avoid: ${list([...pkg.brief.avoid, ...spec.avoid, '文字', 'ロゴ', '透かし', '既存作品の固有意匠'])}。`,
    'Constraints: no text; no logos or trademarks; no watermark; mobile game production asset; preserve the requested silhouette and safe area.',
  ].join('\n');
}

export function expectedFinalAlpha(spec: AssetSpec): boolean {
  return spec.transparency !== 'OPAQUE';
}

export function assetUsageRequiresReference(usage: AssetUsage): boolean {
  return DERIVED_USAGES.has(usage);
}
