/**
 * 職業草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 職業は statModifiers（倍率）・energyCurve・levelBonuses・skills を持つ複合データ。
 * skills は skills.json を参照し、各スキルの type は職業 category と一致すべき（逆 owner-fit）。
 * baseStatsByLevel（lv1〜100）はフォーム側が補間生成するため、草稿では任意（無くてよい）。
 */

export type JobValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type JobValidationFinding = { level: JobValidationLevel; field: string; message: string };
export type JobValidationResult = { ok: boolean; findings: JobValidationFinding[] };

export type JobBalanceContext = {
  existingJobs: Record<string, unknown>;
  jobIds: Set<string>;
  skillIds: Set<string>;
  /** skillId → メタ（type/element）。あれば職業との整合を検証。 */
  skillMeta?: Record<string, { type?: string; element?: string }>;
  /** 草稿の想定 jobId（重複検出用）。 */
  expectedId?: string;
};

export const VALID_CATEGORIES = ['PHYSICAL', 'MAGICAL'] as const;
export const VALID_BASE_ATTACK_TYPES = ['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON'] as const;
export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'] as const;
export const VALID_LEVELBONUS_KEYS = [
  'passiveAtkBonus', 'passiveDefBonus', 'passiveHpBonus', 'passiveSpdBonus',
  'passiveCritRateBonus', 'passiveCritDmgBonus',
] as const;

/** category ↔ baseAttackType の妥当な組み合わせ。 */
const CATEGORY_ATTACK_TYPES: Record<string, string[]> = {
  PHYSICAL: ['SLASH', 'STRIKE'],
  MAGICAL: ['MAGIC', 'PROJECTILE', 'SUMMON'],
};

