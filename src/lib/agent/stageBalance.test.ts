import {
  validateStageDraft,
  deriveRewardBands,
  areaIdFor,
  stageFindingsToFeedback,
  type StageBalanceContext,
} from './stageBalance';

const EXISTING_STAGES: Record<string, unknown> = {
  area1_node1: { chapter: 1, area: 1, nodeType: 'DUNGEON', element: 'DARK', difficulty: 1, rewards: { baseExp: 12, baseGold: 1180 } },
  area1_boss: { chapter: 1, area: 1, nodeType: 'BOSS', element: 'DARK', difficulty: 3, rewards: { baseExp: 30, baseGold: 2400 } },
};

const CTX: StageBalanceContext = {
  existingStages: EXISTING_STAGES,
  stageIds: new Set(Object.keys(EXISTING_STAGES)),
  enemyIds: new Set(['grave_soldier', 'abyss_warden', 'grave_knight', 'ossuary_wyrm_lord']),
  enemyTiers: { grave_soldier: 'MINION', abyss_warden: 'ELITE', grave_knight: 'ELITE', ossuary_wyrm_lord: 'BOSS' },
  itemIds: new Set(['bone_cleaver', 'underworld_potion']),
  materialIds: new Set(['bone_chip']),
  areaIds: new Set(['ch1_area1', 'ch1_area2']),
};

function validStage(): Record<string, unknown> {
  return {
    id: 'area1_node5',
    name: 'Crypt Path',
    nameJa: '地下聖堂への道',
    nameEn: 'CRYPT PATH',
    chapter: 1,
    chapterName: '亡国の王都',
    area: 1,
    nodeType: 'DUNGEON',
    element: 'DARK',
    difficulty: 2,
    description: '地下聖堂へ続く道。',
    waveCount: 2,
    areaGimmick: 'NONE',
    unlockRequires: ['area1_node1'],
    waves: [
      { label: 'WAVE 1', role: 'WARMUP', enemyIds: ['grave_soldier'], intent: '露払い。' },
      { label: 'WAVE 2', role: 'ELITE', enemyIds: ['abyss_warden', 'grave_knight'], intent: '精鋭戦。' },
    ],
    rewards: {
      baseExp: 18,
      baseGold: 1500,
      dropTable: [
        { type: 'WEAPON', itemId: 'bone_cleaver', rarity: 'R', rate: 0.5 },
        { type: 'CONSUMABLE', itemId: 'underworld_potion', quantity: 1, rate: 0.8 },
      ],
    },
    position: { x: 200, y: 300 },
  };
}

describe('areaIdFor / deriveRewardBands', () => {
  it('builds area id', () => {
    expect(areaIdFor(1, 2)).toBe('ch1_area2');
  });
  it('learns reward bands from existing stages', () => {
    const b = deriveRewardBands(EXISTING_STAGES);
    expect(b.exp).toEqual({ min: 12, max: 30 });
    expect(b.gold).toEqual({ min: 1180, max: 2400 });
  });
});

describe('validateStageDraft - valid', () => {
  it('passes a well-formed stage', () => {
    const res = validateStageDraft(validStage(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateStageDraft - references', () => {
  it('FAILs when an enemy in a wave does not exist', () => {
    const d = validStage();
    (d.waves as { enemyIds: string[] }[])[0].enemyIds = ['ghost_x'];
    const res = validateStageDraft(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.message.includes('ghost_x'))).toBe(true);
  });

  it('FAILs when unlockRequires points to a non-existent stage', () => {
    const d = validStage();
    d.unlockRequires = ['area9_node9'];
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on self-referential unlockRequires', () => {
    const d = validStage();
    d.unlockRequires = ['area1_node5'];
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when the area (chapter+area) does not exist', () => {
    const d = validStage();
    d.area = 9;
    const res = validateStageDraft(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.message.includes('ch1_area9'))).toBe(true);
  });

  it('FAILs when a dropTable weapon does not exist', () => {
    const d = validStage();
    (d.rewards as { dropTable: unknown[] }).dropTable = [{ type: 'WEAPON', itemId: 'mythic_blade', rate: 0.1 }];
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });
});

describe('validateStageDraft - structure & rules', () => {
  it('FAILs when waveCount mismatches waves length', () => {
    const d = validStage();
    d.waveCount = 5;
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when a battle node has no waves', () => {
    const d = validStage();
    d.waves = [];
    d.waveCount = 0;
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid nodeType / wave role', () => {
    const d = validStage();
    d.nodeType = 'TOWN';
    expect(validateStageDraft(d, CTX).ok).toBe(false);
    const d2 = validStage();
    (d2.waves as { role: string }[])[0].role = 'INTRO';
    expect(validateStageDraft(d2, CTX).ok).toBe(false);
  });

  it('WARNs when a BOSS node has no BOSS-tier enemy', () => {
    const d = validStage();
    d.nodeType = 'BOSS';
    // waves contain only MINION/ELITE
    const res = validateStageDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'waves' && f.level === 'WARN')).toBe(true);
  });

  it('does not warn BOSS node when a BOSS-tier enemy is present', () => {
    const d = validStage();
    d.nodeType = 'BOSS';
    (d.waves as { enemyIds: string[] }[])[1].enemyIds = ['ossuary_wyrm_lord'];
    const res = validateStageDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'waves' && f.level === 'WARN' && /BOSS/.test(f.message))).toBe(false);
  });

  it('FAILs on rate out of 0-1 range', () => {
    const d = validStage();
    (d.rewards as { dropTable: { rate: number }[] }).dropTable[0].rate = 5;
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid id format', () => {
    const d = validStage();
    d.id = 'Area1-Node5';
    expect(validateStageDraft(d, CTX).ok).toBe(false);
  });
});

describe('stageFindingsToFeedback', () => {
  it('formats only non-PASS findings', () => {
    const d = validStage();
    d.waveCount = 99;
    const fb = stageFindingsToFeedback(validateStageDraft(d, CTX).findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).not.toContain('[PASS]');
  });
});
