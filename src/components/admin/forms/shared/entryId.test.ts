import { validateEntryId } from './entryId';

describe('validateEntryId', () => {
  test('trims and accepts safe master data ids', () => {
    expect(validateEntryId('  area1_boss  ')).toEqual({ ok: true, id: 'area1_boss' });
    expect(validateEntryId('skill-dark-priest')).toEqual({ ok: true, id: 'skill-dark-priest' });
  });

  test('rejects empty ids before they become empty JSON keys', () => {
    expect(validateEntryId('')).toEqual({ ok: false, error: 'IDを入力してください' });
    expect(validateEntryId('   ', 'エネミーID')).toEqual({ ok: false, error: 'エネミーIDを入力してください' });
  });

  test('rejects unsafe prototype/path-like ids', () => {
    expect(validateEntryId('__proto__')).toEqual({ ok: false, error: 'IDに予約語は使用できません' });
    expect(validateEntryId('constructor')).toEqual({ ok: false, error: 'IDに予約語は使用できません' });
    expect(validateEntryId('../bad').ok).toBe(false);
    expect(validateEntryId('敵01').ok).toBe(false);
  });
});
