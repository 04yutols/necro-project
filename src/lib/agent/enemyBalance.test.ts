import {
  validateEnemyDraft,
  deriveTierBands,
  findingsToFeedback,
  type EnemyBalanceContext,
} from './enemyBalance';

// 既存エネミーの最小サンプル（tier 帯学習・参照検証用）
const EXISTING_ENEMIES: Record<string, unknown> = {
  grave_soldier: { tier: 'MINION', tribe: 'UNDEAD', stats: { hp: 15, atk: 4, def: 3, spd: 70 } },
  rot_hound: { tier: 'MINION', tribe: 'BEAST', stats: { hp: 14, atk: 5, def: 2, spd: 110 } },
  bone_colossus: { tier: 'ELITE', tribe: 'UNDEAD', stats: { hp: 72, atk: 9, def: 9, spd: 68 } },
  abyss_warden: { tier: 'ELITE', tribe: 'UNDEAD', stats: { hp: 36, atk: 5, def: 5, spd: 75 } },
};

const CTX: EnemyBalanceContext = {
  existingEnemies: EXISTING_ENEMIES,
  itemIds: new Set(['bone_cleaver', 'mourning_bell_crozier']),
  materialIds: new Set(['grave_crystal', 'bone_chip']),
  skillIds: new Set(['skill_darkpriest_1', 'skill_necromancer_1']),
};

function validDraft(): Record<string, unknown> {
  return {
    id: 'frost_wraith',
    name: 'Frost Wraith',
    nameJa: '氷霊',
    nameEn: 'FROST WRAITH',
    tier: 'ELITE',
    tribe: 'UNDEAD',
    stats: { hp: 55, atk: 7, def: 9, spd: 60, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 10 },
    resistances: { ICE: -30, FIRE: 20 },
    weaknesses: ['ICE'],
    dropTable: [
      { type: 'MATERIAL', itemId: 'grave_crystal', rarity: 'COMMON', rate: 0.8 },
      { type: 'WEAPON', itemId: 'bone_cleaver', rarity: 'R', rate: 0.1 },
    ],
    battle: { color: '#66CCFF', sprite: 'WRAITH', size: 0.8 },
    description: '氷に弱いエリート。',
    necromance: {
      captureRate: 0.05,
      allyCost: 4,
      allyStats: { hp: 50, atk: 6, def: 8, spd: 55, critRate: 5, critDmg: 150, effectHit: 0, effectRes: 10 },
      skillIds: ['skill_darkpriest_1'],
    },
  };
}

describe('deriveTierBands', () => {
  it('learns min/max per tier from existing data', () => {
    const bands = deriveTierBands(EXISTING_ENEMIES);
    expect(bands.MINION.hp).toEqual({ min: 14, max: 15, count: 2 });
    expect(bands.ELITE.hp).toEqual({ min: 36, max: 72, count: 2 });
    expect(bands.MINION.spd.max).toBe(110);
  });
});

describe('validateEnemyDraft - valid', () => {
  it('passes a well-formed draft', () => {
    const res = validateEnemyDraft(validDraft(), CTX);
    expect(res.ok).toBe(true);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
  });
});

