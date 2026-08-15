import appliedPresentationData from '../../data/presentation/skillPresentations.json';
import type { ElementType, SkillAttackType } from '../../types/game';

export type PresentationRenderer = 'CSS' | 'SVG' | 'FRAMER' | 'PIXI';
export type PresentationBlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'lighten';
export type PresentationTargetMarker = 'NONE' | 'RING' | 'CROSSHAIR' | 'RUNE';
export type ReducedMotionMode = 'FADE_ONLY' | 'STATIC_GLYPH' | 'SHORTENED';

export type SkillPresentationTimeline = {
  castMs: number;
  travelMs: number;
  impactMs: number;
  aftermathMs: number;
  damageTimingsMs: number[];
};

export type PresentationSfxCue = {
  profileKey: string;
  atMs: number;
  pitch: number;
  volume: number;
  layer: 'CAST' | 'TRAVEL' | 'IMPACT' | 'AFTERMATH';
};

export type SkillPresentationSpec = {
  effectKey: string;
  element: ElementType;
  attackType: SkillAttackType;
  label: string;
  timeline: SkillPresentationTimeline;
  vfx: {
    implementation: PresentationRenderer;
    particleBudget: number;
    domNodeBudget: number;
    blendMode: PresentationBlendMode;
    colors: { primary: string; secondary: string; accent: string };
    textureAssetRefs: string[];
    hitStopMs: number;
    cameraShake: { intensity: number; durationMs: number };
    screenFlash: { color: string; opacity: number; durationMs: number };
    targetMarker: PresentationTargetMarker;
    shapeCue: string;
  };
  sfx: { cues: PresentationSfxCue[] };
  accessibility: {
    reducedMotion: ReducedMotionMode;
    reducedParticleScale: number;
    flashHzMax: number;
    colorIndependent: boolean;
  };
  performance: {
    lowDeviceParticleBudget: number;
    maxDomNodes: number;
    targetFrameMs: number;
  };
};

export type PresentationFinding = {
  level: 'FAIL' | 'WARN';
  field: string;
  message: string;
};

export type PresentationSchedule = {
  totalMs: number;
  phaseStarts: { cast: number; travel: number; impact: number; aftermath: number };
  damageTimingsMs: number[];
  sfxCues: PresentationSfxCue[];
};

const ELEMENT_PALETTE: Record<ElementType, SkillPresentationSpec['vfx']['colors']> = {
  FIRE: { primary: '#ff5a1f', secondary: '#ffb347', accent: '#fff1a8' },
  WATER: { primary: '#38bdf8', secondary: '#2563eb', accent: '#dff7ff' },
  THUNDER: { primary: '#fde047', secondary: '#8b5cf6', accent: '#ffffff' },
  EARTH: { primary: '#a16207', secondary: '#d4af37', accent: '#f7d59a' },
  WIND: { primary: '#7dd3fc', secondary: '#14b8a6', accent: '#e8ffff' },
  ICE: { primary: '#93c5fd', secondary: '#67e8f9', accent: '#ffffff' },
  LIGHT: { primary: '#fef3c7', secondary: '#d4af37', accent: '#ffffff' },
  DARK: { primary: '#a855f7', secondary: '#4c1d95', accent: '#f5d0fe' },
  NONE: { primary: '#f0ebff', secondary: '#8b7da8', accent: '#ffffff' },
};

const ATTACK_LABEL: Record<SkillAttackType, string> = {
  SLASH: '斬撃',
  STRIKE: '衝撃',
  PROJECTILE: '射出',
  MAGIC: '魔法',
  SUMMON: '召喚',
  HEAL: '回復',
};

const ATTACK_TIMELINE: Record<SkillAttackType, SkillPresentationTimeline> = {
  SLASH: { castMs: 120, travelMs: 120, impactMs: 260, aftermathMs: 300, damageTimingsMs: [250] },
  STRIKE: { castMs: 180, travelMs: 80, impactMs: 300, aftermathMs: 320, damageTimingsMs: [280] },
  PROJECTILE: { castMs: 220, travelMs: 260, impactMs: 220, aftermathMs: 300, damageTimingsMs: [500] },
  MAGIC: { castMs: 320, travelMs: 120, impactMs: 360, aftermathMs: 360, damageTimingsMs: [500] },
  SUMMON: { castMs: 420, travelMs: 160, impactMs: 420, aftermathMs: 420, damageTimingsMs: [680] },
  HEAL: { castMs: 300, travelMs: 0, impactMs: 360, aftermathMs: 400, damageTimingsMs: [420] },
};

