/**
 * ステージ草稿の決定論的バリデータ（LLM 不使用の純関数）。
 *
 * ステージは複合オブジェクトで参照が多い:
 *   - waves[].enemyIds → enemies.json
 *   - unlockRequires → 他 stage
 *   - rewards.dropTable.itemId → items.json / materials.json
 *   - chapter+area → areas.json（"ch{chapter}_area{area}"）
 * これらの参照整合 + 構造 + 列挙 + 難易度/報酬の整合を機械検証する。
 * 紐付き先はエリア（chapter/area）。
 */

import { findUnknownFields } from './knownFields';

export type StageValidationLevel = 'PASS' | 'WARN' | 'FAIL';
export type StageValidationFinding = { level: StageValidationLevel; field: string; message: string };
export type StageValidationResult = { ok: boolean; findings: StageValidationFinding[] };

export type StageBalanceContext = {
  existingStages: Record<string, unknown>;
  stageIds: Set<string>;
  enemyIds: Set<string>;
  /** enemyId → tier（BOSS ノードのボス内包チェック用）。 */
  enemyTiers: Record<string, string>;
  itemIds: Set<string>;
  materialIds: Set<string>;
  areaIds: Set<string>;
};

export const VALID_NODE_TYPES = ['SAFE', 'DUNGEON', 'BOSS'] as const;
export const VALID_ELEMENTS = [
  'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE',
] as const;
export const VALID_WAVE_ROLES = ['WARMUP', 'SHIELD', 'ELITE', 'BOSS'] as const;
export const VALID_AREA_GIMMICKS = ['SLIP_DAMAGE', 'STATUS_AILMENT', 'NONE'] as const;
export const VALID_DROP_TYPES = ['WEAPON', 'RESIDUE', 'MATERIAL', 'MONSTER', 'CONSUMABLE'] as const;
const VALID_STAT_SCALE_KEYS = ['hp', 'atk', 'def'] as const;
const STAT_SCALE_WARN_THRESHOLD = 3;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function validateWaveStatScale(
  statScale: unknown,
  field: string,
  fail: (field: string, message: string) => void,
  warn: (field: string, message: string) => void,
): void {
  if (statScale === undefined) return;
  if (!isRecord(statScale)) {
    fail(field, 'statScale は { hp?: number; atk?: number; def?: number } のオブジェクトである必要があります。');
    return;
  }

  const allowed = new Set<string>(VALID_STAT_SCALE_KEYS);
  for (const key of Object.keys(statScale)) {
    if (!allowed.has(key)) {
      fail(`${field}.${key}`, 'statScale は hp / atk / def のみ指定できます。');
    }
  }

  for (const key of VALID_STAT_SCALE_KEYS) {
    const value = statScale[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      fail(`${field}.${key}`, 'statScale の倍率は 0 より大きい有限数である必要があります。');
      continue;
    }
    if (value > STAT_SCALE_WARN_THRESHOLD) {
      warn(`${field}.${key}`, `statScale.${key}=${value} は ${STAT_SCALE_WARN_THRESHOLD} 倍を超えています。高難易度用途なら問題ありませんが、通常章では確認してください。`);
    }
  }
}

/** area id 規約: ch{chapter}_area{area} */
export function areaIdFor(chapter: unknown, area: unknown): string {
  return `ch${String(chapter)}_area${String(area)}`;
}

/** 既存ステージから難易度→報酬の概算レンジを学習する。 */
export function deriveRewardBands(existingStages: Record<string, unknown>): {
  exp: { min: number; max: number } | null;
  gold: { min: number; max: number } | null;
} {
  let exp: { min: number; max: number } | null = null;
  let gold: { min: number; max: number } | null = null;
  for (const s of Object.values(existingStages)) {
    if (!isRecord(s)) continue;
    const rewards = isRecord(s.rewards) ? s.rewards : null;
    if (!rewards) continue;
    const e = getNum(rewards, 'baseExp');
    const g = getNum(rewards, 'baseGold');
    if (e !== null && e > 0) exp = exp ? { min: Math.min(exp.min, e), max: Math.max(exp.max, e) } : { min: e, max: e };
    if (g !== null && g > 0) gold = gold ? { min: Math.min(gold.min, g), max: Math.max(gold.max, g) } : { min: g, max: g };
  }
  return { exp, gold };
}

