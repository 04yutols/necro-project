/**
 * R-6: gimmick.value 入出力正規化のユニットテスト。
 * 「フォームで触ると number が string で保存される」回帰を防ぐ。
 */
import { gimmickValueToInput, gimmickRowsToJson } from './gimmickValue';

describe('gimmickValueToInput', () => {
  it('converts number to string for the input field', () => {
    expect(gimmickValueToInput(1)).toBe('1');
    expect(gimmickValueToInput(0.5)).toBe('0.5');
    expect(gimmickValueToInput(0)).toBe('0');
  });

  it('keeps strings as-is and maps null/undefined to empty', () => {
    expect(gimmickValueToInput('2')).toBe('2');
    expect(gimmickValueToInput(undefined)).toBe('');
    expect(gimmickValueToInput(null)).toBe('');
  });

  it('maps non-finite numbers to empty', () => {
    expect(gimmickValueToInput(NaN)).toBe('');
    expect(gimmickValueToInput(Infinity)).toBe('');
  });
});

describe('gimmickRowsToJson', () => {
  const row = (value: string) => ({ trigger: 'HP_BELOW_50', effect: 'REVIVE', value });

  it('normalizes numeric strings to numbers', () => {
    expect(gimmickRowsToJson([row('1')])[0].value).toBe(1);
    expect(gimmickRowsToJson([row('0.5')])[0].value).toBe(0.5);
    expect(gimmickRowsToJson([row(' 2 ')])[0].value).toBe(2);
  });

  it('omits value for empty input (BossGimmick.value is optional)', () => {
    const out = gimmickRowsToJson([row('')])[0];
    expect('value' in out).toBe(false);
    expect(out).toEqual({ trigger: 'HP_BELOW_50', effect: 'REVIVE' });
  });

  it('keeps non-numeric strings to avoid silent data loss', () => {
    expect(gimmickRowsToJson([row('abc')])[0].value).toBe('abc');
  });

  it('does not coerce Infinity/NaN strings to numbers', () => {
    expect(gimmickRowsToJson([row('Infinity')])[0].value).toBe('Infinity');
    expect(gimmickRowsToJson([row('NaN')])[0].value).toBe('NaN');
  });

  it('round-trips master data: number → input → number', () => {
    const input = gimmickValueToInput(2);
    expect(gimmickRowsToJson([row(input)])[0].value).toBe(2);
  });
});