/** statModifier 倍率の許容帯（実データ 0.72〜1.45 に余裕を持たせる）。外は WARN、極端は FAIL。 */
const MODIFIER_SOFT = { min: 0.6, max: 1.6 };
const MODIFIER_HARD = { min: 0.1, max: 3 };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function validateJobDraft(draft: unknown, ctx: JobBalanceContext): JobValidationResult {
  const findings: JobValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['name', 'displayName']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }
  // id（任意だが、あれば snake_case + 重複チェック）
  if (draft.id !== undefined) {
    if (typeof draft.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(draft.id)) {
      fail('id', `id "${String(draft.id)}" は snake_case である必要があります。`);
    } else if (ctx.jobIds.has(draft.id)) {
      fail('id', `id "${draft.id}" は既存職業と重複しています。`);
    }
  }

  // --- tier ---
  const tier = draft.tier;
  if (tier !== 1 && tier !== 2) {
    fail('tier', `tier は 1 または 2 である必要があります（現在: ${String(tier)}）。`);
  }

  // --- category / baseAttackType ---
  const category = draft.category;
  const categoryValid = typeof category === 'string' && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number]);
  if (!categoryValid) {
    fail('category', `category は ${VALID_CATEGORIES.join(' / ')} のいずれかである必要があります（現在: ${String(category)}）。`);
  }
  const baseAttackType = draft.baseAttackType;
  const batValid = typeof baseAttackType === 'string' && VALID_BASE_ATTACK_TYPES.includes(baseAttackType as (typeof VALID_BASE_ATTACK_TYPES)[number]);
  if (!batValid) {
    fail('baseAttackType', `baseAttackType は ${VALID_BASE_ATTACK_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(baseAttackType)}）。`);
  }
  if (categoryValid && batValid && !CATEGORY_ATTACK_TYPES[category as string].includes(baseAttackType as string)) {
    warn(
      'baseAttackType',
      `${category} 系の baseAttackType は ${CATEGORY_ATTACK_TYPES[category as string].join('/')} が自然です（現在: ${baseAttackType}）。`,
    );
  }

  // --- statModifiers ---
  const sm = draft.statModifiers;
  if (!isRecord(sm)) {
    fail('statModifiers', 'statModifiers が存在しません。');
  } else {
    for (const key of STAT_KEYS) {
      const v = getNum(sm, key);
      if (v === null) {
        fail(`statModifiers.${key}`, `statModifiers.${key} は数値（倍率）である必要があります。`);
      } else if (v < MODIFIER_HARD.min || v > MODIFIER_HARD.max) {
        fail(`statModifiers.${key}`, `statModifiers.${key}=${v} は倍率として異常です（1.0前後の倍率。例 atk 1.2）。`);
      } else if (v < MODIFIER_SOFT.min || v > MODIFIER_SOFT.max) {
        warn(`statModifiers.${key}`, `statModifiers.${key}=${v} は既存帯 ${MODIFIER_SOFT.min}〜${MODIFIER_SOFT.max} から外れています。`);
      }
    }
    // パワーバジェット: 倍率合計が既存平均から大きく超過していないか
    const total = STAT_KEYS.reduce((acc, k) => acc + (getNum(sm, k) ?? 0), 0);
    if (total > STAT_KEYS.length * 1.3) {
      warn('statModifiers', `statModifiers の合計倍率が高すぎます（${total.toFixed(2)}）。全ステータス強化は過剰です。何かを犠牲にしてください。`);
    }
  }

  // --- energyCurve ---
  const ec = draft.energyCurve;
  if (!isRecord(ec)) {
    fail('energyCurve', 'energyCurve が存在しません。');
  } else {
    if ((getNum(ec, 'baseMaxEnergy') ?? 0) <= 0) fail('energyCurve.baseMaxEnergy', 'baseMaxEnergy は正の数である必要があります。');
    if ((getNum(ec, 'ultimateCost') ?? 0) <= 0) fail('energyCurve.ultimateCost', 'ultimateCost は正の数である必要があります。');
    if (getNum(ec, 'spGrowthPerLevel') === null || (getNum(ec, 'spGrowthPerLevel') ?? -1) < 0) {
      fail('energyCurve.spGrowthPerLevel', 'spGrowthPerLevel は 0 以上の数値である必要があります。');
    }
  }

  // --- levelBonuses ---
  const lb = draft.levelBonuses;
  if (!isRecord(lb)) {
    fail('levelBonuses', 'levelBonuses が存在しません（無ければ {} ）。');
  } else {
    for (const [lvl, bonus] of Object.entries(lb)) {
      if (!/^\d+$/.test(lvl)) {
        fail('levelBonuses', `levelBonuses のキー "${lvl}" はレベル（数値文字列）である必要があります。`);
      }
      if (!isRecord(bonus)) {
        fail(`levelBonuses.${lvl}`, 'ボーナスはオブジェクトである必要があります。');
        continue;
      }
      for (const [bk, bv] of Object.entries(bonus)) {
        if (!VALID_LEVELBONUS_KEYS.includes(bk as (typeof VALID_LEVELBONUS_KEYS)[number])) {
          fail(`levelBonuses.${lvl}`, `ボーナスキー "${bk}" は不正です（${VALID_LEVELBONUS_KEYS.join('/')}）。`);
        } else if (typeof bv !== 'number') {
          fail(`levelBonuses.${lvl}.${bk}`, `${bk} は数値である必要があります。`);
        }
      }
    }
  }

  // --- skills（参照整合 + 職業 category との整合） ---
  const skills = draft.skills;
  if (!Array.isArray(skills)) {
    fail('skills', 'skills は配列である必要があります。');
  } else {
    if (skills.length === 0) {
      warn('skills', 'skills が空です。少なくとも Lv1 で習得する初期スキルを設定してください。');
    }
    let hasLevel1 = false;
    skills.forEach((s, i) => {
      if (!isRecord(s)) {
        fail(`skills[${i}]`, 'スキルエントリがオブジェクトではありません。');
        return;
      }
      const lvl = getNum(s, 'level');
      if (lvl === null || lvl < 1 || !Number.isInteger(lvl)) {
        fail(`skills[${i}].level`, 'level は 1 以上の整数である必要があります。');
      } else if (lvl === 1) {
        hasLevel1 = true;
      }
      const sid = s.skillId;
      if (typeof sid !== 'string' || !ctx.skillIds.has(sid)) {
        fail(`skills[${i}].skillId`, `スキル "${String(sid)}" が skills.json に存在しません。`);
      } else {
        pass(`skills[${i}]`, `スキル参照 "${sid}" OK`);
        // 逆 owner-fit: スキル type は職業 category と一致すべき
        const meta = ctx.skillMeta?.[sid];
        if (categoryValid && meta?.type && meta.type !== category) {
          warn(
            `skills[${i}].skillId`,
            `スキル "${sid}" は ${meta.type} ですが、この職業は ${category} 系です。系統に合うスキルを推奨します。`,
          );
        }
      }
    });
    if (skills.length > 0 && !hasLevel1) {
      warn('skills', 'Lv1 で習得する初期スキルがありません。最初のスキルは level 1 を推奨します。');
    }
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・列挙・倍率・スキル整合すべて問題ありません。');
  }
  return { ok, findings };
}

export function jobFindingsToFeedback(findings: JobValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
