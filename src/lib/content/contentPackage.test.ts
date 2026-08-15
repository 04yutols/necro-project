import {
  calculateContentPackageHash,
  transitionContentPackage,
  validateContentPackage,
  type ContentPackage,
  type ContentPackageValidationContext,
} from './contentPackage';
import type { LoreRegistry } from './loreRegistry';
import {
  getContentReviewSummary,
  reviewContentItem,
  syncContentReviewItems,
} from './contentReviewWorkflow';

const registry: LoreRegistry = {
  schemaVersion: 1,
  updatedAt: '2026-07-31T00:00:00.000Z',
  entries: [
    {
      id: 'royal_capital',
      kind: 'PLACE',
      certainty: 'CONFIRMED',
      nameJa: '亡国の王都',
      aliases: ['王都'],
      summary: '第1章の舞台。',
      chapterIntroduced: 1,
      sourceRefs: ['docs/progress/CH1_TODO.md'],
      tags: ['第1章'],
    },
  ],
  relationships: [],
  timeline: [],
};

const assetHash = 'a'.repeat(64);
const assetSource = 'content/packages/test/assets/fallen_crown.webp';

const context: ContentPackageValidationContext = {
  loreRegistry: registry,
  assetFiles: { [assetSource]: { exists: true, bytes: 128, sha256: assetHash } },
  bundle: {
    characters: {},
    storySceneIds: new Set(),
    storyPackIds: new Set(['act1_ch1']),
    stageIds: new Set(['area1_node1']),
    areaIds: new Set(['ch1_area1']),
    items: {},
    enemies: {},
    monsters: {},
    skills: {},
    jobs: {},
    materials: {},
    residueNames: {},
  },
};

function completeDraft(): ContentPackage {
  return {
    schemaVersion: 2,
    id: 'fallen_crown_package',
    title: '落冠の灰パッケージ',
    revision: 1,
    chapter: 1,
    status: 'DRAFT',
    brief: {
      playerExperience: '亡国の記憶を残滓として収集する。',
      themes: ['喪失', '王権'],
      mustInclude: ['残滓性能は既存RNGに委ねる'],
      avoid: ['第2章設定'],
    },
    targets: [{ id: 'fallen_crown_ash', kind: 'abyssal-residue', loreRefs: ['royal_capital'] }],
    lore: { registryRefs: ['royal_capital'], entries: [], relationships: [], timelineEvents: [] },
    deliverables: [
      {
        id: 'fallen_crown_slot_visual',
        ownerId: 'fallen_crown_ash',
        scope: 'asset',
        kind: 'slot-visual',
        required: true,
        state: 'READY',
        outputRefs: ['asset:fallen_crown_slot'],
      },
      {
        id: 'fallen_crown_name_pool',
        ownerId: 'fallen_crown_ash',
        scope: 'acquisition-link',
        kind: 'name-pool',
        required: true,
        state: 'READY',
        outputRefs: ['change:residue-name:fallen_crown_ash'],
        artifact: { service: 'RewardService', pool: 'EPIC' },
      },
    ],
    dependencies: [
      {
        id: 'name_pool_requires_change',
        from: 'deliverable:fallen_crown_name_pool',
        to: 'change:residue-name:fallen_crown_ash',
        relation: 'REQUIRES',
        reason: '名称プール接続にはマスターデータが必要。',
      },
    ],
    changes: [
      {
        scope: 'residue-name',
        id: 'fallen_crown_ash',
        data: {
          id: 'fallen_crown_ash',
          name: '落冠の灰',
          rarity: 'EPIC',
          chapter: 1,
          origin: '最後の戴冠式を焼いた黒炎から残った灰。',
          tags: ['亡国', '王権'],
        },
      },
    ],
    assets: [
      {
        id: 'fallen_crown_slot',
        ownerId: 'fallen_crown_ash',
        kind: 'slot-visual',
        state: 'READY',
        mediaType: 'image',
        format: 'webp',
        sourcePath: assetSource,
        outputPath: 'public/images/generated/residues/fallen_crown_ash/slot.webp',
        width: 256,
        height: 256,
        alpha: true,
        safeArea: { top: 16, right: 16, bottom: 16, left: 16 },
        bytes: 128,
        contentHash: assetHash,
        provenancePromptRef: 'residue_visual_prompt',
        referenceAssetRefs: [],
      },
    ],
    presentation: [],
    localization: [
      { id: 'fallen_crown_name_ja', ownerId: 'fallen_crown_ash', locale: 'ja', kind: 'name', text: '落冠の灰' },
      { id: 'fallen_crown_name_en', ownerId: 'fallen_crown_ash', locale: 'en', kind: 'name', text: 'Ash of the Fallen Crown' },
      { id: 'fallen_crown_alt_ja', ownerId: 'fallen_crown_ash', locale: 'ja', kind: 'alt', text: '黒炎の灰へ崩れる褪せた王冠' },
      { id: 'fallen_crown_alt_en', ownerId: 'fallen_crown_ash', locale: 'en', kind: 'alt', text: 'A tarnished crown crumbling into black ash' },
    ],
    evidence: [],
    provenance: {
      createdAt: '2026-07-31T00:00:00.000Z',
      createdBy: { name: 'Codex', type: 'codex' },
      generator: { name: 'Codex' },
      prompts: [{ id: 'residue_visual_prompt', purpose: '残滓画像', text: '亡国の王冠が灰へ崩れる残滓アイコン。' }],
      references: [{ id: 'world_bible', kind: 'file', uri: '.agents/skills/forge-game-content/references/world-bible.md' }],
      hashAlgorithm: 'sha256',
    },
    review: { history: [], blockers: [] },
  };
}