const ATTACK_SHAPE: Record<SkillAttackType, { marker: PresentationTargetMarker; shape: string }> = {
  SLASH: { marker: 'CROSSHAIR', shape: '交差する三本の刃線' },
  STRIKE: { marker: 'RING', shape: '二重の衝撃環' },
  PROJECTILE: { marker: 'CROSSHAIR', shape: '軌道線と着弾環' },
  MAGIC: { marker: 'RUNE', shape: '回転する術式環' },
  SUMMON: { marker: 'RUNE', shape: '門と召喚紋' },
  HEAL: { marker: 'RING', shape: '上昇する生命環' },
};

function sfxCues(attackType: SkillAttackType, timeline: SkillPresentationTimeline): PresentationSfxCue[] {
  const impactAt = timeline.damageTimingsMs[0] ?? timeline.castMs + timeline.travelMs;
  return [
    { profileKey: attackType === 'SUMMON' ? 'abyss_gate' : attackType === 'HEAL' ? 'soul_mend' : 'rune_cast', atMs: 0, pitch: 1, volume: 0.72, layer: 'CAST' },
    { profileKey: attackType === 'SLASH' ? 'blade_cut' : attackType === 'STRIKE' ? 'bone_impact' : attackType === 'PROJECTILE' ? 'spectral_flight' : attackType === 'HEAL' ? 'soul_bloom' : 'abyss_impact', atMs: impactAt, pitch: 1, volume: 0.92, layer: 'IMPACT' },
  ];
}

export function createFallbackPresentation(
  element: ElementType,
  attackType: SkillAttackType,
  effectKey = `${element.toLowerCase()}_${attackType.toLowerCase()}`,
): SkillPresentationSpec {
  const timeline = ATTACK_TIMELINE[attackType];
  const shape = ATTACK_SHAPE[attackType];
  const isHeavy = attackType === 'STRIKE' || attackType === 'SUMMON';
  const isGentle = attackType === 'HEAL';
  return {
    effectKey,
    element,
    attackType,
    label: `${element} ${ATTACK_LABEL[attackType]}`,
    timeline: { ...timeline, damageTimingsMs: [...timeline.damageTimingsMs] },
    vfx: {
      implementation: attackType === 'MAGIC' || attackType === 'SUMMON' ? 'SVG' : 'CSS',
      particleBudget: attackType === 'SUMMON' ? 36 : isGentle ? 20 : 24,
      domNodeBudget: 46,
      blendMode: isGentle ? 'normal' : 'screen',
      colors: { ...ELEMENT_PALETTE[element] },
      textureAssetRefs: [],
      hitStopMs: isGentle ? 0 : isHeavy ? 82 : 48,
      cameraShake: { intensity: isGentle ? 0 : isHeavy ? 0.72 : 0.38, durationMs: isGentle ? 0 : isHeavy ? 210 : 140 },
      screenFlash: { color: ELEMENT_PALETTE[element].primary, opacity: isGentle ? 0.12 : 0.22, durationMs: isGentle ? 180 : 120 },
      targetMarker: shape.marker,
      shapeCue: shape.shape,
    },
    sfx: { cues: sfxCues(attackType, timeline) },
    accessibility: {
      reducedMotion: isGentle ? 'FADE_ONLY' : 'STATIC_GLYPH',
      reducedParticleScale: 0.25,
      flashHzMax: 2,
      colorIndependent: true,
    },
    performance: {
      lowDeviceParticleBudget: attackType === 'SUMMON' ? 18 : 12,
      maxDomNodes: 52,
      targetFrameMs: 16.67,
    },
  };
}

