import { checkRecommendation, checkRecommendations, type RecCheckContext } from './recommendationCheck';

// PHYS_SINGLE 低コスト(4-8) Tier1 power 帯 = 1.20〜1.55（設計書19）
const SKILL_CTX: RecCheckContext = {
  skill: { type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6, tier: 1 },
};

const ENEMY_CTX: RecCheckContext = {
  enemy: {
    tier: 'MINION',
    existingEnemies: {
      a: { tier: 'MINION', stats: { hp: 14, atk: 5, def: 2, spd: 110 } },
      b: { tier: 'MINION', stats: { hp: 50, atk: 8, def: 5, spd: 80 } },
    },
  },
};

describe('checkRecommendation - skill.power (doc19 POWER_TABLE)', () => {
  it('in-band power passes', () => {
    const r = checkRecommendation({ target: 'skill.power', current: 2.0, suggested: 1.35 }, SKILL_CTX);
    expect(r.inBand).toBe(true);
    expect(r.band).toEqual([1.2, 1.55]);
  });

  it('above-band power is flagged', () => {
    const r = checkRecommendation({ target: 'skill.power', current: 2.0, suggested: 1.9 }, SKILL_CTX);
    expect(r.inBand).toBe(false);
    expect(r.note).toContain('範囲外');
  });

  it('uses Tier2 band when tier=2', () => {
    const ctx: RecCheckContext = { skill: { type: 'PHYSICAL', targetType: 'SINGLE', mpCost: 6, tier: 2 } };
    const r = checkRecommendation({ target: 'skill.power', current: 2.0, suggested: 1.75 }, ctx);
    expect(r.band).toEqual([1.4, 1.8]); // Tier2 低コスト帯
    expect(r.inBand).toBe(true);
  });

  it('returns N/A (inBand true) when classification is unknown', () => {
    const ctx: RecCheckContext = { skill: { type: 'WEIRD', targetType: 'SINGLE', mpCost: 6, tier: 1 } };
    const r = checkRecommendation({ target: 'skill.power', current: 2, suggested: 9 }, ctx);
    expect(r.band).toBeNull();
    expect(r.inBand).toBe(true); // 判定不可は阻害しない
  });
});

describe('checkRecommendation - skill.mpCost', () => {
  it('magic min cost is 8', () => {
    const ctx: RecCheckContext = { skill: { type: 'MAGICAL', targetType: 'SINGLE', mpCost: 12, tier: 1 } };
    const below = checkRecommendation({ target: 'skill.mpCost', current: 12, suggested: 5 }, ctx);
    expect(below.inBand).toBe(false);
    const ok = checkRecommendation({ target: 'skill.mpCost', current: 12, suggested: 14 }, ctx);
    expect(ok.inBand).toBe(true);
  });
});

describe('checkRecommendation - enemy.hp / enemy.def (tier band)', () => {
  it('in-band MINION hp passes', () => {
    const r = checkRecommendation({ target: 'enemy.hp', current: 14, suggested: 40 }, ENEMY_CTX);
    expect(r.inBand).toBe(true); // 14〜50 帯 + 許容
  });

  it('far above MINION hp band is flagged', () => {
    const r = checkRecommendation({ target: 'enemy.hp', current: 14, suggested: 500 }, ENEMY_CTX);
    expect(r.inBand).toBe(false);
  });

  it('N/A when no enemy context', () => {
    const r = checkRecommendation({ target: 'enemy.def', current: 5, suggested: 8 }, {});
    expect(r.band).toBeNull();
    expect(r.inBand).toBe(true);
  });
});

describe('checkRecommendations (batch)', () => {
  it('maps multiple recommendations', () => {
    const res = checkRecommendations(
      [
        { target: 'skill.power', current: 2.0, suggested: 1.35 },
        { target: 'skill.power', current: 2.0, suggested: 9.0 },
      ],
      SKILL_CTX,
    );
    expect(res[0].inBand).toBe(true);
    expect(res[1].inBand).toBe(false);
  });
});
