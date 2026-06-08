/**
 * 武器草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 設計書 13_武器システム.md + 92_IMP11（レアリティ別サブオプション枠）を実装する。
 * 武器は他マスターを参照しない（enemies/stages から被参照される側）が、
 * **レアリティが構成（サブオプション枠・パッシブ複雑度）を決める**ため、
 * rarity を主コンテキストとして整合を検閲する。
 */

export type WeaponValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type WeaponValidationFinding = { level: WeaponValidationLevel; field: string; message: string };
export type WeaponValidationResult = { ok: boolean; findings: WeaponValidationFinding[] };

export type WeaponBalanceContext = {
  existingItems: Record<string, unknown>;
  itemIds: Set<string>;
  /** 想定レアリティ（指定されていれば draft.rarity と一致を要求）。 */
  expectedRarity?: string;
};

export const VALID_WEAPON_RARITIES = ['R', 'SR', 'SSR', 'UR'] as const;
export const VALID_ARCHETYPES = ['LOW', 'MID', 'HIGH', 'MYTHIC'] as const;
export const VALID_SYSTEM_TAGS = ['DEMON_MODE', 'SOUL_SHATTER', 'ACTION_VALUE', 'SHIELD_PIERCE', 'GIANT_KILLING'] as const;

/** 通常サブオプション枠の型。 */
export const NORMAL_SUBOPTION_TYPES = [
  'ATK%', 'ATK_FLAT', 'CRIT_RATE', 'CRIT_DMG', 'EFFECT_HIT', 'EFFECT_RES', 'DEF%',
] as const;
/** 固定属性枠の型（8属性 DMG_BOOST）。 */
export const ELEMENT_SUBOPTION_TYPES = [
  'FIRE_DMG_BOOST', 'WATER_DMG_BOOST', 'THUNDER_DMG_BOOST', 'EARTH_DMG_BOOST',
  'WIND_DMG_BOOST', 'ICE_DMG_BOOST', 'LIGHT_DMG_BOOST', 'DARK_DMG_BOOST',
] as const;

/** レアリティ別のサブオプション枠（設計書92 §2.1）: 通常枠 / 固定属性枠。 */
export const RARITY_SUBOPTION_SLOTS: Record<string, { normal: number; element: number }> = {
  R: { normal: 1, element: 0 },
  SR: { normal: 1, element: 0 },
  SSR: { normal: 1, element: 1 },
  UR: { normal: 1, element: 1 },
};

/** rank（魂の共鳴）段階数 = パッシブ values 配列長。 */
const PASSIVE_VALUES_LEN = 5;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function isNormalSub(t: string): boolean {
  return (NORMAL_SUBOPTION_TYPES as readonly string[]).includes(t);
}
function isElementSub(t: string): boolean {
  return (ELEMENT_SUBOPTION_TYPES as readonly string[]).includes(t);
}

function validatePassive(
  passive: unknown,
  slot: 'passiveA' | 'passiveB',
  push: (level: WeaponValidationLevel, field: string, msg: string) => void,
): void {
  if (!isRecord(passive)) {
    push('FAIL', slot, `${slot} が存在しません。武器は2スロットのパッシブ（Effect A/B）を持ちます。`);
    return;
  }
  if (typeof passive.nameJa !== 'string' || passive.nameJa.trim() === '') {
    push('FAIL', `${slot}.nameJa`, 'nameJa は非空の文字列である必要があります。');
  }
  if (typeof passive.descTemplate !== 'string' || passive.descTemplate.trim() === '') {
    push('FAIL', `${slot}.descTemplate`, 'descTemplate は非空の文字列である必要があります。');
  } else if (!passive.descTemplate.includes('{value}')) {
    push('WARN', `${slot}.descTemplate`, 'descTemplate に {value} プレースホルダがありません。ランク別の値が表示されません。');
  }
  if (!Array.isArray(passive.values)) {
    push('FAIL', `${slot}.values`, 'values は数値配列である必要があります。');
  } else {
    if (passive.values.length !== PASSIVE_VALUES_LEN) {
      push('WARN', `${slot}.values`, `values はランクⅠ〜Ⅴの ${PASSIVE_VALUES_LEN} 要素が標準です（現在: ${passive.values.length}）。`);
    }
    if (passive.values.some((v) => typeof v !== 'number')) {
      push('FAIL', `${slot}.values`, 'values の要素はすべて数値である必要があります。');
    }
  }
  if (passive.systemTag !== undefined && passive.systemTag !== null) {
    if (typeof passive.systemTag !== 'string' || !VALID_SYSTEM_TAGS.includes(passive.systemTag as (typeof VALID_SYSTEM_TAGS)[number])) {
      push('FAIL', `${slot}.systemTag`, `systemTag は ${VALID_SYSTEM_TAGS.join(' / ')} のいずれかである必要があります（現在: ${String(passive.systemTag)}）。`);
    }
  }
}