const SPECIALIZED_PRESENTATIONS: Record<string, SkillPresentationSpec> = {
  thunder_slash: {
    ...createFallbackPresentation('THUNDER', 'SLASH', 'thunder_slash'),
    label: '雷葬三閃',
    timeline: { castMs: 90, travelMs: 90, impactMs: 310, aftermathMs: 320, damageTimingsMs: [190, 265, 340] },
    vfx: {
      ...createFallbackPresentation('THUNDER', 'SLASH').vfx,
      particleBudget: 32,
      shapeCue: '白い稲妻を伴う三本の斬線',
      cameraShake: { intensity: 0.54, durationMs: 220 },
    },
    sfx: {
      cues: [
        { profileKey: 'rune_cast', atMs: 0, pitch: 1.12, volume: 0.68, layer: 'CAST' },
        { profileKey: 'blade_cut', atMs: 190, pitch: 1.18, volume: 0.9, layer: 'IMPACT' },
        { profileKey: 'blade_cut', atMs: 265, pitch: 1.32, volume: 0.82, layer: 'IMPACT' },
        { profileKey: 'blade_cut', atMs: 340, pitch: 1.46, volume: 0.76, layer: 'IMPACT' },
      ],
    },
  },
  dark_summon: {
    ...createFallbackPresentation('DARK', 'SUMMON', 'dark_summon'),
    label: '深淵召来',
    timeline: { castMs: 460, travelMs: 120, impactMs: 480, aftermathMs: 460, damageTimingsMs: [720, 860] },
    vfx: {
      ...createFallbackPresentation('DARK', 'SUMMON').vfx,
      particleBudget: 44,
      domNodeBudget: 58,
      shapeCue: '骨の門を縁取る逆回転の深淵紋',
      cameraShake: { intensity: 0.78, durationMs: 300 },
    },
    performance: {
      ...createFallbackPresentation('DARK', 'SUMMON').performance,
      maxDomNodes: 64,
    },
    sfx: {
      cues: [
        { profileKey: 'abyss_gate', atMs: 0, pitch: 0.82, volume: 0.76, layer: 'CAST' },
        { profileKey: 'abyss_impact', atMs: 720, pitch: 0.78, volume: 0.96, layer: 'IMPACT' },
        { profileKey: 'bone_impact', atMs: 860, pitch: 0.68, volume: 0.82, layer: 'IMPACT' },
      ],
    },
  },
  light_heal: {
    ...createFallbackPresentation('LIGHT', 'HEAL', 'light_heal'),
    label: '魂灯の癒し',
  },
};

const APPLIED_PRESENTATIONS = appliedPresentationData as Record<string, SkillPresentationSpec>;

export function resolveSkillPresentation(
  effectKey: string | undefined,
  element: ElementType,
  attackType: SkillAttackType,
): SkillPresentationSpec {
  const requested = effectKey?.trim();
  const derived = `${element.toLowerCase()}_${attackType.toLowerCase()}`;
  const exact = requested ? APPLIED_PRESENTATIONS[requested] ?? SPECIALIZED_PRESENTATIONS[requested] : undefined;
  const elemental = APPLIED_PRESENTATIONS[derived] ?? SPECIALIZED_PRESENTATIONS[derived];
  const resolved = exact ?? elemental ?? createFallbackPresentation(element, attackType, requested || derived);
  return structuredClone(resolved);
}

export function listRegisteredPresentations(): SkillPresentationSpec[] {
  const common = (Object.keys(ATTACK_LABEL) as SkillAttackType[]).map(attackType => createFallbackPresentation('NONE', attackType, `common_${attackType.toLowerCase()}`));
  const merged = { ...Object.fromEntries(common.map(spec => [spec.effectKey, spec])), ...SPECIALIZED_PRESENTATIONS, ...APPLIED_PRESENTATIONS };
  return Object.values(merged).sort((a, b) => a.effectKey.localeCompare(b.effectKey));
}

