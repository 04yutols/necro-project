import { coerceEvaluation } from './simEvalAgent';

describe('coerceEvaluation', () => {
  it('keeps valid verdicts and filters invalid recommendations', () => {
    const evaluation = coerceEvaluation({
      verdict: 'TOO_WEAK',
      rationale: '火力不足',
      recommendations: [
        { target: 'skill.power', current: 1.0, suggested: 1.25, reason: '上げる' },
        { target: 'skill.unknown', current: 1.0, suggested: 2.0 },
      ],
    });

    expect(evaluation?.verdict).toBe('TOO_WEAK');
    expect(evaluation?.recommendations).toHaveLength(1);
  });

  it('rejects unknown verdicts instead of silently treating them as balanced', () => {
    expect(coerceEvaluation({
      verdict: 'PERFECT',
      rationale: 'unknown',
      recommendations: [],
    })).toBeNull();
  });
});
