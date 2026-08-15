export const LORE_ENTRY_KINDS = ['CHARACTER', 'PLACE', 'FACTION', 'EVENT', 'ARTIFACT', 'CONCEPT'] as const;
export const LORE_CERTAINTIES = ['CONFIRMED', 'PROVISIONAL', 'REJECTED'] as const;

export type LoreEntryKind = (typeof LORE_ENTRY_KINDS)[number];
export type LoreCertainty = (typeof LORE_CERTAINTIES)[number];

export type LoreEntry = {
  id: string;
  kind: LoreEntryKind;
  certainty: LoreCertainty;
  nameJa: string;
  nameEn?: string;
  aliases: string[];
  summary: string;
  chapterIntroduced: number;
  sourceRefs: string[];
  tags: string[];
};

export type LoreRelationship = {
  id: string;
  from: string;
  to: string;
  type: string;
  certainty: LoreCertainty;
  summary: string;
  sourceRefs: string[];
};

export type LoreTimelineEvent = {
  id: string;
  order: number;
  chapter: number;
  title: string;
  summary: string;
  participantRefs: string[];
  locationRef?: string;
  certainty: LoreCertainty;
  sourceRefs: string[];
};

export type LoreRegistry = {
  schemaVersion: 1;
  updatedAt: string;
  entries: LoreEntry[];
  relationships: LoreRelationship[];
  timeline: LoreTimelineEvent[];
};

