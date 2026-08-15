import type {
  AssetRecord,
  ContentDeliverable,
  ContentEvidence,
  ContentLocalization,
  ContentPackage,
  ContentTarget,
  SkillPresentationRecord,
} from './contentPackage';

export type ProductionForwardSampleKind = 'STORY' | 'CONTROLLED_MONSTER' | 'WEAPON' | 'BOSS';

export type ProductionForwardSample = {
  kind: ProductionForwardSampleKind;
  package: ContentPackage;
  runtimeChecks: Array<{ label: string; test: (pkg: ContentPackage) => boolean }>;
};

const CREATED_AT = '2026-08-01T00:00:00.000Z';
const ASSET_HASH = 'a'.repeat(64);

function target(id: string, kind: ContentTarget['kind']): ContentTarget {
  return { id, kind, loreRefs: ['royal_capital'] };
}

function deliverable(
  ownerId: string,
  scope: ContentDeliverable['scope'],
  kind: string,
  suffix: string,
  outputRefs: string[] = [],
  artifact?: Record<string, unknown>,
): ContentDeliverable {
  return {
    id: `${ownerId}_${suffix}`,
    ownerId,
    scope,
    kind,
    required: true,
    state: 'READY',
    outputRefs,
    ...(artifact ? { artifact } : {}),
  };
}

function asset(packageId: string, ownerId: string, id: string, kind: string): AssetRecord {
  return {
    id,
    ownerId,
    kind,
    state: 'READY',
    mediaType: 'image',
    format: 'svg',
    sourcePath: `content/packages/${packageId}/assets/${id}.svg`,
    outputPath: `public/images/generated/production-samples/${ownerId}/${id}.svg`,
    width: 512,
    height: 512,
    alpha: true,
    safeArea: { top: 48, right: 48, bottom: 48, left: 48 },
    bytes: 256,
    contentHash: ASSET_HASH,
    referenceAssetRefs: [],
  };
}

function presentation(ownerId: string, effectKey: string, id = `${ownerId}_presentation`): SkillPresentationRecord {
  return {
    id,
    ownerId,
    effectKey,
    state: 'READY',
    element: 'DARK',
    attackType: 'SLASH',
    label: `${ownerId} production presentation`,
    timeline: { castMs: 140, travelMs: 80, impactMs: 220, aftermathMs: 240, damageTimingsMs: [260] },
    vfx: {
      implementation: 'SVG',
      particleBudget: 20,
      domNodeBudget: 32,
      blendMode: 'screen',
      colors: { primary: '#8B00FF', secondary: '#4c1d95', accent: '#f5d0fe' },
      textureAssetRefs: [],
      hitStopMs: 48,
      cameraShake: { intensity: 0.3, durationMs: 120 },
      screenFlash: { color: '#8B00FF', opacity: 0.16, durationMs: 80 },
      targetMarker: 'RUNE',
      shapeCue: '三角形の墓標と交差する刃線',
    },
    sfx: {
      cues: [
        { profileKey: 'rune_cast', atMs: 0, pitch: 1, volume: 0.7, layer: 'CAST' },
        { profileKey: 'abyss_impact', atMs: 260, pitch: 1, volume: 0.85, layer: 'IMPACT' },
      ],
    },
    accessibility: { reducedMotion: 'STATIC_GLYPH', reducedParticleScale: 0.2, flashHzMax: 2, colorIndependent: true },
    performance: { lowDeviceParticleBudget: 8, maxDomNodes: 36, targetFrameMs: 16.67 },
  };
}

function localize(ownerId: string, nameJa: string, nameEn: string, withSubtitle = false): ContentLocalization[] {
  return [
    { id: `${ownerId}_name_ja`, ownerId, locale: 'ja', kind: 'name', text: nameJa },
    { id: `${ownerId}_name_en`, ownerId, locale: 'en', kind: 'name', text: nameEn },
    { id: `${ownerId}_alt_ja`, ownerId, locale: 'ja', kind: 'alt', text: `${nameJa}のゲーム内ビジュアル` },
    { id: `${ownerId}_alt_en`, ownerId, locale: 'en', kind: 'alt', text: `Game visual for ${nameEn}` },
    ...(withSubtitle ? [
      { id: `${ownerId}_subtitle_ja`, ownerId, locale: 'ja' as const, kind: 'subtitle' as const, text: '魂音が響き、墓標の紋が走る' },
      { id: `${ownerId}_subtitle_en`, ownerId, locale: 'en' as const, kind: 'subtitle' as const, text: 'A soul-tone rings as the grave sigil cuts through' },
    ] : []),
  ];
}

