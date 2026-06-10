/**
 * スキル草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 設計書 19_スキルバランス設計書.md §2.2 の「cost帯 × 分類 × Tier の power 表」を
 * 数値の憲法として実装する。さらにスキルは職業（または魔物）に紐づくため、
 * 紐付き先（owner）の category / baseAttackType / tier と整合するかを検閲する。
 */

import { findUnknownFields } from './knownFields';

export type SkillValidationLevel = 'PASS' | 'WARN' | 'FAIL';

export type SkillValidationFinding = {
  level: SkillValidationLevel;
  field: string;
  message: string;
};

export type SkillValidationResult = {
  ok: boolean;
  findings: SkillValidationFinding[];
};

/** スキルの紐付き先（職業 or 魔物）。 */
export type SkillOwner = {
  kind: 'job' | 'monster';
  id: string;
  displayName?: string;
  /** 職業の系統（PHYSICAL/MAGICAL）。スキル type はこれに一致すべき。 */
  category?: string;
  /** 職業の基礎攻撃種別。スキル attackType はこれに揃えるのが規約。 */
  baseAttackType?: string;
  /** 職業 Tier（1/2）。power 表の Tier を決める。未指定は 1 扱い。 */
  tier?: number;
  /** 魔物の種族。 */
  tribe?: string;
  /** 魔物の属性傾向（耐性から導出）。 */
  elementAffinity?: string[];
};

export type SkillBalanceContext = {
  /** 既存スキル（id 重複・分布参照用）。 */
  existingSkills: Record<string, unknown>;
  /** skills.json のキー集合（id 重複検証用）。 */
  skillIds: Set<string>;
  /** 紐付き先。あれば owner-fit を検証する。 */
  owner?: SkillOwner;
};

export const VALID_SKILL_TYPES = ['PHYSICAL', 'MAGICAL'] as const;
export const VALID_SKILL_ELEMENTS = [
  'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE',
] as const;
export const VALID_ATTACK_TYPES = ['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON'] as const;
export const VALID_TARGET_TYPES = ['SINGLE', 'ALL_ENEMIES'] as const;

type Range = [number, number];
type Band = { minCost: number; maxCost: number; t1: Range; t2: Range };

/**
 * 設計書 19 §2.2 power 表。分類ごとに cost 帯と Tier1/Tier2 の power 範囲を持つ。
 * 物理と魔法で cost 帯の境界が異なる点に注意。
 */
export const POWER_TABLE: Record<string, Band[]> = {
  PHYS_SINGLE: [
    { minCost: 4, maxCost: 8, t1: [1.2, 1.55], t2: [1.4, 1.8] },
    { minCost: 9, maxCost: 14, t1: [1.45, 1.8], t2: [1.65, 2.1] },
    { minCost: 15, maxCost: Infinity, t1: [1.7, 2.1], t2: [1.9, 2.4] },
  ],
  PHYS_AOE: [
    { minCost: 4, maxCost: 8, t1: [0.9, 1.3], t2: [1.1, 1.5] },
    { minCost: 9, maxCost: 14, t1: [1.25, 1.65], t2: [1.45, 1.9] },
    { minCost: 15, maxCost: Infinity, t1: [1.5, 1.9], t2: [1.7, 2.15] },
  ],
  MAGIC_SINGLE: [
    { minCost: 8, maxCost: 12, t1: [1.4, 1.7], t2: [1.55, 1.9] },
    { minCost: 13, maxCost: 18, t1: [1.6, 2.0], t2: [1.8, 2.25] },
    { minCost: 19, maxCost: Infinity, t1: [1.9, 2.3], t2: [2.1, 2.5] },
  ],
  MAGIC_AOE: [
    { minCost: 8, maxCost: 12, t1: [1.1, 1.45], t2: [1.25, 1.6] },
    { minCost: 13, maxCost: 18, t1: [1.3, 1.7], t2: [1.5, 1.95] },
    { minCost: 19, maxCost: Infinity, t1: [1.55, 2.0], t2: [1.75, 2.2] },
  ],
};

