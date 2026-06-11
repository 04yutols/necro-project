export type EntryIdValidation =
  | { ok: true; id: string }
  | { ok: false; error: string };

const ENTRY_ID_PATTERN = /^[a-z0-9_][a-z0-9_-]*$/;
const RESERVED_ENTRY_IDS = new Set(['__proto__', 'prototype', 'constructor']);

export function validateEntryId(value: string, label = 'ID'): EntryIdValidation {
  const id = value.trim();
  if (!id) {
    return { ok: false, error: `${label}を入力してください` };
  }
  if (!ENTRY_ID_PATTERN.test(id)) {
    return { ok: false, error: `${label}は半角英数字・_・- で入力してください` };
  }
  if (RESERVED_ENTRY_IDS.has(id)) {
    return { ok: false, error: `${label}に予約語は使用できません` };
  }
  return { ok: true, id };
}