export type LoreFinding = {
  level: 'PASS' | 'WARN' | 'FAIL';
  scope: 'lore-registry';
  id: string;
  field: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(isNonEmptyString);
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function validId(value: unknown): value is string {
  return isNonEmptyString(value) && /^[a-z][a-z0-9_]*$/.test(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  return Object.keys(value).filter(key => !allowedSet.has(key));
}

export function validateLoreRegistry(value: unknown): LoreFinding[] {
  const findings: LoreFinding[] = [];
  const add = (level: LoreFinding['level'], id: string, field: string, message: string) =>
    findings.push({ level, scope: 'lore-registry', id, field, message });

  if (!isRecord(value)) {
    return [{ level: 'FAIL', scope: 'lore-registry', id: '?', field: 'root', message: 'Lore Registry はオブジェクトである必要があります。' }];
  }

  for (const key of unknownKeys(value, ['schemaVersion', 'updatedAt', 'entries', 'relationships', 'timeline'])) add('FAIL', 'registry', key, `未定義フィールドです: ${key}`);

  if (value.schemaVersion !== 1) add('FAIL', 'registry', 'schemaVersion', 'schemaVersion は 1 である必要があります。');
  if (!isIsoDate(value.updatedAt)) add('FAIL', 'registry', 'updatedAt', 'updatedAt はISO日時で指定してください。');
  if (!Array.isArray(value.entries)) add('FAIL', 'registry', 'entries', 'entries は配列である必要があります。');
  if (!Array.isArray(value.relationships)) add('FAIL', 'registry', 'relationships', 'relationships は配列である必要があります。');
  if (!Array.isArray(value.timeline)) add('FAIL', 'registry', 'timeline', 'timeline は配列である必要があります。');
  if (!Array.isArray(value.entries) || !Array.isArray(value.relationships) || !Array.isArray(value.timeline)) return findings;

  const entryIds = new Set<string>();
  for (const raw of value.entries) {
    if (!isRecord(raw)) {
      add('FAIL', '?', 'entries', '各entryはオブジェクトである必要があります。');
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '?';
    for (const key of unknownKeys(raw, ['id', 'kind', 'certainty', 'nameJa', 'nameEn', 'aliases', 'summary', 'chapterIntroduced', 'sourceRefs', 'tags'])) add('FAIL', id, key, `未定義フィールドです: ${key}`);
    if (!validId(raw.id)) add('FAIL', id, 'id', 'entry id は snake_case で指定してください。');
    if (entryIds.has(id)) add('FAIL', id, 'id', 'entry id が重複しています。');
    entryIds.add(id);
    if (!(LORE_ENTRY_KINDS as readonly unknown[]).includes(raw.kind)) add('FAIL', id, 'kind', '未対応のlore kindです。');
    if (!(LORE_CERTAINTIES as readonly unknown[]).includes(raw.certainty)) add('FAIL', id, 'certainty', '未対応のcertaintyです。');
    if (!isNonEmptyString(raw.nameJa)) add('FAIL', id, 'nameJa', 'nameJa は非空文字列である必要があります。');
    if (raw.nameEn !== undefined && !isNonEmptyString(raw.nameEn)) add('FAIL', id, 'nameEn', 'nameEn は省略するか非空文字列にしてください。');
    if (!Array.isArray(raw.aliases) || !raw.aliases.every(item => typeof item === 'string')) add('FAIL', id, 'aliases', 'aliases は文字列配列である必要があります。');
    if (!isNonEmptyString(raw.summary)) add('FAIL', id, 'summary', 'summary は非空文字列である必要があります。');
    if (!Number.isInteger(raw.chapterIntroduced) || Number(raw.chapterIntroduced) < 0) add('FAIL', id, 'chapterIntroduced', 'chapterIntroduced は0以上の整数である必要があります。');
    if (Number(raw.chapterIntroduced) > 1) add('WARN', id, 'chapterIntroduced', '第2章以降の確定設定は現在のリリース範囲外です。');
    if (!isStringArray(raw.sourceRefs, false)) add('FAIL', id, 'sourceRefs', 'sourceRefs は1件以上の非空文字列配列である必要があります。');
    if (!isStringArray(raw.tags, false)) add('FAIL', id, 'tags', 'tags は1件以上の非空文字列配列である必要があります。');
  }

  const relationshipIds = new Set<string>();
  for (const raw of value.relationships) {
    if (!isRecord(raw)) {
      add('FAIL', '?', 'relationships', '各relationshipはオブジェクトである必要があります。');
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '?';
    for (const key of unknownKeys(raw, ['id', 'from', 'to', 'type', 'certainty', 'summary', 'sourceRefs'])) add('FAIL', id, key, `未定義フィールドです: ${key}`);
    if (!validId(raw.id)) add('FAIL', id, 'id', 'relationship id は snake_case で指定してください。');
    if (relationshipIds.has(id)) add('FAIL', id, 'id', 'relationship id が重複しています。');
    relationshipIds.add(id);
    if (!isNonEmptyString(raw.from) || !entryIds.has(String(raw.from))) add('FAIL', id, 'from', `参照先entryが存在しません: ${String(raw.from)}`);
    if (!isNonEmptyString(raw.to) || !entryIds.has(String(raw.to))) add('FAIL', id, 'to', `参照先entryが存在しません: ${String(raw.to)}`);
    if (!isNonEmptyString(raw.type)) add('FAIL', id, 'type', 'type は非空文字列である必要があります。');
    if (!(LORE_CERTAINTIES as readonly unknown[]).includes(raw.certainty)) add('FAIL', id, 'certainty', '未対応のcertaintyです。');
    if (!isNonEmptyString(raw.summary)) add('FAIL', id, 'summary', 'summary は非空文字列である必要があります。');
    if (!isStringArray(raw.sourceRefs, false)) add('FAIL', id, 'sourceRefs', 'sourceRefs は1件以上必要です。');
  }

  const timelineIds = new Set<string>();
  for (const raw of value.timeline) {
    if (!isRecord(raw)) {
      add('FAIL', '?', 'timeline', '各timeline eventはオブジェクトである必要があります。');
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : '?';
    for (const key of unknownKeys(raw, ['id', 'order', 'chapter', 'title', 'summary', 'participantRefs', 'locationRef', 'certainty', 'sourceRefs'])) add('FAIL', id, key, `未定義フィールドです: ${key}`);
    if (!validId(raw.id)) add('FAIL', id, 'id', 'timeline id は snake_case で指定してください。');
    if (timelineIds.has(id)) add('FAIL', id, 'id', 'timeline id が重複しています。');
    timelineIds.add(id);
    if (!Number.isFinite(raw.order)) add('FAIL', id, 'order', 'order は数値である必要があります。');
    if (!Number.isInteger(raw.chapter) || Number(raw.chapter) < 0) add('FAIL', id, 'chapter', 'chapter は0以上の整数である必要があります。');
    if (Number(raw.chapter) > 1) add('WARN', id, 'chapter', '第2章以降のtimelineは現在のリリース範囲外です。');
    if (!isNonEmptyString(raw.title)) add('FAIL', id, 'title', 'title は非空文字列である必要があります。');
    if (!isNonEmptyString(raw.summary)) add('FAIL', id, 'summary', 'summary は非空文字列である必要があります。');
    if (!isStringArray(raw.participantRefs, false)) add('FAIL', id, 'participantRefs', 'participantRefs は1件以上必要です。');
    else for (const ref of raw.participantRefs) if (!entryIds.has(ref)) add('FAIL', id, 'participantRefs', `参照先entryが存在しません: ${ref}`);
    if (raw.locationRef !== undefined && (!isNonEmptyString(raw.locationRef) || !entryIds.has(raw.locationRef))) add('FAIL', id, 'locationRef', `参照先entryが存在しません: ${String(raw.locationRef)}`);
    if (!(LORE_CERTAINTIES as readonly unknown[]).includes(raw.certainty)) add('FAIL', id, 'certainty', '未対応のcertaintyです。');
    if (!isStringArray(raw.sourceRefs, false)) add('FAIL', id, 'sourceRefs', 'sourceRefs は1件以上必要です。');
  }

  if (!findings.some(finding => finding.level === 'FAIL')) add('PASS', 'registry', 'root', 'Lore Registry の構造と参照は有効です。');
  return findings;
}

export function isLoreRegistry(value: unknown): value is LoreRegistry {
  return isRecord(value) && value.schemaVersion === 1 && Array.isArray(value.entries) && Array.isArray(value.relationships) && Array.isArray(value.timeline);
}