function evidence(ownerId: string, kind: string): ContentEvidence {
  return {
    id: `${ownerId}_${kind.replaceAll('-', '_')}`,
    ownerId,
    kind,
    status: 'PASS',
    summary: `${kind} production gate passed`,
    createdAt: CREATED_AT,
  };
}

function basePackage(id: string, title: string, targets: ContentTarget[]): ContentPackage {
  return {
    schemaVersion: 2,
    id,
    title,
    revision: 1,
    chapter: 1,
    status: 'DRAFT',
    brief: {
      playerExperience: '亡国の記憶を力へ変える代償を、戦闘と物語の両方から体験する。',
      themes: ['記憶と代償', '亡国の王都'],
      mustInclude: ['第1章', '冥術', '黒曜石とVoid Purple'],
      avoid: ['現代兵器', '軽薄なコメディ', '人間仲間の追加'],
    },
    targets,
    lore: { registryRefs: ['royal_capital'], entries: [], relationships: [], timelineEvents: [] },
    deliverables: [],
    dependencies: [],
    changes: [],
    assets: [],
    presentation: [],
    localization: [],
    evidence: [],
    provenance: {
      createdAt: CREATED_AT,
      createdBy: { name: 'production-forward-sample-generator', type: 'automation' },
      generator: { name: 'Necromance Brave Content Forge', version: 'phase7' },
      prompts: [{ id: `${id}_prompt`, purpose: 'Phase 7前方互換サンプル', text: `${title}を第1章の世界観と本番品質ゲートに従って生成する。` }],
      references: [{ id: 'world_bible', kind: 'file', uri: '.agents/skills/forge-game-content/references/world-bible.md' }],
      hashAlgorithm: 'sha256',
    },
    review: { history: [], blockers: [] },
  };
}

function addAssetDeliverable(pkg: ContentPackage, ownerId: string, id: string, kind: string): void {
  pkg.assets.push(asset(pkg.id, ownerId, id, kind));
  pkg.deliverables.push(deliverable(ownerId, 'asset', kind, `asset_${kind.replaceAll('-', '_')}`, [`asset:${id}`]));
}

function makeStorySample(): ProductionForwardSample {
  const characterId = 'story_char_veil_keeper';
  const sceneId = 'CH1_VEIL_KEEPER_OATH';
  const pkg = basePackage('phase7_sample_story', '帳守ミレアと灰の誓い', [target(characterId, 'story-character')]);
  pkg.changes.push(
    {
      scope: 'story-character',
      id: characterId,
      data: {
        id: characterId,
        nameJa: '帳守ミレア',
        nameEn: 'Mirea, Veil Keeper',
        color: '#8B00FF',
        glow: 'rgba(139,0,255,0.45)',
        portraitBase: '/images/story/mirea/base.webp',
        expressions: ['default', 'sorrow'],
      },
    },
    {
      scope: 'story-scene',
      id: sceneId,
      packId: 'act1_ch1',
      data: {
        id: sceneId,
        type: 'DIALOGUE',
        trigger: { type: 'STAGE_ENTER', stageId: 'area1_node1' },
        lines: [
          { speaker: characterId, text: '忘れられた名は、深淵で最初に朽ちます。', textEn: 'Forgotten names are the first to decay in the abyss.', expression: 'sorrow' },
          { speaker: 'aldo', text: 'なら俺が覚えている。代償ごとな。', textEn: 'Then I will remember them—even the cost.', expression: 'default' },
        ],
        isSkippable: true,
        archiveTitle: '灰の誓い',
        archiveChapter: 1,
      },
    },
  );
  pkg.deliverables.push(
    deliverable(characterId, 'character-profile', 'profile', 'profile', [], {
      wish: '死者の名を王都の記録へ戻す',
      fear: '自身の名まで深淵へ失うこと',
      values: '記憶は死者に残された最後の墓標',
      voice: '静かで古風。断定の前に短い間を置く',
    }),
    deliverable(characterId, 'character-profile', 'relationships', 'relationships', [], { relationship: 'アルドへ亡者の名を託す案内人' }),
    deliverable(characterId, 'acquisition-link', 'story-entry', 'story_entry', [`change:story-scene:${sceneId}`], { stageId: 'area1_node1', sceneId }),
  );
  addAssetDeliverable(pkg, characterId, 'veil_keeper_portrait', 'portrait-base');
  addAssetDeliverable(pkg, characterId, 'veil_keeper_expression', 'expression-set');
  pkg.localization.push(...localize(characterId, '帳守ミレア', 'Mirea, Veil Keeper'));
  return {
    kind: 'STORY',
    package: pkg,
    runtimeChecks: [
      { label: '人物とシーンが同一packageで接続される', test: value => value.changes.some(change => change.scope === 'story-scene' && JSON.stringify(change.data).includes(characterId)) },
      { label: '日英台詞が収録される', test: value => value.changes.some(change => change.scope === 'story-scene' && Array.isArray(change.data.lines) && change.data.lines.every(line => typeof line === 'object' && line !== null && 'textEn' in line)) },
    ],
  };
}