describe('validateEnemyDraft - scale errors (the core gate)', () => {
  it('FAILs when critDmg uses 0-1 fraction scale', () => {
    const d = validDraft();
    (d.stats as Record<string, number>).critDmg = 1.5;
    const res = validateEnemyDraft(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'stats.critDmg' && f.level === 'FAIL')).toBe(true);
  });

  it('WARNs when resistances use 0-1 fraction scale', () => {
    const d = validDraft();
    d.resistances = { ICE: -0.5, FIRE: 0.2 };
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'resistances' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when critRate uses fraction scale', () => {
    const d = validDraft();
    (d.stats as Record<string, number>).critRate = 0.05;
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'stats.critRate' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateEnemyDraft - structure & references', () => {
  it('FAILs on invalid tier', () => {
    const d = validDraft();
    d.tier = 'LEGEND';
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid tribe', () => {
    const d = validDraft();
    d.tribe = 'ALIEN';
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on non-snake_case id', () => {
    const d = validDraft();
    d.id = 'Frost-Wraith';
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when dropTable references a non-existent weapon', () => {
    const d = validDraft();
    d.dropTable = [{ type: 'WEAPON', itemId: 'ghost_sword', rarity: 'R', rate: 0.1 }];
    const res = validateEnemyDraft(d, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.message.includes('ghost_sword'))).toBe(true);
  });

  it('FAILs when dropTable rate is out of 0-1 range', () => {
    const d = validDraft();
    d.dropTable = [{ type: 'MATERIAL', itemId: 'grave_crystal', rarity: 'COMMON', rate: 80 }];
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when necromance.skillIds references unknown skill', () => {
    const d = validDraft();
    (d.necromance as Record<string, unknown>).skillIds = ['skill_unknown'];
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when a weakness has no matching negative resistance', () => {
    const d = validDraft();
    d.weaknesses = ['LIGHT'];
    d.resistances = { ICE: -30 };
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'weaknesses' && f.level === 'WARN')).toBe(true);
  });

  it('WARNs when stats fall outside the learned tier band', () => {
    const d = validDraft();
    (d.stats as Record<string, number>).hp = 5000; // ELITE 帯を大きく超過
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'stats.hp' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateEnemyDraft - gimmicks & shield', () => {
  function bossWithGimmicks(gimmicks: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { ...validDraft(), tier: 'BOSS', gimmicks, ...extra };
  }

  it('passes valid ENRAGE + REVIVE gimmicks', () => {
    const d = bossWithGimmicks([
      { trigger: 'HP_BELOW_50', effect: 'ENRAGE', value: 1 },
      { trigger: 'HP_BELOW_50', effect: 'REVIVE', value: 1 },
    ]);
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.filter((f) => f.level === 'FAIL')).toHaveLength(0);
    expect(res.findings.some((f) => f.message.includes('HP_BELOW_50→ENRAGE'))).toBe(true);
  });

  it('FAILs on invalid trigger enum', () => {
    const d = bossWithGimmicks([{ trigger: 'HP_BELOW_25', effect: 'ENRAGE', value: 1 }]);
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs on invalid effect enum', () => {
    const d = bossWithGimmicks([{ trigger: 'TURN_3', effect: 'HEAL_ALL', value: 1 }]);
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('FAILs when gimmick value is missing/non-number', () => {
    const d = bossWithGimmicks([{ trigger: 'TURN_3', effect: 'AV_DELAY' }]);
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when REVIVE is not on HP_BELOW_50', () => {
    const d = bossWithGimmicks([{ trigger: 'TURN_3', effect: 'REVIVE', value: 1 }]);
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.level === 'WARN' && /REVIVE/.test(f.message))).toBe(true);
  });

  it('WARNs when ON_SHIELD_BREAK is used without a shield', () => {
    const d = bossWithGimmicks([{ trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 }]);
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.level === 'WARN' && /ON_SHIELD_BREAK/.test(f.message))).toBe(true);
  });

  it('does not warn ON_SHIELD_BREAK when a shield is present', () => {
    const d = bossWithGimmicks(
      [{ trigger: 'ON_SHIELD_BREAK', effect: 'SUMMON_MINIONS', value: 2 }],
      { shieldHp: 48, maxShieldHp: 48 },
    );
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.level === 'WARN' && /ON_SHIELD_BREAK/.test(f.message))).toBe(false);
  });

  it('WARNs when MINION has gimmicks', () => {
    const d = { ...validDraft(), tier: 'MINION', stats: { ...(validDraft().stats as object), hp: 15, atk: 4, def: 3, spd: 70 }, gimmicks: [{ trigger: 'TURN_3', effect: 'AV_DELAY', value: 40 }] };
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'gimmicks' && f.level === 'WARN')).toBe(true);
  });

  it('FAILs on negative shieldHp', () => {
    const d = { ...validDraft(), shieldHp: -5 };
    expect(validateEnemyDraft(d, CTX).ok).toBe(false);
  });

  it('WARNs when shieldHp is set without maxShieldHp', () => {
    const d = { ...validDraft(), shieldHp: 20 };
    const res = validateEnemyDraft(d, CTX);
    expect(res.findings.some((f) => f.field === 'maxShieldHp' && f.level === 'WARN')).toBe(true);
  });
});

describe('validateEnemyDraft - missing fields', () => {
  it('FAILs when required string fields are missing', () => {
    const res = validateEnemyDraft({ tier: 'MINION', tribe: 'UNDEAD' }, CTX);
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.field === 'id')).toBe(true);
    expect(res.findings.some((f) => f.field === 'necromance')).toBe(true);
  });

  it('FAILs when root is not an object', () => {
    expect(validateEnemyDraft('not an object', CTX).ok).toBe(false);
    expect(validateEnemyDraft(null, CTX).ok).toBe(false);
  });
});

describe('findingsToFeedback', () => {
  it('formats only non-PASS findings for LLM feedback', () => {
    const d = validDraft();
    (d.stats as Record<string, number>).critDmg = 1.5;
    const res = validateEnemyDraft(d, CTX);
    const fb = findingsToFeedback(res.findings);
    expect(fb).toContain('[FAIL]');
    expect(fb).toContain('critDmg');
    expect(fb).not.toContain('[PASS]');
  });
});