describe('Content Package', () => {
  test('完成したDRAFTをVALIDATEDへ遷移しcontent hashを固定する', () => {
    const draftFindings = validateContentPackage(completeDraft(), context);
    expect(draftFindings.filter(finding => finding.level === 'FAIL')).toEqual([]);
    expect(draftFindings.some(finding => finding.field === 'contentHash' && finding.level === 'WARN')).toBe(true);

    const result = transitionContentPackage(completeDraft(), 'VALIDATED', {
      actor: 'content-validator',
      actorType: 'automation',
      at: '2026-07-31T01:00:00.000Z',
    }, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.provenance.contentHash).toBe(calculateContentPackageHash(result.package));
    expect(result.package.status).toBe('VALIDATED');
  });

  test('必須成果物が不足したpackageはDRAFTでは警告、VALIDATEDでは失敗になる', () => {
    const draft = completeDraft();
    draft.deliverables[0].state = 'PLANNED';
    draft.deliverables[0].outputRefs = [];
    draft.assets[0].state = 'PLANNED';
    delete draft.assets[0].sourcePath;
    delete draft.assets[0].contentHash;
    delete draft.assets[0].bytes;
    const findings = validateContentPackage(draft, context);
    expect(findings.some(finding => finding.level === 'WARN' && finding.message.includes('READY'))).toBe(true);
    expect(findings.some(finding => finding.level === 'FAIL')).toBe(false);

    const result = transitionContentPackage(draft, 'VALIDATED', { actor: 'content-validator', actorType: 'automation' }, context);
    expect(result.ok).toBe(false);
    expect(result.findings.some(finding => finding.level === 'FAIL' && finding.message.includes('READY'))).toBe(true);
  });

  test('参照切れとREQUIRES循環を適用前に列挙する', () => {
    const draft = completeDraft();
    draft.deliverables[0].outputRefs.push('asset:missing_asset');
    draft.dependencies.push(
      {
        id: 'visual_requires_link',
        from: 'deliverable:fallen_crown_slot_visual',
        to: 'deliverable:fallen_crown_name_pool',
        relation: 'REQUIRES',
        reason: 'test',
      },
      {
        id: 'link_requires_visual',
        from: 'deliverable:fallen_crown_name_pool',
        to: 'deliverable:fallen_crown_slot_visual',
        relation: 'REQUIRES',
        reason: 'test',
      },
    );
    const findings = validateContentPackage(draft, context);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.message.includes('missing_asset'))).toBe(true);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.message.includes('循環'))).toBe(true);
  });

  test('CodexによるREVIEWED・APPROVED遷移を拒否する', () => {
    const validated = transitionContentPackage(completeDraft(), 'VALIDATED', { actor: 'validator', actorType: 'automation' }, context);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const reviewed = transitionContentPackage(validated.package, 'REVIEWED', { actor: 'Codex', actorType: 'codex', comment: '自己レビュー' }, context);
    expect(reviewed.ok).toBe(false);
    expect(reviewed.findings.some(finding => finding.message.includes('人間だけ'))).toBe(true);
  });

  test('人間レビューと承認の履歴を順番に保持する', () => {
    const validated = transitionContentPackage(completeDraft(), 'VALIDATED', { actor: 'validator', actorType: 'automation' }, context);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const reviewed = transitionContentPackage(validated.package, 'REVIEWED', { actor: 'reviewer', actorType: 'human', comment: '世界観と画像を確認した。' }, context);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    const approved = transitionContentPackage(reviewed.package, 'APPROVED', { actor: 'director', actorType: 'human', comment: '反映を承認する。' }, context);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.package.review.history.map(item => item.to)).toEqual(['VALIDATED', 'REVIEWED', 'APPROVED']);
  });

  test('項目ごとの承認が揃うまでREVIEWEDへ進めない', () => {
    const synced = syncContentReviewItems(completeDraft(), { actor: 'reviewer', actorType: 'human', at: '2026-08-01T00:00:00.000Z' }).package;
    const pendingValidated = transitionContentPackage(synced, 'VALIDATED', { actor: 'validator', actorType: 'automation' }, context);
    expect(pendingValidated.ok).toBe(true);
    if (pendingValidated.ok) {
      const rejected = transitionContentPackage(pendingValidated.package, 'REVIEWED', { actor: 'reviewer', actorType: 'human', comment: '未確認のまま完了する。' }, context);
      expect(rejected.ok).toBe(false);
      expect(rejected.findings.some(finding => finding.scope === 'review-item' && finding.level === 'FAIL')).toBe(true);
    }
    let current = synced;
    for (const item of synced.review.items ?? []) {
      const decision = reviewContentItem(current, {
        ref: item.ref,
        status: 'APPROVED',
        actor: 'reviewer',
        actorType: 'human',
        comment: `${item.ref}の内容を確認した。`,
        at: '2026-08-01T00:01:00.000Z',
      });
      expect(decision.ok).toBe(true);
      if (decision.ok) current = decision.package;
    }
    expect(getContentReviewSummary(current).complete).toBe(true);
    const validated = transitionContentPackage(current, 'VALIDATED', { actor: 'validator', actorType: 'automation' }, context);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const reviewed = transitionContentPackage(validated.package, 'REVIEWED', { actor: 'reviewer', actorType: 'human', comment: '全項目を確認した。' }, context);
    expect(reviewed.ok).toBe(true);
  });

  test('内容が変わった項目だけ承認を自動失効する', () => {
    let current = syncContentReviewItems(completeDraft()).package;
    for (const ref of ['target:fallen_crown_ash', 'change:residue-name:fallen_crown_ash']) {
      const decision = reviewContentItem(current, { ref, status: 'APPROVED', actor: 'reviewer', actorType: 'human', comment: '確認済み。' });
      expect(decision.ok).toBe(true);
      if (decision.ok) current = decision.package;
    }
    current.changes[0].data = { ...current.changes[0].data, origin: '再生成された由来。' };
    const synced = syncContentReviewItems(current, { actor: 'content-review-sync', actorType: 'automation' });
    expect(synced.resetRefs).toEqual(['change:residue-name:fallen_crown_ash']);
    expect(synced.package.review.items?.find(item => item.ref === 'target:fallen_crown_ash')?.status).toBe('APPROVED');
    expect(synced.package.review.items?.find(item => item.ref === 'change:residue-name:fallen_crown_ash')?.status).toBe('PENDING');
    expect(synced.package.review.audit?.some(item => item.action === 'ITEM_RESET')).toBe(true);
  });

  test('未完成の証跡を持つ対象は承認できず、差し戻し理由を監査する', () => {
    const draft = completeDraft();
    draft.evidence.push({ id: 'fallen_crown_check', ownerId: 'fallen_crown_ash', kind: 'visual-check', status: 'PENDING', summary: '確認待ち。', createdAt: '2026-08-01T00:00:00.000Z' });
    const synced = syncContentReviewItems(draft).package;
    const rejected = reviewContentItem(synced, { ref: 'target:fallen_crown_ash', status: 'APPROVED', actor: 'reviewer', actorType: 'human', comment: '承認する。' });
    expect(rejected.ok).toBe(false);
    const changes = reviewContentItem(synced, { ref: 'target:fallen_crown_ash', status: 'CHANGES_REQUESTED', actor: 'reviewer', actorType: 'human', comment: '画像確認を完了してください。' });
    expect(changes.ok).toBe(true);
    if (!changes.ok) return;
    expect(changes.package.review.audit?.at(-1)?.comment).toBe('画像確認を完了してください。');
  });

  test('検証後の内容改変をcontent hash不一致として検出する', () => {
    const validated = transitionContentPackage(completeDraft(), 'VALIDATED', { actor: 'validator', actorType: 'automation' }, context);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    validated.package.brief.themes.push('改変');
    const findings = validateContentPackage(validated.package, context);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.field === 'contentHash')).toBe(true);
  });

  test('schemaにないフィールドを拒否する', () => {
    const draft = completeDraft() as ContentPackage & { unexpected?: string };
    draft.unexpected = 'drift';
    const findings = validateContentPackage(draft, context);
    expect(findings.some(finding => finding.level === 'FAIL' && finding.field === 'unexpected')).toBe(true);
  });

  test('READY presentationの同期・アクセシビリティ・性能予算を検証する', () => {
    const draft = completeDraft();
    draft.presentation.push({
      id: 'fallen_crown_presentation',
      ownerId: 'fallen_crown_ash',
      effectKey: 'dark_magic_fallen_crown',
      state: 'READY',
      element: 'DARK',
      attackType: 'MAGIC',
      label: '落冠の灰',
      timeline: { castMs: 240, travelMs: 120, impactMs: 320, aftermathMs: 280, damageTimingsMs: [420] },
      vfx: {
        implementation: 'SVG', particleBudget: 32, domNodeBudget: 48, blendMode: 'screen',
        colors: { primary: '#a855f7', secondary: '#4c1d95', accent: '#ffffff' },
        textureAssetRefs: [], hitStopMs: 48,
        cameraShake: { intensity: 0.4, durationMs: 160 },
        screenFlash: { color: '#a855f7', opacity: 0.2, durationMs: 120 },
        targetMarker: 'RUNE', shapeCue: '崩れた王冠形の術式',
      },
      sfx: { cues: [
        { profileKey: 'rune_cast', atMs: 0, pitch: 1, volume: 0.8, layer: 'CAST' },
        { profileKey: 'abyss_impact', atMs: 420, pitch: 1, volume: 0.9, layer: 'IMPACT' },
      ] },
      accessibility: { reducedMotion: 'STATIC_GLYPH', reducedParticleScale: 0.25, flashHzMax: 2, colorIndependent: true },
      performance: { lowDeviceParticleBudget: 12, maxDomNodes: 56, targetFrameMs: 16.67 },
    });
    const findings = validateContentPackage(draft, context);
    expect(findings.filter(finding => finding.level === 'FAIL')).toEqual([]);

    const conflict = validateContentPackage(draft, {
      ...context,
      presentationRegistry: { dark_magic_fallen_crown: draft.presentation[0] as never },
    });
    expect(conflict.some(finding => finding.level === 'FAIL' && finding.field === 'effectKey' && finding.message.includes('上書き'))).toBe(true);
  });
});