function enemyData(id: string, skillId: string, tier: 'MINION' | 'BOSS') {
  return {
    id,
    name: tier === 'BOSS' ? '鐘墓の主' : '墓標の番兵',
    nameJa: tier === 'BOSS' ? '鐘墓の主オルドラン' : '墓標の番兵',
    nameEn: tier === 'BOSS' ? 'Oldran, Lord of the Bell Grave' : 'Gravemark Sentinel',
    tier,
    tribe: 'UNDEAD',
    stats: tier === 'BOSS'
      ? { hp: 188, atk: 11, def: 17, spd: 45, critRate: 10, critDmg: 175, effectHit: 4, effectRes: 42 }
      : { hp: 36, atk: 8, def: 8, spd: 82, critRate: 5, critDmg: 150, effectHit: 4, effectRes: 8 },
    resistances: { LIGHT: -25, DARK: 20 },
    weaknesses: ['LIGHT'],
    dropTable: [{ itemId: 'grave_crystal', type: 'MATERIAL', rate: 0.25, minQuantity: 1, maxQuantity: 1 }],
    battle: { color: '#8B00FF', sprite: tier === 'BOSS' ? 'GIANT' : 'KNIGHT', size: tier === 'BOSS' ? 1.1 : 0.9 },
    description: '名を失った墓標を守り、冥術の命令を死後も反復する騎士。',
    necromance: {
      captureRate: tier === 'BOSS' ? 0.001 : 0.08,
      allyCost: tier === 'BOSS' ? 4 : 2,
      allyStats: tier === 'BOSS'
        ? { hp: 180, atk: 18, def: 22, spd: 76, critRate: 8, critDmg: 160, effectHit: 12, effectRes: 24 }
        : { hp: 48, atk: 10, def: 10, spd: 86, critRate: 5, critDmg: 150, effectHit: 8, effectRes: 10 },
      allyMaxEnergy: 90,
      skillIds: [skillId],
    },
  };
}

function skillData(id: string, name: string, effectKey: string) {
  return {
    id,
    name,
    mpCost: 14,
    power: 1.6,
    type: 'PHYSICAL',
    element: 'DARK',
    attackType: 'SLASH',
    targetType: 'SINGLE',
    effectKey,
    description: '墓標の形に斬線を重ね、敵単体へ闇属性ダメージを与える。',
  };
}

function addCombatUnit(pkg: ContentPackage, enemyId: string, skillId: string, nameJa: string, nameEn: string): void {
  pkg.changes.push({ scope: 'enemy', id: enemyId, data: enemyData(enemyId, skillId, 'MINION') });
  pkg.deliverables.push(
    deliverable(enemyId, 'combat-unit', 'identity', 'identity', [`change:enemy:${enemyId}`]),
    deliverable(enemyId, 'combat-unit', 'stats', 'stats', [`change:enemy:${enemyId}`]),
    deliverable(enemyId, 'combat-unit', 'growth', 'growth', [], { model: 'necromance-ally-stats', levelBand: 'chapter1' }),
    deliverable(enemyId, 'combat-unit', 'skill-set', 'skill_set', [`change:enemy:${enemyId}`], { skillIds: [skillId] }),
    deliverable(enemyId, 'skill-presentation', 'unit-lifecycle', 'unit_lifecycle', [`presentation:${enemyId}_presentation`]),
    deliverable(enemyId, 'acquisition-link', 'runtime', 'runtime', [], { stageId: 'area1_node3', enemyId, necromance: true }),
  );
  addAssetDeliverable(pkg, enemyId, `${enemyId}_battle`, 'battle-visual');
  addAssetDeliverable(pkg, enemyId, `${enemyId}_icon`, 'icon');
  pkg.presentation.push(presentation(enemyId, `${enemyId}_lifecycle`));
  pkg.localization.push(...localize(enemyId, nameJa, nameEn, true));
  pkg.evidence.push(evidence(enemyId, 'balance-simulation'));
}

