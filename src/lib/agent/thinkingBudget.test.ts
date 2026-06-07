import {
  estimateBaseThinkingBudget,
  thinkingBudgetForAttempt,
  MAX_THINKING_BUDGET,
} from './thinkingBudget';

describe('estimateBaseThinkingBudget', () => {
  it('gives the cheapest budget to a trivial requirement', () => {
    expect(estimateBaseThinkingBudget('弱い敵')).toBe(512);
  });

  it('bumps a single-constraint requirement to 1024', () => {
    // 属性1つ + 読点1つ程度 → score 1
    expect(estimateBaseThinkingBudget('火に弱い敵')).toBe(1024);
  });

  it('raises budget for multi-constraint requirements', () => {
    const b = estimateBaseThinkingBudget('素早いBEASTで、火に弱く、毒を撒く。');
    expect(b).toBeGreaterThanOrEqual(1024);
  });

  it('gives the highest budget to BOSS + gimmick + multi-element', () => {
    const hard =
      'BOSSで蘇生ギミックを持ち、氷と光に弱く雷を吸収する。ICE編成を罰しつつ、攻撃的プレイを報いるフェーズ制。';
    expect(estimateBaseThinkingBudget(hard)).toBe(4096);
  });

  it('ranks harder requirements >= simpler ones', () => {
    const simple = estimateBaseThinkingBudget('素早い狐');
    const hard = estimateBaseThinkingBudget(
      'BOSS。蘇生し、氷・光・雷の3属性に反応する複合ギミック。',
    );
    expect(hard).toBeGreaterThan(simple);
  });
});

describe('thinkingBudgetForAttempt', () => {
  it('escalates with retries (x1, x2, x4)', () => {
    const req = '火に弱い敵'; // base 1024
    expect(thinkingBudgetForAttempt(req, 1)).toBe(1024);
    expect(thinkingBudgetForAttempt(req, 2)).toBe(2048);
    expect(thinkingBudgetForAttempt(req, 3)).toBe(4096);
  });

  it('caps at MAX_THINKING_BUDGET', () => {
    const hard = 'BOSS 蘇生 召喚 氷 光 闇 雷、反射、吸収、フェーズ。'; // base 4096
    expect(thinkingBudgetForAttempt(hard, 3)).toBe(MAX_THINKING_BUDGET);
    expect(thinkingBudgetForAttempt(hard, 5)).toBe(MAX_THINKING_BUDGET);
  });

  it('treats attempt < 1 as base', () => {
    expect(thinkingBudgetForAttempt('弱い敵', 0)).toBe(512);
  });
});
