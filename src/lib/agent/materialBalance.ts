/**
 * 素材草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 素材はシンプルな構造（id/name/quantity/expValue/rarity）。enemies の dropTable から
 * 参照される側。rarity が expValue 帯を決めるため、実データから rarity 別帯を学習して検閲する。
 */

export type MaterialValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type MaterialValidationFinding = { level: MaterialValidationLevel; field: string; message: string };
export type MaterialValidationResult = { ok: boolean; findings: MaterialValidationFinding[] };

export type MaterialBalanceContext = {
  existingMaterials: Record<string, unknown>;
  materialIds: Set<string>;
};

export const VALID_MATERIAL_RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

/** データに無いレアリティ用の expValue フォールバック帯。 */
const FALLBACK_EXP_BANDS: Record<string, [number, number]> = {
  COMMON: [80, 250],
  RARE: [400, 1000],
  EPIC: [1200, 3000],
  LEGENDARY: [3500, 8000],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 既存素材から rarity ごとの expValue 帯（min/max）を学習する。 */
export function deriveExpBands(existingMaterials: Record<string, unknown>): Record<string, { min: number; max: number }> {
  const bands: Record<string, { min: number; max: number }> = {};
  for (const m of Object.values(existingMaterials)) {
    if (!isRecord(m)) continue;
    const rarity = typeof m.rarity === 'string' ? m.rarity : null;
    const exp = getNum(m, 'expValue');
    if (!rarity || exp === null) continue;
    bands[rarity] = bands[rarity]
      ? { min: Math.min(bands[rarity].min, exp), max: Math.max(bands[rarity].max, exp) }
      : { min: exp, max: exp };
  }
  return bands;
}

export function validateMaterialDraft(draft: unknown, ctx: MaterialBalanceContext): MaterialValidationResult {
  const findings: MaterialValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['id', 'name']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }
  if (typeof draft.id === 'string' && !/^[a-z][a-z0-9_]*$/.test(draft.id)) {
    fail('id', `id "${draft.id}" は snake_case である必要があります。`);
  }
  if (typeof draft.id === 'string' && ctx.materialIds.has(draft.id)) {
    fail('id', `id "${draft.id}" は既存素材と重複しています。`);
  }

  // --- rarity ---
  const rarity = draft.rarity;
  const rarityValid = typeof rarity === 'string' && VALID_MATERIAL_RARITIES.includes(rarity as (typeof VALID_MATERIAL_RARITIES)[number]);
  if (!rarityValid) {
    fail('rarity', `rarity は ${VALID_MATERIAL_RARITIES.join(' / ')} のいずれかである必要があります（現在: ${String(rarity)}）。`);
  }

  // --- quantity ---
  const quantity = getNum(draft, 'quantity');
  if (quantity === null || quantity < 1 || !Number.isInteger(quantity)) {
    fail('quantity', 'quantity は 1 以上の整数である必要があります。');
  }

  // --- expValue（rarity 帯で検閲） ---
  const exp = getNum(draft, 'expValue');
  if (exp === null || exp <= 0 || !Number.isInteger(exp)) {
    fail('expValue', 'expValue は 1 以上の整数である必要があります。');
  } else if (rarityValid) {
    const learned = deriveExpBands(ctx.existingMaterials)[rarity as string];
    const band = learned
      ? { min: learned.min * 0.5, max: learned.max * 2 }
      : { min: FALLBACK_EXP_BANDS[rarity as string][0], max: FALLBACK_EXP_BANDS[rarity as string][1] };
    if (exp < band.min || exp > band.max) {
      warn(
        'expValue',
        `${rarity} の expValue は目安 ${Math.floor(band.min)}〜${Math.ceil(band.max)} です（現在: ${exp}）。${learned ? '実データ帯' : '標準帯'}を確認してください。`,
      );
    } else {
      pass('expValue', `expValue ${exp} は ${rarity} 帯内 OK`);
    }
    // レアリティ逆転チェック: RARE 以上が COMMON 帯と被るのは不自然
    const bands = deriveExpBands(ctx.existingMaterials);
    if (rarity !== 'COMMON' && bands.COMMON && exp <= bands.COMMON.max) {
      warn('expValue', `${rarity} の expValue ${exp} が COMMON 帯（〜${bands.COMMON.max}）と同等以下です。レアリティ差を付けてください。`);
    }
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・列挙・expValue 帯すべて問題ありません。');
  }
  return { ok, findings };
}

export function materialFindingsToFeedback(findings: MaterialValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
