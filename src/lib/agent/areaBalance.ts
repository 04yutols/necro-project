/**
 * エリア草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * エリアはマップのメタデータ（id/chapter/area/nameJa/nameEn/description/color/position/sortOrder）。
 * stages から chapter+area で参照される（"ch{chapter}_area{area}"）ため、id 規約の整合が重要。
 */

export type AreaValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type AreaValidationFinding = { level: AreaValidationLevel; field: string; message: string };
export type AreaValidationResult = { ok: boolean; findings: AreaValidationFinding[] };

export type AreaBalanceContext = {
  existingAreas: Record<string, unknown>;
  areaIds: Set<string>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** id 規約: ch{chapter}_area{area} */
export function areaIdFor(chapter: unknown, area: unknown): string {
  return `ch${String(chapter)}_area${String(area)}`;
}

/** sortOrder の推奨値（chapter*100 + area）。 */
export function suggestedSortOrder(chapter: number, area: number): number {
  return chapter * 100 + area;
}

export function validateAreaDraft(draft: unknown, ctx: AreaBalanceContext): AreaValidationResult {
  const findings: AreaValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['id', 'nameJa', 'nameEn', 'description']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }

  // --- chapter / area ---
  const chapter = draft.chapter;
  const area = draft.area;
  const chapterValid = Number.isInteger(chapter) && Number(chapter) >= 1;
  const areaValid = Number.isInteger(area) && Number(area) >= 1;
  if (!chapterValid) fail('chapter', 'chapter は 1 以上の整数である必要があります。');
  if (!areaValid) fail('area', 'area は 1 以上の整数である必要があります。');

  // --- id 規約（ch{chapter}_area{area}）+ 重複 ---
  if (chapterValid && areaValid && typeof draft.id === 'string') {
    const expected = areaIdFor(chapter, area);
    if (draft.id !== expected) {
      fail('id', `id は "${expected}"（ch{chapter}_area{area} 規約）である必要があります（現在: ${draft.id}）。`);
    } else {
      pass('id', `id 規約 "${expected}" OK`);
    }
  }
  if (typeof draft.id === 'string' && ctx.areaIds.has(draft.id)) {
    fail('id', `id "${draft.id}" は既存エリアと重複しています。`);
  }
  // chapter+area の重複（別IDで同じ chapter/area）
  if (chapterValid && areaValid) {
    for (const [eid, e] of Object.entries(ctx.existingAreas)) {
      if (!isRecord(e)) continue;
      if (e.chapter === chapter && e.area === area && eid !== draft.id) {
        fail('area', `chapter ${chapter} / area ${area} は既存エリア "${eid}" と重複しています。`);
        break;
      }
    }
  }

  // --- color ---
  if (typeof draft.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(draft.color)) {
    fail('color', `color は #RRGGBB 形式である必要があります（現在: ${String(draft.color)}）。`);
  }

  // --- position ---
  const position = draft.position;
  if (!isRecord(position) || getNum(position, 'x') === null || getNum(position, 'y') === null) {
    fail('position', 'position.x / position.y は数値である必要があります。');
  } else {
    const x = getNum(position, 'x')!;
    const y = getNum(position, 'y')!;
    if (x < 0 || x > 2000 || y < 0 || y > 2000) {
      warn('position', `position (${x}, ${y}) がマップ範囲外の可能性があります（目安 0〜2000）。`);
    }
  }

  // --- sortOrder（任意・規約推奨） ---
  if (draft.sortOrder !== undefined) {
    const so = getNum(draft, 'sortOrder');
    if (so === null) {
      fail('sortOrder', 'sortOrder は数値である必要があります。');
    } else if (chapterValid && areaValid) {
      const suggested = suggestedSortOrder(Number(chapter), Number(area));
      if (so !== suggested) {
        warn('sortOrder', `sortOrder は規約上 ${suggested}（chapter*100+area）が推奨です（現在: ${so}）。`);
      }
    }
  } else if (chapterValid && areaValid) {
    warn('sortOrder', `sortOrder が未設定です。マップ並び順のため ${suggestedSortOrder(Number(chapter), Number(area))} を推奨します。`);
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・id 規約・color・position すべて問題ありません。');
  }
  return { ok, findings };
}

export function areaFindingsToFeedback(findings: AreaValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