function addSkill(pkg: ContentPackage, skillId: string, ownerId: string, nameJa: string, nameEn: string, effectKey: string): void {
  pkg.changes.push({ scope: 'skill', id: skillId, data: skillData(skillId, nameJa, effectKey) });
  pkg.deliverables.push(
    deliverable(skillId, 'skill', 'mechanics', 'mechanics', [`change:skill:${skillId}`]),
    deliverable(skillId, 'skill-presentation', 'timeline', 'timeline', [`presentation:${skillId}_presentation`]),
    deliverable(skillId, 'acquisition-link', 'owner', 'owner', [], { ownerId, skillId }),
  );
  addAssetDeliverable(pkg, skillId, `${skillId}_icon`, 'skill-icon');
  pkg.presentation.push(presentation(skillId, effectKey));
  pkg.localization.push(...localize(skillId, nameJa, nameEn, true));
  pkg.evidence.push(evidence(skillId, 'skill-balance'), evidence(skillId, 'presentation-preview'));
}

function makeControlledMonsterSample(): ProductionForwardSample {
  const enemyId = 'enemy_gravemark_sentinel';
  const skillId = 'skill_gravemark_cut';
  const pkg = basePackage('phase7_sample_controlled_monster', '墓標の番兵と冥約', [
    target(enemyId, 'combat-unit'),
    target(skillId, 'skill'),
  ]);
  addCombatUnit(pkg, enemyId, skillId, '墓標の番兵', 'Gravemark Sentinel');
  addSkill(pkg, skillId, enemyId, '墓標断ち', 'Gravemark Cut', 'dark_slash_gravemark');
  return {
    kind: 'CONTROLLED_MONSTER',
    package: pkg,
    runtimeChecks: [
      { label: '敵を冥約後の使役魔物として再利用できる', test: value => value.changes.some(change => change.id === enemyId && typeof change.data.necromance === 'object') },
      { label: '使役魔物のskillIdが実在する', test: value => value.changes.some(change => change.id === enemyId && JSON.stringify(change.data).includes(skillId)) && value.changes.some(change => change.id === skillId) },
    ],
  };
}

function weaponData(id: string) {
  return {
    id,
    name: '記銘剣エピタフ',
    type: 'WEAPON',
    rarity: 'SR',
    weaponRarity: 'SR',
    archetype: 'MID',
    rank: 1,
    ilv: 35,
    isUnique: true,
    stats: {},
    subOptions: [{ type: 'CRIT_DMG', value: 5 }],
    passiveA: { nameJa: '墓碑の追想', descTemplate: '行動値+{value}%', values: [4, 4.8, 5.6, 6.4, 8], systemTag: 'ACTION_VALUE' },
    passiveB: { nameJa: '銘を断つ刃', descTemplate: '霊的防壁へのダメージ+{value}%', values: [5, 6, 7, 8, 10], systemTag: 'SHIELD_PIERCE' },
    flavor: '刃へ刻まれた名は、持ち主が忘れても深淵の底で鈍く光る。',
  };
}

function makeWeaponSample(): ProductionForwardSample {
  const weaponId = 'weapon_epitaph_blade';
  const pkg = basePackage('phase7_sample_weapon', '記銘剣エピタフ', [target(weaponId, 'weapon')]);
  pkg.changes.push({ scope: 'weapon', id: weaponId, data: weaponData(weaponId) });
  addAssetDeliverable(pkg, weaponId, `${weaponId}_icon`, 'inventory-icon');
  addAssetDeliverable(pkg, weaponId, `${weaponId}_art`, 'detail-art');
  pkg.deliverables.push(
    deliverable(weaponId, 'acquisition-link', 'drop-source', 'drop_source', [], { stageId: 'area1_boss', itemId: weaponId, firstClear: true }),
    deliverable(weaponId, 'acquisition-link', 'inventory-equip', 'inventory_equip', [`change:weapon:${weaponId}`], { itemId: weaponId, slot: 'weapon' }),
  );
  pkg.localization.push(...localize(weaponId, '記銘剣エピタフ', 'Epitaph Blade'));
  pkg.evidence.push(evidence(weaponId, 'weapon-balance'));
  return {
    kind: 'WEAPON',
    package: pkg,
    runtimeChecks: [
      { label: '入手元が武器自身のitemIdへ接続される', test: value => value.deliverables.some(item => item.kind === 'drop-source' && item.artifact?.itemId === weaponId) },
      { label: '一覧用と詳細用の画像が揃う', test: value => ['inventory-icon', 'detail-art'].every(kind => value.assets.some(item => item.ownerId === weaponId && item.kind === kind)) },
    ],
  };
}