export function createPresentationSchedule(spec: SkillPresentationSpec, playbackRate = 1): PresentationSchedule {
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const scale = (value: number) => Math.round(value / rate);
  const travel = spec.timeline.castMs;
  const impact = travel + spec.timeline.travelMs;
  const aftermath = impact + spec.timeline.impactMs;
  const total = aftermath + spec.timeline.aftermathMs;
  return {
    totalMs: scale(total),
    phaseStarts: { cast: 0, travel: scale(travel), impact: scale(impact), aftermath: scale(aftermath) },
    damageTimingsMs: spec.timeline.damageTimingsMs.map(scale),
    sfxCues: spec.sfx.cues.map(cue => ({ ...cue, atMs: scale(cue.atMs) })),
  };
}

export function validateSkillPresentationSpec(spec: SkillPresentationSpec): PresentationFinding[] {
  const findings: PresentationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const total = spec.timeline.castMs + spec.timeline.travelMs + spec.timeline.impactMs + spec.timeline.aftermathMs;
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(spec.effectKey)) fail('effectKey', 'effectKeyはsnake_caseで指定してください。');
  if (!spec.timeline.damageTimingsMs.length) fail('timeline.damageTimingsMs', 'ダメージ時刻が1件以上必要です。');
  if ([spec.timeline.castMs, spec.timeline.travelMs, spec.timeline.impactMs, spec.timeline.aftermathMs, ...spec.timeline.damageTimingsMs].some(value => !Number.isFinite(value) || value < 0)) fail('timeline', 'durationとdamage timingは非負の数値にしてください。');
  if (spec.timeline.damageTimingsMs.some(value => value > total)) fail('timeline.damageTimingsMs', 'ダメージ時刻は演出総時間内にしてください。');
  if (spec.vfx.particleBudget > 120) fail('vfx.particleBudget', '粒子予算は120以下にしてください。');
  if (spec.vfx.domNodeBudget > spec.performance.maxDomNodes) fail('vfx.domNodeBudget', 'DOM予算がperformance.maxDomNodesを超えています。');
  if (spec.performance.lowDeviceParticleBudget > spec.vfx.particleBudget) fail('performance.lowDeviceParticleBudget', '低性能端末の粒子予算は通常予算以下にしてください。');
  if (spec.performance.targetFrameMs < 16.6) fail('performance.targetFrameMs', '60fpsを超える非現実的なフレーム予算です。');
  if (spec.vfx.implementation === 'PIXI' && spec.vfx.particleBudget <= 64) warn('vfx.implementation', '64粒子以下はCSS/SVG/Framerを優先してください。');
  if (spec.vfx.implementation !== 'PIXI' && spec.vfx.particleBudget > 64) warn('vfx.particleBudget', '64粒子超はPixiJS化を検討してください。');
  if (spec.accessibility.flashHzMax > 3) fail('accessibility.flashHzMax', '点滅は3Hz以下にしてください。');
  if (!spec.accessibility.colorIndependent || !spec.vfx.shapeCue.trim()) fail('accessibility.colorIndependent', '色以外の形状手掛かりを必須にしてください。');
  if (spec.vfx.screenFlash.opacity > 0.45) warn('vfx.screenFlash.opacity', '画面フラッシュが強すぎます。');
  for (const [index, cue] of spec.sfx.cues.entries()) {
    if (!cue.profileKey.trim()) fail(`sfx.cues.${index}.profileKey`, 'SFX profileKeyが必要です。');
    if (cue.atMs < 0 || cue.atMs > total) fail(`sfx.cues.${index}.atMs`, 'SFX時刻は演出総時間内にしてください。');
    if (cue.pitch < 0.5 || cue.pitch > 2) fail(`sfx.cues.${index}.pitch`, 'pitchは0.5〜2にしてください。');
    if (cue.volume < 0 || cue.volume > 1) fail(`sfx.cues.${index}.volume`, 'volumeは0〜1にしてください。');
  }
  for (const [index, damageAt] of spec.timeline.damageTimingsMs.entries()) {
    if (!spec.sfx.cues.some(cue => cue.layer === 'IMPACT' && Math.abs(cue.atMs - damageAt) <= 16)) fail(`timeline.damageTimingsMs.${index}`, '各damage timingには±16ms以内のIMPACT SFX cueが必要です。');
  }
  return findings;
}