/** attackType → effectKey の末尾部。 */
function attackTypeToEffectPart(attackType: string): string {
  return attackType.toLowerCase();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** type + targetType から power 表の分類キーを得る。 */
export function classifySkill(type: string, targetType: string): keyof typeof POWER_TABLE | null {
  const phys = type === 'PHYSICAL';
  const mag = type === 'MAGICAL';
  const aoe = targetType === 'ALL_ENEMIES';
  if (phys) return aoe ? 'PHYS_AOE' : 'PHYS_SINGLE';
  if (mag) return aoe ? 'MAGIC_AOE' : 'MAGIC_SINGLE';
  return null;
}

/** 分類 + mpCost に対応する cost 帯（Band）を返す。 */
export function findBand(classification: keyof typeof POWER_TABLE, mpCost: number): Band | null {
  const bands = POWER_TABLE[classification];
  for (const b of bands) {
    if (mpCost >= b.minCost && mpCost <= b.maxCost) return b;
  }
  return null;
}

export function validateSkillDraft(draft: unknown, ctx: SkillBalanceContext): SkillValidationResult {
  const findings: SkillValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['id', 'name', 'description']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }
  if (typeof draft.id === 'string' && !/^[a-z][a-z0-9_]*$/.test(draft.id)) {
    fail('id', `id "${draft.id}" は snake_case である必要があります。`);
  }
  if (typeof draft.id === 'string' && ctx.skillIds.has(draft.id)) {
    fail('id', `id "${draft.id}" は既存スキルと重複しています。`);
  }

  // --- 列挙 ---
  const type = draft.type;
  const targetType = draft.targetType;
  const attackType = draft.attackType;
  const element = draft.element;
  if (typeof type !== 'string' || !VALID_SKILL_TYPES.includes(type as (typeof VALID_SKILL_TYPES)[number])) {
    fail('type', `type は ${VALID_SKILL_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(type)}）。`);
  }
  if (typeof element !== 'string' || !VALID_SKILL_ELEMENTS.includes(element as (typeof VALID_SKILL_ELEMENTS)[number])) {
    fail('element', `element が不正です（現在: ${String(element)}）。`);
  }
  if (
    typeof attackType !== 'string' ||
    !VALID_ATTACK_TYPES.includes(attackType as (typeof VALID_ATTACK_TYPES)[number])
  ) {
    fail('attackType', `attackType は ${VALID_ATTACK_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(attackType)}）。`);
  }
  if (
    typeof targetType !== 'string' ||
    !VALID_TARGET_TYPES.includes(targetType as (typeof VALID_TARGET_TYPES)[number])
  ) {
    fail('targetType', `targetType は ${VALID_TARGET_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(targetType)}）。`);
  }

  // --- mpCost / power ---
  const mpCost = getNum(draft, 'mpCost');
  const power = getNum(draft, 'power');
  if (mpCost === null || mpCost < 0 || !Number.isInteger(mpCost)) {
    fail('mpCost', 'mpCost は 0 以上の整数である必要があります。');
  }
  if (power === null || power <= 0) {
    fail('power', 'power は正の数である必要があります。');
  } else if (power < 0.5 || power > 5) {
    // 明らかなスケール外（0〜1分数や桁誤り）
    fail('power', `power=${power} は想定レンジ外です。倍率は概ね 0.9〜2.5 です。`);
  }

  // --- power 表（設計書19）による検閲 ---
  const ownerTier = ctx.owner?.tier === 2 ? 2 : 1;
  if (
    typeof type === 'string' &&
    typeof targetType === 'string' &&
    mpCost !== null &&
    power !== null &&
    mpCost > 0 // 通常攻撃(0)は対象外
  ) {
    const cls = classifySkill(type, targetType);
    if (cls) {
      const band = findBand(cls, mpCost);
      if (!band) {
        warn(
          'mpCost',
          `${cls} の mpCost=${mpCost} は設計書19のコスト帯に該当しません（${cls.startsWith('MAGIC') ? '魔法は8以上' : '物理は4以上'}）。`,
        );
      } else {
        const [lo, hi] = ownerTier === 2 ? band.t2 : band.t1;
        if (power < lo || power > hi) {
          fail(
            'power',
            `${cls} / mpCost ${mpCost} / Tier${ownerTier} の power 範囲は ${lo}〜${hi}（設計書19）。現在 ${power} は範囲外です。`,
          );
        } else {
          pass('power', `power ${power} は ${cls}/Tier${ownerTier} 範囲 ${lo}〜${hi} 内 OK`);
        }
      }
    }
  }

  // --- effectKey 規約（element_attackType 小文字） ---
  if (typeof element === 'string' && typeof attackType === 'string') {
    const expected = `${element.toLowerCase()}_${attackTypeToEffectPart(attackType)}`;
    if (draft.effectKey !== undefined && draft.effectKey !== expected) {
      warn('effectKey', `effectKey は "${expected}"（element_attackType）が規約です。現在: "${String(draft.effectKey)}"。`);
    }
  }

  // --- owner-fit（紐付き先との整合・ユーザー要望の核心） ---
  const owner = ctx.owner;
  if (owner) {
    if (owner.kind === 'job') {
      // type は職業 category に一致すべき（剣士=PHYSICAL に MAGICAL は不可）
      if (owner.category && typeof type === 'string' && type !== owner.category) {
        fail(
          'type',
          `紐付き先「${owner.displayName ?? owner.id}」は ${owner.category} 系のため、スキル type も ${owner.category} にする必要があります（現在: ${type}）。`,
        );
      }
      // attackType は職業 baseAttackType に揃えるのが規約（柔軟性のため WARN）
      if (owner.baseAttackType && typeof attackType === 'string' && attackType !== owner.baseAttackType) {
        warn(
          'attackType',
          `紐付き先「${owner.displayName ?? owner.id}」の基礎攻撃種別は ${owner.baseAttackType} です。attackType を揃えると一貫します（現在: ${attackType}）。`,
        );
      }
      if (
        owner.category &&
        typeof type === 'string' &&
        type === owner.category &&
        (!owner.baseAttackType || attackType === owner.baseAttackType)
      ) {
        pass('owner', `紐付き先「${owner.displayName ?? owner.id}」と整合 OK`);
      }
    } else if (owner.kind === 'monster') {
      // 魔物は category を持たないため、属性傾向との整合のみ（弱点属性は不自然 → WARN は呼び出し側で付与可）
      if (owner.elementAffinity && owner.elementAffinity.length > 0 && typeof element === 'string') {
        if (element !== 'NONE' && !owner.elementAffinity.includes(element)) {
          warn(
            'element',
            `魔物「${owner.displayName ?? owner.id}」の属性傾向 ${owner.elementAffinity.join('/')} と element ${element} が一致しません。素性に合う属性を推奨します。`,
          );
        }
      }
    }
  }

  // R-3: 未知トップレベルフィールドを WARN 検出
  findings.push(...findUnknownFields(draft, 'skills'));
  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・列挙・power 表・owner 整合すべて問題ありません。');
  }
  return { ok, findings };
}

export function skillFindingsToFeedback(findings: SkillValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