function bossStageData(stageId: string, bossId: string, weaponId: string) {
  return {
    id: stageId,
    name: '鐘墓・最後の銘',
    nameJa: '鐘墓・最後の銘',
    nameEn: 'Bell Grave: The Final Name',
    chapter: 1,
    chapterName: '亡国の王都',
    area: 1,
    nodeType: 'BOSS',
    element: 'DARK',
    difficulty: 5,
    description: '王都の名を鐘へ封じた墓守との決戦。',
    waveCount: 1,
    waves: [{ label: '最後の弔鐘', intent: '形状手掛かりを読み、単発大技へ備える。', role: 'BOSS', enemyIds: [bossId] }],
    unlockRequires: ['area1_boss'],
    rewards: {
      baseExp: 120,
      baseGold: 80,
      dropTable: [
        { type: 'WEAPON', itemId: weaponId, rate: 1, minQuantity: 1, maxQuantity: 1 },
        { type: 'MATERIAL', itemId: 'grave_crystal', rate: 0.35, minQuantity: 1, maxQuantity: 2 },
      ],
    },
    position: { x: 720, y: 180 },
  };
}

function makeBossSample(): ProductionForwardSample {
  const bossId = 'enemy_bell_grave_lord';
  const skillId = 'skill_final_epitaph';
  const stageId = 'stage_bell_grave_finale';
  const weaponId = 'bone_cleaver';
  const pkg = basePackage('phase7_sample_boss', '鐘墓の主・最終遭遇', [
    target(bossId, 'combat-unit'),
    target(skillId, 'skill'),
    target(stageId, 'encounter'),
  ]);
  addCombatUnit(pkg, bossId, skillId, '鐘墓の主オルドラン', 'Oldran, Lord of the Bell Grave');
  const enemyChange = pkg.changes.find(change => change.id === bossId)!;
  enemyChange.data = enemyData(bossId, skillId, 'BOSS');
  addSkill(pkg, skillId, bossId, '終銘の葬鐘', 'Final Epitaph', 'dark_slash_final_epitaph');
  pkg.changes.push({ scope: 'stage', id: stageId, data: bossStageData(stageId, bossId, weaponId) });
  pkg.deliverables.push(
    deliverable(stageId, 'combat-unit', 'enemy-data', 'enemy_data', [`change:stage:${stageId}`], { enemyId: bossId }),
    deliverable(stageId, 'acquisition-link', 'stage-wave', 'stage_wave', [`change:stage:${stageId}`], { stageId, enemyId: bossId }),
    deliverable(stageId, 'acquisition-link', 'reward', 'reward', [], { stageId, itemId: weaponId, materialId: 'grave_crystal' }),
    deliverable(stageId, 'acquisition-link', 'story-trigger', 'story_trigger', [], { stageId, beforeBattle: 'CH1_BELL_GRAVE_OATH', afterBattle: 'CH1_BELL_GRAVE_REST' }),
  );
  addAssetDeliverable(pkg, stageId, `${stageId}_background`, 'background');
  addAssetDeliverable(pkg, stageId, `${stageId}_enemy`, 'enemy-visual');
  pkg.localization.push(...localize(stageId, '鐘墓・最後の銘', 'Bell Grave: The Final Name'));
  pkg.evidence.push(evidence(stageId, 'combat-simulation'), evidence(stageId, 'clear-flow'));
  return {
    kind: 'BOSS',
    package: pkg,
    runtimeChecks: [
      { label: 'BOSS WAVEがボスenemyへ接続される', test: value => value.changes.some(change => change.id === stageId && JSON.stringify(change.data.waves).includes(bossId)) },
      { label: '背景・VFX/SFX・報酬が同一packageに揃う', test: value => value.assets.some(item => item.kind === 'background') && value.presentation.some(item => item.ownerId === skillId && (item.sfx?.cues.length ?? 0) > 0) && value.deliverables.some(item => item.ownerId === stageId && item.kind === 'reward') },
    ],
  };
}

export function createProductionForwardSamples(): ProductionForwardSample[] {
  return [makeStorySample(), makeControlledMonsterSample(), makeWeaponSample(), makeBossSample()];
}

export function productionSampleAssetFiles(pkg: ContentPackage): Record<string, { exists: true; bytes: number; sha256: string }> {
  return Object.fromEntries(pkg.assets.map(item => [item.sourcePath!, { exists: true as const, bytes: item.bytes!, sha256: item.contentHash! }]));
}
