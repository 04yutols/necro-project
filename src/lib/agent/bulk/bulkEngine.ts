/**
 * 一括変更の決定論エンジン（LLM 不使用の純関数）。
 *
 * 設計書 105: LLM は BulkSpec を作るだけ。フィルタ抽出と数値変更はここが決定論的に行う。
 * ディスクには一切触れない（引数で渡されたメモリ内エンティティのみ操作する）。
 */

import type { BulkSpec, Condition, Mutation } from './bulkSpec';
import { deepDiff, type FieldDiff } from '../auditFix/diff';

export type BulkChange = {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  diff: FieldDiff[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** ドット記法でネストした値を取得。 */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** ドット記法でネストした値を設定（中間オブジェクトは生成。元オブジェクトは破壊しない前提で clone 済みに対して使う）。 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isRecord(cur[p])) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function compare(a: unknown, op: Condition['op'], b: unknown): boolean {
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '<': return typeof a === 'number' && typeof b === 'number' && a < b;
    case '<=': return typeof a === 'number' && typeof b === 'number' && a <= b;
    case '>': return typeof a === 'number' && typeof b === 'number' && a > b;
    case '>=': return typeof a === 'number' && typeof b === 'number' && a >= b;
    case 'in': return Array.isArray(b) && b.includes(a);
    case 'exists': return a !== undefined && a !== null;
    default: return false;
  }
}

/** 全条件（AND）に一致するか。 */
export function matchesFilter(entity: Record<string, unknown>, filter: Condition[]): boolean {
  return filter.every((c) => compare(getByPath(entity, c.field), c.op, c.value));
}

/** filter に一致する id 一覧（変化の有無に関わらず）。 */
export function selectMatchedIds(
  entities: Record<string, Record<string, unknown>>,
  filter: Condition[],
): string[] {
  return Object.entries(entities)
    .filter(([, e]) => isRecord(e) && matchesFilter(e, filter))
    .map(([id]) => id);
}

/**
 * mutation の field が「一致したどのエンティティにも存在しない」ものを返す。
 * → タイプミスや LLM のフィールド幻覚を検出する（add/mul は欠落フィールドを黙ってスキップするため）。
 */
export function auditMutationFields(
  matchedEntities: Record<string, unknown>[],
  mutations: { field: string; op: string }[],
): string[] {
  const missing: string[] = [];
  for (const m of mutations) {
    if (m.op === 'set') continue; // set は新規追加が意図の場合もあるので対象外
    const existsSomewhere = matchedEntities.some((e) => getByPath(e, m.field) !== undefined);
    if (!existsSomewhere) missing.push(m.field);
  }
  return missing;
}

/** 元値の型に合わせて丸める（整数フィールドは四捨五入、小数は桁を保つ）。 */
function coerceNumber(original: unknown, result: number): number {
  if (typeof original === 'number' && Number.isInteger(original)) {
    return Math.round(result);
  }
  // 浮動小数の桁あふれを抑える（power 等）
  return Number(result.toFixed(6));
}

/** 1 エンティティ（clone 済み）に mutation 群を順次適用。 */
export function applyMutations(entity: Record<string, unknown>, mutations: Mutation[]): void {
  for (const m of mutations) {
    const cur = getByPath(entity, m.field);
    switch (m.op) {
      case 'set':
        setByPath(entity, m.field, m.value);
        break;
      case 'add':
        if (typeof cur === 'number' && typeof m.value === 'number') {
          setByPath(entity, m.field, coerceNumber(cur, cur + m.value));
        }
        break;
      case 'mul':
        if (typeof cur === 'number' && typeof m.value === 'number') {
          setByPath(entity, m.field, coerceNumber(cur, cur * m.value));
        }
        break;
      case 'clampMin':
        if (typeof cur === 'number' && typeof m.value === 'number') {
          setByPath(entity, m.field, coerceNumber(cur, Math.max(cur, m.value)));
        }
        break;
      case 'clampMax':
        if (typeof cur === 'number' && typeof m.value === 'number') {
          setByPath(entity, m.field, coerceNumber(cur, Math.min(cur, m.value)));
        }
        break;
      default:
        break;
    }
  }
}

/**
 * コレクション（id → entity）に BulkSpec を適用し、変更されたエンティティの before/after/diff を返す。
 * **入力は変更しない**（各エンティティを clone してから操作する）。ディスクにも触れない。
 */
export function applyBulkSpec(
  entities: Record<string, Record<string, unknown>>,
  spec: BulkSpec,
): BulkChange[] {
  const changes: BulkChange[] = [];
  for (const [id, entity] of Object.entries(entities)) {
    if (!isRecord(entity)) continue;
    if (!matchesFilter(entity, spec.filter)) continue;

    const after = JSON.parse(JSON.stringify(entity)) as Record<string, unknown>;
    applyMutations(after, spec.operation);

    const diff = deepDiff(entity, after);
    if (diff.length === 0) continue; // 実質変化なしはスキップ
    changes.push({ id, before: entity, after, diff });
  }
  return changes;
}

/** 変更を適用したコレクション全体を返す（in-memory 監査の override 用。入力は不変）。 */
export function buildPatchedCollection(
  entities: Record<string, Record<string, unknown>>,
  changes: BulkChange[],
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { ...entities };
  for (const c of changes) out[c.id] = c.after;
  return out;
}
