/**
 * 味方魔物草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * 味方魔物（monsters.json）はプレイヤー所持の使役モンスターの雛形。
 * 構造は { id(key), name, tribe, cost, stats, resistances }。
 * cost が戦力（stat budget）を決めるため、実データから cost 別の stat 帯を学習して検閲する。
 * 敵(enemies)とは別スケール（プレイヤー側は高め）なので、enemies 帯は使わず monsters から学習する。
 */

import { findUnknownFields } from './knownFields';

export type MonsterValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type MonsterValidationFinding = { level: MonsterValidationLevel; field: string; message: string };
export type MonsterValidationResult = { ok: boolean; findings: MonsterValidationFinding[] };

export type MonsterBalanceContext = {
  existingMonsters: Record<string, unknown>;
  monsterIds: Set<string>;
  /** 想定 cost（指定されていれば draft.cost と一致を要求）。 */
  expectedCost?: number;
};

export const VALID_TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'] as const;
export const VALID_ELEMENTS = [
  'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE',
] as const;
export const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'] as const;
/** cost 帯チェック対象の主要ステータス。 */
const BAND_CHECK_STATS = ['hp', 'atk', 'def', 'spd'] as const;
const BAND_TOLERANCE = 0.35;

type StatBand = { min: number; max: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 既存魔物から cost ごとの主要ステータス帯（min/max）を学習する。 */
export function deriveCostBands(existingMonsters: Record<string, unknown>): Record<number, Record<string, StatBand>> {
  const bands: Record<number, Record<string, StatBand>> = {};
  for (const m of Object.values(existingMonsters)) {
    if (!isRecord(m)) continue;
    const cost = getNum(m, 'cost');
    const stats = isRecord(m.stats) ? m.stats : null;
    if (cost === null || !stats) continue;
    bands[cost] ??= {};
    for (const stat of BAND_CHECK_STATS) {
      const val = getNum(stats, stat);
      if (val === null) continue;
      const b = bands[cost][stat];
      bands[cost][stat] = b ? { min: Math.min(b.min, val), max: Math.max(b.max, val) } : { min: val, max: val };
    }
  }
  return bands;
}

export function validateMonsterDraft(draft: unknown, ctx: MonsterBalanceContext): MonsterValidationResult {
  const findings: MonsterValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- id / name ---
  if (typeof draft.id !== 'string' || draft.id.trim() === '') {
    fail('id', 'id（マスターキー）は非空の文字列である必要があります。');
  } else {
    if (!/^[a-z][a-z0-9_]*$/.test(draft.id)) fail('id', `id "${draft.id}" は snake_case である必要があります。`);
    if (ctx.monsterIds.has(draft.id)) fail('id', `id "${draft.id}" は既存魔物と重複しています。`);
  }
  if (typeof draft.name !== 'string' || draft.name.trim() === '') {
    fail('name', 'name は非空の文字列である必要があります。');
  }

  // --- tribe ---
  if (typeof draft.tribe !== 'string' || !VALID_TRIBES.includes(draft.tribe as (typeof VALID_TRIBES)[number])) {
    fail('tribe', `tribe は ${VALID_TRIBES.join(' / ')} のいずれかである必要があります（現在: ${String(draft.tribe)}）。`);
  }

  // --- cost ---
  const cost = getNum(draft, 'cost');
  if (cost === null || cost < 1 || !Number.isInteger(cost)) {
    fail('cost', 'cost は 1 以上の整数である必要があります。');
  } else if (ctx.expectedCost !== undefined && cost !== ctx.expectedCost) {
    fail('cost', `指定 cost ${ctx.expectedCost} と一致しません（現在: ${cost}）。`);
  } else if (cost > 5) {
    warn('cost', `cost ${cost} は高めです（既存は 1〜3）。編成コスト設計を確認してください。`);
  }

  // --- stats ---
  if (!isRecord(draft.stats)) {
    fail('stats', 'stats オブジェクトが存在しません。');
  } else {
    const stats = draft.stats;
    for (const key of STAT_KEYS) {
      const v = getNum(stats, key);
      if (v === null) fail(`stats.${key}`, `stats.${key} は数値である必要があります。`);
      else if (v < 0) fail(`stats.${key}`, `stats.${key} は 0 以上である必要があります。`);
    }
    // critDmg スケール（%表記。150前後）
    const critDmg = getNum(stats, 'critDmg');
    if (critDmg !== null && critDmg > 0 && critDmg < 100) {
      fail('stats.critDmg', `critDmg は%表記です（150前後）。${critDmg} はスケール誤りの可能性が高い。`);
    }
    // cost 別 stat 帯（実データ学習）
    if (cost !== null) {
      const bands = deriveCostBands(ctx.existingMonsters)[cost];
      if (bands) {
        for (const stat of BAND_CHECK_STATS) {
          const v = getNum(stats, stat);
          const band = bands[stat];
          if (v === null || !band) continue;
          const lo = band.min * (1 - BAND_TOLERANCE);
          const hi = band.max * (1 + BAND_TOLERANCE);
          if (v < lo || v > hi) {
            warn(
              `stats.${stat}`,
              `cost ${cost} の ${stat} は実データ帯 ${band.min}〜${band.max}（許容 ${Math.floor(lo)}〜${Math.ceil(hi)}）に対し ${v}。コストと戦力の釣り合いを確認してください。`,
            );
          }
        }
      }
    }
  }

  // --- resistances ---
  const resistances = draft.resistances;
  if (resistances !== undefined) {
    if (!isRecord(resistances)) {
      fail('resistances', 'resistances はオブジェクトである必要があります。');
    } else {
      for (const [el, v] of Object.entries(resistances)) {
        if (!VALID_ELEMENTS.includes(el as (typeof VALID_ELEMENTS)[number])) {
          fail('resistances', `resistances のキー "${el}" は不正な属性です。`);
        }
        if (typeof v !== 'number') {
          fail('resistances', `resistances.${el} は数値（負=弱点 / 正=耐性）である必要があります。`);
        } else if (v !== 0 && Math.abs(v) < 1) {
          warn('resistances', `resistances.${el}=${v} は%表記としては小さすぎます（既存は ±10〜30 の整数）。`);
        }
      }
    }
  }

  // R-3: 未知トップレベルフィールドを WARN 検出
  findings.push(...findUnknownFields(draft, 'monsters'));
  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・列挙・cost 帯・スケールすべて問題ありません。');
  }
  return { ok, findings };
}

export function monsterFindingsToFeedback(findings: MonsterValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
