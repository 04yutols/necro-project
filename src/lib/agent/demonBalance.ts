/**
 * 魔神化フォーム草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 設計書 16_魔神化システム.md の Tier 設計ルールを実装する:
 *   - Tier 1: 直感的な強さ。リスク（Effect B の riskType）は設定しない。
 *   - Tier 2: 悪魔合体。強烈なリスク（riskType）必須 + 持続効果（lingering）必須。
 * 魔神技 power は Tier 別の基準帯に収める（過剰インフレ禁止）。
 * フォームは職業に紐づく（key=jobId）ため、紐付き先の job tier / 基礎攻撃と整合を検閲する。
 */

import { findUnknownFields } from './knownFields';

export type DemonValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type DemonValidationFinding = { level: DemonValidationLevel; field: string; message: string };
export type DemonValidationResult = { ok: boolean; findings: DemonValidationFinding[] };

/** 紐付き先の職業情報。 */
export type DemonJobOwner = {
  id: string;
  displayName?: string;
  category?: string;
  baseAttackType?: string;
  tier?: number;
};

export type DemonBalanceContext = {
  /** 既存 demonForms（key=jobId）。重複検出・分布参照用。 */
  existingForms: Record<string, unknown>;
  /** jobs.json のキー集合（jobId 参照検証用）。 */
  jobIds: Set<string>;
  /** 紐付き先の職業（あれば tier / 攻撃種別の整合を検証）。 */
  owner?: DemonJobOwner;
};

export const VALID_ELEMENTS = [
  'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE',
] as const;
export const VALID_ULT_TARGET_TYPES = ['SINGLE', 'ALL'] as const;
export const VALID_ULT_ATTACK_TYPES = ['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON', 'HEAL'] as const;
export const VALID_RISK_TYPES = ['SELF_DAMAGE', 'ENERGY_DRAIN', 'GLASS_CANNON', 'SETUP_DEPENDENT'] as const;
export const VALID_LINGERING_TYPES = ['FIELD', 'PARTY_BUFF', 'ENEMY_DEBUFF'] as const;
export const VALID_STAT_KEYS = [
  'hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes',
] as const;

/** Tier 別 魔神技 power 基準帯（設計書16 + 実データ分布に許容を持たせた範囲）。 */
export const DEMON_ULT_POWER_RANGE: Record<number, [number, number]> = {
  1: [2.8, 3.6],
  2: [3.6, 4.8],
};