export function validateStageDraft(draft: unknown, ctx: StageBalanceContext): StageValidationResult {
  const findings: StageValidationFinding[] = [];
  const fail = (field: string, message: string) => findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) => findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) => findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列 ---
  for (const f of ['id', 'name', 'nameJa', 'nameEn', 'chapterName', 'description']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }
  if (typeof draft.id === 'string' && !/^[a-z][a-z0-9_]*$/.test(draft.id)) {
    fail('id', `id "${draft.id}" は snake_case である必要があります。`);
  }
  if (typeof draft.id === 'string' && ctx.stageIds.has(draft.id)) {
    fail('id', `id "${draft.id}" は既存ステージと重複しています。`);
  }

  // --- chapter / area / area 参照 ---
  const chapter = draft.chapter;
  const area = draft.area;
  if (!Number.isInteger(chapter) || Number(chapter) < 1) {
    fail('chapter', 'chapter は 1 以上の整数である必要があります。');
  }
  if (!Number.isInteger(area) || Number(area) < 1) {
    fail('area', 'area は 1 以上の整数である必要があります。');
  }
  if (Number.isInteger(chapter) && Number.isInteger(area)) {
    const aid = areaIdFor(chapter, area);
    if (!ctx.areaIds.has(aid)) {
      fail('area', `参照先エリア "${aid}" が areas.json に存在しません。先にエリアを作成してください。`);
    } else {
      pass('area', `エリア参照 "${aid}" OK`);
    }
  }

  // --- nodeType / element / areaGimmick ---
  const nodeType = draft.nodeType;
  if (typeof nodeType !== 'string' || !VALID_NODE_TYPES.includes(nodeType as (typeof VALID_NODE_TYPES)[number])) {
    fail('nodeType', `nodeType は ${VALID_NODE_TYPES.join(' / ')} のいずれかである必要があります（現在: ${String(nodeType)}）。`);
  }
  if (typeof draft.element !== 'string' || !VALID_ELEMENTS.includes(draft.element as (typeof VALID_ELEMENTS)[number])) {
    fail('element', `element が不正です（現在: ${String(draft.element)}）。`);
  }
  if (draft.areaGimmick !== undefined) {
    if (typeof draft.areaGimmick !== 'string' || !VALID_AREA_GIMMICKS.includes(draft.areaGimmick as (typeof VALID_AREA_GIMMICKS)[number])) {
      fail('areaGimmick', `areaGimmick は ${VALID_AREA_GIMMICKS.join(' / ')} のいずれかである必要があります。`);
    }
  }

  // --- difficulty ---
  const difficulty = getNum(draft, 'difficulty');
  if (difficulty === null || difficulty < 0 || !Number.isInteger(difficulty)) {
    fail('difficulty', 'difficulty は 0 以上の整数である必要があります。');
  }

  // --- waves / waveCount ---
  const isSafe = nodeType === 'SAFE';
  const waves = draft.waves;
  const waveCount = getNum(draft, 'waveCount');
  if (!Array.isArray(waves)) {
    fail('waves', 'waves は配列である必要があります。');
  } else {
    if (waveCount !== null && waveCount !== waves.length) {
      fail('waveCount', `waveCount(${waveCount}) と waves の数(${waves.length})が一致しません。`);
    }
    if (isSafe && waves.length > 0) {
      warn('waves', 'SAFE ノードに waves は不要です。');
    }
    if (!isSafe && waves.length === 0) {
      fail('waves', `${String(nodeType)} ノードには 1 つ以上の wave が必要です。`);
    }
    let hasBossTierEnemy = false;
    waves.forEach((w, i) => {
      if (!isRecord(w)) {
        fail(`waves[${i}]`, 'wave がオブジェクトではありません。');
        return;
      }
      if (typeof w.label !== 'string' || w.label.trim() === '') fail(`waves[${i}].label`, 'label は非空の文字列である必要があります。');
      if (typeof w.intent !== 'string' || w.intent.trim() === '') warn(`waves[${i}].intent`, 'intent（設計意図）を記述すると編集者に親切です。');
      if (typeof w.role !== 'string' || !VALID_WAVE_ROLES.includes(w.role as (typeof VALID_WAVE_ROLES)[number])) {
        fail(`waves[${i}].role`, `role は ${VALID_WAVE_ROLES.join(' / ')} のいずれかである必要があります（現在: ${String(w.role)}）。`);
      }
      validateWaveStatScale(w.statScale, `waves[${i}].statScale`, fail, warn);
      const eids = w.enemyIds;
      if (!Array.isArray(eids) || eids.length === 0) {
        fail(`waves[${i}].enemyIds`, 'enemyIds は 1 つ以上必要です。');
      } else {
        for (const eid of eids) {
          if (typeof eid !== 'string' || !ctx.enemyIds.has(eid)) {
            fail(`waves[${i}].enemyIds`, `敵 "${String(eid)}" が enemies.json に存在しません。`);
          } else {
            if (ctx.enemyTiers[eid] === 'BOSS') hasBossTierEnemy = true;
          }
        }
      }
    });
    // BOSS ノードはボス級の敵を内包すべき
    if (nodeType === 'BOSS' && waves.length > 0 && !hasBossTierEnemy) {
      warn('waves', 'BOSS ノードですが BOSS tier の敵が waves に含まれていません。ボスを配置してください。');
    }
  }

  // --- unlockRequires ---
  const unlock = draft.unlockRequires;
  if (!Array.isArray(unlock)) {
    fail('unlockRequires', 'unlockRequires は配列である必要があります（無ければ []）。');
  } else {
    for (const u of unlock) {
      if (typeof u !== 'string') {
        fail('unlockRequires', 'unlockRequires の要素は文字列である必要があります。');
      } else if (u === draft.id) {
        fail('unlockRequires', '自分自身を unlockRequires に含めることはできません。');
      } else if (!ctx.stageIds.has(u)) {
        fail('unlockRequires', `解放条件のステージ "${u}" が存在しません。`);
      } else {
        pass('unlockRequires', `解放条件 "${u}" OK`);
      }
    }
  }

  // --- rewards ---
  const rewards = draft.rewards;
  if (!isRecord(rewards)) {
    fail('rewards', 'rewards が存在しません。');
  } else {
    const baseExp = getNum(rewards, 'baseExp');
    const baseGold = getNum(rewards, 'baseGold');
    if (baseExp === null || baseExp < 0) fail('rewards.baseExp', 'baseExp は 0 以上の数値である必要があります。');
    if (baseGold === null || baseGold < 0) fail('rewards.baseGold', 'baseGold は 0 以上の数値である必要があります。');
    if (!isSafe && baseExp !== null && baseExp === 0) warn('rewards.baseExp', '戦闘ノードの baseExp が 0 です。報酬を設定してください。');
    // 報酬レンジ（既存からの逸脱を WARN）
    const bands = deriveRewardBands(ctx.existingStages);
    if (!isSafe && baseExp !== null && baseExp > 0 && bands.exp) {
      if (baseExp < bands.exp.min * 0.3 || baseExp > bands.exp.max * 3) {
        warn('rewards.baseExp', `baseExp ${baseExp} は既存レンジ ${bands.exp.min}〜${bands.exp.max} から大きく外れています。進行カーブを確認してください。`);
      }
    }
    const dropTable = rewards.dropTable;
    if (dropTable !== undefined) {
      if (!Array.isArray(dropTable)) {
        fail('rewards.dropTable', 'dropTable は配列である必要があります。');
      } else {
        dropTable.forEach((drop, i) => {
          if (!isRecord(drop)) {
            fail(`rewards.dropTable[${i}]`, 'ドロップエントリがオブジェクトではありません。');
            return;
          }
          const type = drop.type;
          const rate = getNum(drop, 'rate');
          if (typeof type !== 'string' || !VALID_DROP_TYPES.includes(type as (typeof VALID_DROP_TYPES)[number])) {
            fail(`rewards.dropTable[${i}].type`, `type は ${VALID_DROP_TYPES.join(' / ')} のいずれかである必要があります。`);
          }
          if (rate === null || rate < 0 || rate > 1) {
            fail(`rewards.dropTable[${i}].rate`, `rate は 0〜1 の数値である必要があります（現在: ${String(drop.rate)}）。`);
          }
          const itemId = drop.itemId;
          if (type === 'WEAPON' || type === 'CONSUMABLE') {
            if (typeof itemId !== 'string' || !ctx.itemIds.has(itemId)) {
              fail(`rewards.dropTable[${i}].itemId`, `${type} 参照 "${String(itemId)}" が items.json に存在しません。`);
            } else {
              pass(`rewards.dropTable[${i}]`, `ドロップ参照 "${itemId}" OK`);
            }
          } else if (type === 'MATERIAL') {
            if (typeof itemId !== 'string' || !ctx.materialIds.has(itemId)) {
              fail(`rewards.dropTable[${i}].itemId`, `MATERIAL 参照 "${String(itemId)}" が materials.json に存在しません。`);
            } else {
              pass(`rewards.dropTable[${i}]`, `ドロップ参照 "${itemId}" OK`);
            }
          }
        });
      }
    }
  }

  // --- position ---
  const position = draft.position;
  if (!isRecord(position) || getNum(position, 'x') === null || getNum(position, 'y') === null) {
    fail('position', 'position.x / position.y は数値である必要があります。');
  }

  // R-3: 未知トップレベルフィールドを WARN 検出
  findings.push(...findUnknownFields(draft, 'stages'));
  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・参照整合・列挙すべて問題ありません。');
  }
  return { ok, findings };
}

export function stageFindingsToFeedback(findings: StageValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems.map((f) => `- [${f.level}] ${f.field}: ${f.message}`).join('\n');
}