export function validateWeaponDraft(draft: unknown, ctx: WeaponBalanceContext): WeaponValidationResult {
  const findings: WeaponValidationFinding[] = [];
  const push = (level: WeaponValidationLevel, field: string, message: string) => findings.push({ level, field, message });
  const fail = (field: string, message: string) => push('FAIL', field, message);
  const warn = (field: string, message: string) => push('WARN', field, message);
  const pass = (field: string, message: string) => push('PASS', field, message);

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
  if (typeof draft.id === 'string' && ctx.itemIds.has(draft.id)) {
    fail('id', `id "${draft.id}" は既存アイテムと重複しています。`);
  }

  // --- type ---
  if (draft.type !== 'WEAPON') {
    fail('type', `type は "WEAPON" である必要があります（現在: ${String(draft.type)}）。`);
  }

  // --- rarity / weaponRarity / archetype ---
  const rarity = draft.rarity;
  const rarityValid = typeof rarity === 'string' && VALID_WEAPON_RARITIES.includes(rarity as (typeof VALID_WEAPON_RARITIES)[number]);
  if (!rarityValid) {
    fail('rarity', `rarity は ${VALID_WEAPON_RARITIES.join(' / ')} のいずれかである必要があります（現在: ${String(rarity)}）。`);
  }
  if (ctx.expectedRarity && rarity !== ctx.expectedRarity) {
    fail('rarity', `指定レアリティ ${ctx.expectedRarity} と一致しません（現在: ${String(rarity)}）。`);
  }
  if (draft.weaponRarity !== undefined && draft.weaponRarity !== rarity) {
    warn('weaponRarity', `weaponRarity は rarity と一致させてください（rarity=${String(rarity)} / weaponRarity=${String(draft.weaponRarity)}）。`);
  }
  const archetype = draft.archetype;
  if (typeof archetype !== 'string' || !VALID_ARCHETYPES.includes(archetype as (typeof VALID_ARCHETYPES)[number])) {
    fail('archetype', `archetype は ${VALID_ARCHETYPES.join(' / ')} のいずれかである必要があります（現在: ${String(archetype)}）。`);
  } else if (rarity === 'UR' && archetype !== 'MYTHIC') {
    warn('archetype', 'UR は MYTHIC アーキタイプが標準です（規格外の最終装備）。');
  }

  // --- rank / ilv ---
  const rank = getNum(draft, 'rank');
  if (rank === null || rank < 1 || rank > 5 || !Number.isInteger(rank)) {
    fail('rank', 'rank は 1〜5 の整数である必要があります（魂の共鳴）。');
  }
  const ilv = getNum(draft, 'ilv');
  if (ilv === null || ilv < 0) {
    fail('ilv', 'ilv は 0 以上の数値である必要があります。');
  }

  // --- subOptions（レアリティ別の枠構成・最重要） ---
  const subOptions = draft.subOptions;
  if (!Array.isArray(subOptions)) {
    fail('subOptions', 'subOptions は配列である必要があります。');
  } else {
    let normalCount = 0;
    let elementCount = 0;
    subOptions.forEach((s, i) => {
      if (!isRecord(s)) {
        fail(`subOptions[${i}]`, 'サブオプションがオブジェクトではありません。');
        return;
      }
      const t = s.type;
      const v = getNum(s, 'value');
      if (typeof t !== 'string' || (!isNormalSub(t) && !isElementSub(t))) {
        fail(`subOptions[${i}].type`, `type "${String(t)}" が不正です（通常枠 ${NORMAL_SUBOPTION_TYPES.join('/')} / 属性枠 *_DMG_BOOST）。`);
      } else {
        if (isNormalSub(t)) normalCount++;
        else elementCount++;
      }
      if (v === null || v <= 0) {
        fail(`subOptions[${i}].value`, 'value は正の数である必要があります。');
      } else if (v > 100) {
        fail(`subOptions[${i}].value`, `value=${v} は過大です。%表記（例 ATK% 6.2）になっているか確認してください。`);
      } else if (v < 1) {
        warn(`subOptions[${i}].value`, `value=${v} は%表記としては小さすぎる可能性があります（0〜1分数スケール誤り？）。`);
      }
    });
    // レアリティ別の枠数チェック
    if (rarityValid) {
      const slots = RARITY_SUBOPTION_SLOTS[rarity as string];
      if (normalCount !== slots.normal) {
        fail('subOptions', `${rarity} の通常枠は ${slots.normal} 個です（現在: ${normalCount}）。設計書92の枠数に合わせてください。`);
      }
      if (elementCount !== slots.element) {
        fail('subOptions', `${rarity} の固定属性枠は ${slots.element} 個です（現在: ${elementCount}）。${slots.element === 0 ? 'R/SR に属性枠は付けません。' : 'SSR/UR は属性枠を1つ付けます。'}`);
      }
      if (normalCount === slots.normal && elementCount === slots.element) {
        pass('subOptions', `${rarity} のサブオプション枠構成 OK（通常${normalCount}/属性${elementCount}）`);
      }
    }
  }

  // --- passiveA / passiveB（2スロット必須） ---
  validatePassive(draft.passiveA, 'passiveA', push);
  validatePassive(draft.passiveB, 'passiveB', push);

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・レアリティ枠構成・パッシブすべて問題ありません。');
  }
  return { ok, findings };
}

export function weaponFindingsToFeedback(findings: WeaponValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