/** statBoosts は倍率（0.8=+80%）。これを超えると過剰インフレ or スケール誤りの疑い。 */
const STATBOOST_WARN_OVER = 2.5;
const STATBOOST_SCALE_FAIL_OVER = 5;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function validateDemonFormDraft(draft: unknown, ctx: DemonBalanceContext): DemonValidationResult {
  const findings: DemonValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['jobId', 'formName', 'concept']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }

  // --- jobId 参照 ---
  if (typeof draft.jobId === 'string') {
    if (!ctx.jobIds.has(draft.jobId)) {
      fail('jobId', `jobId "${draft.jobId}" が jobs.json に存在しません。`);
    }
    if (ctx.owner && draft.jobId !== ctx.owner.id) {
      warn('jobId', `jobId "${draft.jobId}" が指定の紐付き先 "${ctx.owner.id}" と異なります。`);
    }
  }

  // --- tier ---
  const tier = draft.tier;
  const tierNum = tier === 1 || tier === 2 ? tier : null;
  if (tierNum === null) {
    fail('tier', `tier は 1 または 2 である必要があります（現在: ${String(tier)}）。`);
  } else if (ctx.owner?.tier && ctx.owner.tier !== tierNum) {
    warn('tier', `tier ${tierNum} が紐付き先職業の tier ${ctx.owner.tier} と一致しません。`);
  }

  // --- effectA ---
  const effectA = draft.effectA;
  if (!isRecord(effectA)) {
    fail('effectA', 'effectA が存在しません。');
  } else {
    if (typeof effectA.descJa !== 'string' || effectA.descJa.trim() === '') {
      fail('effectA.descJa', 'effectA.descJa は非空の文字列である必要があります。');
    }
    if (!isRecord(effectA.statBoosts)) {
      fail('effectA.statBoosts', 'effectA.statBoosts が存在しません。');
    } else {
      const entries = Object.entries(effectA.statBoosts);
      if (entries.length === 0) {
        warn('effectA.statBoosts', 'statBoosts が空です。魔神化の強化が無いフォームになります。');
      }
      for (const [k, v] of entries) {
        if (!VALID_STAT_KEYS.includes(k as (typeof VALID_STAT_KEYS)[number])) {
          fail('effectA.statBoosts', `statBoosts のキー "${k}" は不正です（${VALID_STAT_KEYS.join('/')}）。`);
        }
        if (typeof v !== 'number' || v <= 0) {
          fail('effectA.statBoosts', `statBoosts.${k} は正の倍率である必要があります（例: 0.8=+80%）。`);
        } else if (v > STATBOOST_SCALE_FAIL_OVER) {
          fail('effectA.statBoosts', `statBoosts.${k}=${v} は過大です。倍率表記（+80%なら 0.8）になっているか確認してください。`);
        } else if (v > STATBOOST_WARN_OVER) {
          warn('effectA.statBoosts', `statBoosts.${k}=${v}（+${Math.round(v * 100)}%）は強力です。tier バランスを確認してください。`);
        }
      }
    }
  }

  // --- effectB（Tier 別リスクルールの中核） ---
  const effectB = draft.effectB;
  if (!isRecord(effectB)) {
    fail('effectB', 'effectB が存在しません。');
  } else {
    if (typeof effectB.descJa !== 'string' || effectB.descJa.trim() === '') {
      fail('effectB.descJa', 'effectB.descJa は非空の文字列である必要があります。');
    }
    const riskType = effectB.riskType;
    const riskIsNull = riskType === null || riskType === undefined;
    if (!riskIsNull && !VALID_RISK_TYPES.includes(riskType as (typeof VALID_RISK_TYPES)[number])) {
      fail('effectB.riskType', `riskType は ${VALID_RISK_TYPES.join(' / ')} または null である必要があります（現在: ${String(riskType)}）。`);
    }
    // Tier 設計ルール（設計書16 §3）
    if (tierNum === 1 && !riskIsNull) {
      warn('effectB.riskType', 'Tier1 はリスクを設定しない設計です（直感的な強さ）。riskType は null を推奨します。');
    }
    if (tierNum === 2) {
      if (riskIsNull) {
        fail('effectB.riskType', 'Tier2 はリスク（riskType）が必須です（悪魔合体の代償）。SELF_DAMAGE / ENERGY_DRAIN / GLASS_CANNON / SETUP_DEPENDENT から設定してください。');
      } else if (getNum(effectB, 'riskValue') === null) {
        warn('effectB.riskValue', 'Tier2 のリスクには riskValue（代償の大きさ）を設定することを推奨します。');
      }
    }
  }

  // --- ultimateSkill ---
  const ult = draft.ultimateSkill;
  if (!isRecord(ult)) {
    fail('ultimateSkill', 'ultimateSkill が存在しません。');
  } else {
    if (typeof ult.nameJa !== 'string' || ult.nameJa.trim() === '') {
      fail('ultimateSkill.nameJa', 'ultimateSkill.nameJa は非空の文字列である必要があります。');
    }
    const dmg = ult.damage;
    if (!isRecord(dmg)) {
      fail('ultimateSkill.damage', 'ultimateSkill.damage が存在しません。');
    } else {
      const power = getNum(dmg, 'power');
      if (power === null || power <= 0) {
        fail('ultimateSkill.damage.power', 'power は正の数である必要があります。');
      } else if (tierNum) {
        const [lo, hi] = DEMON_ULT_POWER_RANGE[tierNum];
        if (power < lo || power > hi) {
          warn(
            'ultimateSkill.damage.power',
            `Tier${tierNum} の魔神技 power 基準は ${lo}〜${hi}（設計書16）。現在 ${power} は範囲外です。`,
          );
        } else {
          pass('ultimateSkill.damage.power', `power ${power} は Tier${tierNum} 基準 ${lo}〜${hi} 内 OK`);
        }
      }
      const el = dmg.element;
      if (typeof el !== 'string' || !VALID_ELEMENTS.includes(el as (typeof VALID_ELEMENTS)[number])) {
        fail('ultimateSkill.damage.element', `element が不正です（現在: ${String(el)}）。`);
      }
      const tt = dmg.targetType;
      if (typeof tt !== 'string' || !VALID_ULT_TARGET_TYPES.includes(tt as (typeof VALID_ULT_TARGET_TYPES)[number])) {
        fail('ultimateSkill.damage.targetType', `targetType は SINGLE / ALL である必要があります（現在: ${String(tt)}）。`);
      }
      if (dmg.attackType !== undefined) {
        const at = dmg.attackType;
        if (typeof at !== 'string' || !VALID_ULT_ATTACK_TYPES.includes(at as (typeof VALID_ULT_ATTACK_TYPES)[number])) {
          fail('ultimateSkill.damage.attackType', `attackType が不正です（現在: ${String(at)}）。`);
        } else if (ctx.owner?.baseAttackType && at !== ctx.owner.baseAttackType && at !== 'MAGIC') {
          warn(
            'ultimateSkill.damage.attackType',
            `紐付き先「${ctx.owner.displayName ?? ctx.owner.id}」の基礎攻撃は ${ctx.owner.baseAttackType} です。魔神技 attackType を揃えると一貫します（現在: ${at}）。`,
          );
        }
      }
    }
    // lingering（Tier2 は持続効果必須）
    const ling = ult.lingering;
    if (!isRecord(ling)) {
      if (tierNum === 2) {
        fail('ultimateSkill.lingering', 'Tier2 の魔神技は持続効果（lingering）が必須です（戦闘ローテーションを有利にする）。');
      } else {
        warn('ultimateSkill.lingering', 'lingering（持続効果）が未設定です。');
      }
    } else {
      const lt = ling.type;
      if (typeof lt !== 'string' || !VALID_LINGERING_TYPES.includes(lt as (typeof VALID_LINGERING_TYPES)[number])) {
        fail('ultimateSkill.lingering.type', `lingering.type は ${VALID_LINGERING_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(lt)}）。`);
      }
      if (typeof ling.descJa !== 'string' || ling.descJa.trim() === '') {
        fail('ultimateSkill.lingering.descJa', 'lingering.descJa は非空の文字列である必要があります。');
      }
      const dur = getNum(ling, 'duration');
      if (dur === null || dur < 1 || !Number.isInteger(dur)) {
        fail('ultimateSkill.lingering.duration', 'lingering.duration は 1 以上の整数である必要があります。');
      }
    }
  }

  // R-3: 未知トップレベルフィールドを WARN 検出
  findings.push(...findUnknownFields(draft, 'demonForms'));
  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・列挙・Tierルール・power 基準すべて問題ありません。');
  }
  return { ok, findings };
}

export function demonFindingsToFeedback(findings: DemonValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
