/**
 * 一括変更スペック（BulkSpec）の型 + 決定論的スキーマ検証（LLM 不使用の純関数）。
 *
 * 設計書 105: LLM は「自然言語 → BulkSpec への翻訳」のみを行う。BulkSpec が構造的に
 * 妥当か（file 列挙・op 列挙・field 文字列・value 型）をここで機械検証する。
 * 実際の変更（フィルタ抽出・数値演算）は bulkEngine.ts が決定論的に行う。
 */

export const BULK_FILES = [
  'enemies', 'skills', 'stages', 'jobs', 'items', 'materials', 'monsters', 'demonForms', 'areas',
] as const;
export type BulkFile = (typeof BULK_FILES)[number];

export const COMPARATORS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'exists'] as const;
export type Comparator = (typeof COMPARATORS)[number];

export const MUTATION_OPS = ['set', 'add', 'mul', 'clampMin', 'clampMax'] as const;
export type MutationOp = (typeof MUTATION_OPS)[number];

export type Condition = { field: string; op: Comparator; value?: unknown };
export type Mutation = { field: string; op: MutationOp; value: number | string | boolean };

export type BulkSpec = {
  file: BulkFile;
  filter: Condition[];
  operation: Mutation[];
  note?: string;
};

export type SpecValidationFinding = { level: 'FAIL' | 'WARN'; field: string; message: string };
export type SpecValidationResult = { ok: boolean; spec: BulkSpec | null; findings: SpecValidationFinding[] };

/** 数値演算系（value が数値であるべき）の op。 */
const NUMERIC_OPS: MutationOp[] = ['add', 'mul', 'clampMin', 'clampMax'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function validField(f: unknown): f is string {
  return typeof f === 'string' && /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(f);
}

/**
 * 任意の値（LLM 出力など）を BulkSpec として検証する。
 * 構造的に妥当なら ok=true と正規化済み spec を返す。
 */
export function validateBulkSpec(raw: unknown): SpecValidationResult {
  const findings: SpecValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });

  if (!isRecord(raw)) {
    return { ok: false, spec: null, findings: [{ level: 'FAIL', field: 'root', message: 'spec がオブジェクトではありません。' }] };
  }

  // --- file ---
  const file = raw.file;
  if (typeof file !== 'string' || !BULK_FILES.includes(file as BulkFile)) {
    fail('file', `file は ${BULK_FILES.join(' / ')} のいずれかである必要があります（現在: ${String(file)}）。`);
  }

  // --- filter ---
  const filter: Condition[] = [];
  if (!Array.isArray(raw.filter)) {
    fail('filter', 'filter は配列である必要があります（無条件全件なら []）。');
  } else if (raw.filter.length === 0) {
    warn('filter', 'filter が空です。全件変更になるため、適用前に対象件数を確認してください。');
  } else {
    raw.filter.forEach((c, i) => {
      if (!isRecord(c)) {
        fail(`filter[${i}]`, '条件がオブジェクトではありません。');
        return;
      }
      if (!validField(c.field)) fail(`filter[${i}].field`, `field "${String(c.field)}" が不正です（英字始まり・ドット記法可）。`);
      if (typeof c.op !== 'string' || !COMPARATORS.includes(c.op as Comparator)) {
        fail(`filter[${i}].op`, `op は ${COMPARATORS.join(' / ')} のいずれかである必要があります（現在: ${String(c.op)}）。`);
      }
      if (c.op === 'in' && !Array.isArray(c.value)) {
        fail(`filter[${i}].value`, '"in" の value は配列である必要があります。');
      }
      if (c.op !== 'exists' && c.op !== 'in' && c.value === undefined) {
        fail(`filter[${i}].value`, `op "${String(c.op)}" には value が必要です。`);
      }
      if (validField(c.field) && typeof c.op === 'string' && COMPARATORS.includes(c.op as Comparator)) {
        filter.push({ field: c.field, op: c.op as Comparator, value: c.value });
      }
    });
  }

  // --- operation ---
  const operation: Mutation[] = [];
  if (!Array.isArray(raw.operation)) {
    fail('operation', 'operation は配列である必要があります。');
  } else if (raw.operation.length === 0) {
    fail('operation', 'operation が空です。少なくとも1つの変更が必要です。');
  } else {
    raw.operation.forEach((m, i) => {
      if (!isRecord(m)) {
        fail(`operation[${i}]`, 'operation がオブジェクトではありません。');
        return;
      }
      if (!validField(m.field)) fail(`operation[${i}].field`, `field "${String(m.field)}" が不正です。`);
      const op = m.op;
      if (typeof op !== 'string' || !MUTATION_OPS.includes(op as MutationOp)) {
        fail(`operation[${i}].op`, `op は ${MUTATION_OPS.join(' / ')} のいずれかである必要があります（現在: ${String(op)}）。`);
        return;
      }
      if (NUMERIC_OPS.includes(op as MutationOp) && typeof m.value !== 'number') {
        fail(`operation[${i}].value`, `op "${op}" の value は数値である必要があります。`);
      }
      if (op === 'set' && !(typeof m.value === 'number' || typeof m.value === 'string' || typeof m.value === 'boolean')) {
        fail(`operation[${i}].value`, '"set" の value は number / string / boolean である必要があります。');
      }
      if (op === 'mul' && typeof m.value === 'number' && m.value === 1) {
        warn(`operation[${i}]`, 'mul value=1 は変化がありません。');
      }
      if (validField(m.field) && (typeof m.value === 'number' || typeof m.value === 'string' || typeof m.value === 'boolean')) {
        operation.push({ field: m.field, op: op as MutationOp, value: m.value });
      }
    });
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  return {
    ok,
    spec: ok
      ? { file: file as BulkFile, filter, operation, note: typeof raw.note === 'string' ? raw.note : undefined }
      : null,
    findings,
  };
}

export function specFindingsToFeedback(findings: SpecValidationFinding[]): string {
  const problems = findings.filter((f) => f.level === 'FAIL');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
