/**
 * エネミー草稿の決定論的バリデータ。
 *
 * 設計思想（docs/設計書/100_管理画面AIエージェント設計.md §1）:
 *   LLM の自己申告ではなく「コードが正しいと言ったもの」だけを通す。
 *   このバリデータは LLM を一切使わず、純関数として tier 帯・参照整合・
 *   構造を機械的に検証する。tier 帯は設計書（古くなりがち）ではなく
 *   既存 enemies.json の実データから動的に学習する。
 */

export type EnemyValidationLevel = 'PASS' | 'WARN' | 'FAIL';

export type EnemyValidationFinding = {
  level: EnemyValidationLevel;
  field: string;
  message: string;
};

export type EnemyValidationResult = {
  ok: boolean; // FAIL が 0 件なら true
  findings: EnemyValidationFinding[];
};

export type EnemyBalanceContext = {
  /** 既存エネミー（自分自身を除く想定）。tier 帯の学習に使う。 */
  existingEnemies: Record<string, unknown>;
  /** items.json のキー集合（dropTable の WEAPON 参照検証用）。 */
  itemIds: Set<string>;
  /** materials.json のキー集合（dropTable の MATERIAL 参照検証用）。 */
  materialIds: Set<string>;
  /** skills.json のキー集合（necromance.skillIds 参照検証用）。 */
  skillIds: Set<string>;
};

export const VALID_TIERS = ['MINION', 'ELITE', 'BOSS'] as const;
export const VALID_TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'] as const;
export const VALID_ELEMENTS = [
  'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE',
] as const;
export const STAT_KEYS = [
  'hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes',
] as const;
// BossGimmick の正規列挙（src/types/game.ts と同期）
export const VALID_GIMMICK_TRIGGERS = ['HP_BELOW_50', 'TURN_3', 'ON_SHIELD_BREAK', 'ON_REVIVE'] as const;
export const VALID_GIMMICK_EFFECTS = ['ENRAGE', 'AV_DELAY', 'REVIVE', 'SUMMON_MINIONS'] as const;

/** tier 帯を逸脱したと判定するまでの許容率（min*（1-tol）〜 max*（1+tol）） */
const BAND_TOLERANCE = 0.3;
/** この主要ステータスのみ tier 帯チェックの対象にする（補助系は範囲が広いため除外）。 */
const BAND_CHECK_STATS = ['hp', 'atk', 'def', 'spd'] as const;

type StatBand = { min: number; max: number; count: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getNum(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * 既存エネミーから tier ごとの主要ステータス帯（min/max）を学習する。
 */
export function deriveTierBands(
  existingEnemies: Record<string, unknown>,
): Record<string, Record<string, StatBand>> {
  const bands: Record<string, Record<string, StatBand>> = {};
  for (const enemy of Object.values(existingEnemies)) {
    if (!isRecord(enemy)) continue;
    const tier = typeof enemy.tier === 'string' ? enemy.tier : null;
    const stats = isRecord(enemy.stats) ? enemy.stats : null;
    if (!tier || !stats) continue;
    bands[tier] ??= {};
    for (const stat of BAND_CHECK_STATS) {
      const val = getNum(stats, stat);
      if (val === null) continue;
      const b = bands[tier][stat];
      if (!b) {
        bands[tier][stat] = { min: val, max: val, count: 1 };
      } else {
        b.min = Math.min(b.min, val);
        b.max = Math.max(b.max, val);
        b.count += 1;
      }
    }
  }
  return bands;
}

/**
 * エネミー草稿を検証する。FAIL=保存不可、WARN=要確認、PASS=問題なし。
 */
export function validateEnemyDraft(
  draft: unknown,
  ctx: EnemyBalanceContext,
): EnemyValidationResult {
  const findings: EnemyValidationFinding[] = [];
  const fail = (field: string, message: string) =>
    findings.push({ level: 'FAIL', field, message });
  const warn = (field: string, message: string) =>
    findings.push({ level: 'WARN', field, message });
  const pass = (field: string, message: string) =>
    findings.push({ level: 'PASS', field, message });

  if (!isRecord(draft)) {
    return { ok: false, findings: [{ level: 'FAIL', field: 'root', message: '草稿がオブジェクトではありません。' }] };
  }

  // --- 必須文字列フィールド ---
  for (const f of ['id', 'name', 'nameJa', 'nameEn', 'description']) {
    if (typeof draft[f] !== 'string' || (draft[f] as string).trim() === '') {
      fail(f, `${f} は非空の文字列である必要があります。`);
    }
  }
  if (typeof draft.id === 'string' && !/^[a-z][a-z0-9_]*$/.test(draft.id)) {
    fail('id', `id "${draft.id}" は snake_case（英小文字・数字・_）である必要があります。`);
  }

  // --- tier / tribe ---
  const tier = draft.tier;
  if (typeof tier !== 'string' || !VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
    fail('tier', `tier は ${VALID_TIERS.join(' / ')} のいずれかである必要があります（現在: ${String(tier)}）。`);
  }
  if (
    typeof draft.tribe !== 'string' ||
    !VALID_TRIBES.includes(draft.tribe as (typeof VALID_TRIBES)[number])
  ) {
    fail('tribe', `tribe は ${VALID_TRIBES.join(' / ')} のいずれかである必要があります（現在: ${String(draft.tribe)}）。`);
  }

  // --- stats ---
  if (!isRecord(draft.stats)) {
    fail('stats', 'stats オブジェクトが存在しません。');
  } else {
    const stats = draft.stats;
    for (const key of STAT_KEYS) {
      const val = getNum(stats, key);
      if (val === null) {
        fail(`stats.${key}`, `stats.${key} は数値である必要があります。`);
      } else if (val < 0) {
        fail(`stats.${key}`, `stats.${key} は 0 以上である必要があります（現在: ${val}）。`);
      }
    }
    // スケール検査: パーセント系フィールドは整数%表記（critDmg≈150, resistances=-30 等）。
    // LLM が 0〜1 の分数で出力しがちなので機械的に検出する。
    const critDmg = getNum(stats, 'critDmg');
    if (critDmg !== null && critDmg > 0 && critDmg < 100) {
      fail(
        'stats.critDmg',
        `critDmg は%表記です（既存は 150〜175）。${critDmg} は 0〜1 の分数スケール誤りの可能性が高い。150 前後にしてください。`,
      );
    }
    for (const pf of ['critRate', 'effectHit', 'effectRes'] as const) {
      const v = getNum(stats, pf);
      if (v !== null && v > 0 && v < 1) {
        warn(
          `stats.${pf}`,
          `${pf} は%表記です（既存は 0〜30 の整数）。${v} は 0〜1 の分数スケール誤りの可能性。例: 5%なら 5。`,
        );
      }
    }

    // tier 帯チェック（実データから学習）
    if (typeof tier === 'string') {
      const bands = deriveTierBands(ctx.existingEnemies)[tier];
      if (bands) {
        for (const stat of BAND_CHECK_STATS) {
          const val = getNum(stats, stat);
          const band = bands[stat];
          if (val === null || !band) continue;
          const lo = band.min * (1 - BAND_TOLERANCE);
          const hi = band.max * (1 + BAND_TOLERANCE);
          if (val < lo || val > hi) {
            warn(
              `stats.${stat}`,
              `${tier} の ${stat} は実データ帯 ${band.min}〜${band.max}（許容 ${Math.floor(lo)}〜${Math.ceil(hi)}）に対し ${val}。tier バランスを確認してください。`,
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
          // 既存の耐性は ±10〜45 の整数%。|v|<1 は 0〜1 分数スケール誤り。
          warn(
            'resistances',
            `resistances.${el}=${v} は%表記としては小さすぎます（既存は -40〜45 の整数）。弱点/耐性が機能しません。例: 弱点 -30、耐性 +20。`,
          );
        }
      }
    }
  }

  // --- weaknesses（負の耐性と整合すること） ---
  const weaknesses = draft.weaknesses;
  if (weaknesses !== undefined) {
    if (!Array.isArray(weaknesses)) {
      fail('weaknesses', 'weaknesses は配列である必要があります。');
    } else {
      for (const w of weaknesses) {
        if (typeof w !== 'string' || !VALID_ELEMENTS.includes(w as (typeof VALID_ELEMENTS)[number])) {
          fail('weaknesses', `weaknesses の要素 "${String(w)}" は不正な属性です。`);
          continue;
        }
        const r = isRecord(resistances) ? resistances[w] : undefined;
        if (typeof r !== 'number' || r >= 0) {
          warn(
            'weaknesses',
            `弱点 "${w}" に対応する負の resistances がありません。弱点は負の耐性で表現する設計です。`,
          );
        }
      }
    }
  }

  // --- dropTable ---
  const dropTable = draft.dropTable;
  if (dropTable !== undefined) {
    if (!Array.isArray(dropTable)) {
      fail('dropTable', 'dropTable は配列である必要があります。');
    } else {
      dropTable.forEach((drop, i) => {
        if (!isRecord(drop)) {
          fail(`dropTable[${i}]`, 'ドロップエントリがオブジェクトではありません。');
          return;
        }
        const type = drop.type;
        const itemId = drop.itemId;
        const rate = drop.rate;
        if (type !== 'WEAPON' && type !== 'MATERIAL' && type !== 'MONSTER') {
          fail(`dropTable[${i}].type`, `type は WEAPON / MATERIAL / MONSTER のいずれかである必要があります。`);
        }
        if (typeof rate !== 'number' || rate < 0 || rate > 1) {
          fail(`dropTable[${i}].rate`, `rate は 0〜1 の数値である必要があります（現在: ${String(rate)}）。`);
        }
        if (typeof itemId !== 'string') {
          fail(`dropTable[${i}].itemId`, 'itemId は文字列である必要があります。');
        } else if (type === 'WEAPON' && !ctx.itemIds.has(itemId)) {
          fail(`dropTable[${i}].itemId`, `WEAPON 参照 "${itemId}" が items.json に存在しません。`);
        } else if (type === 'MATERIAL' && !ctx.materialIds.has(itemId)) {
          fail(`dropTable[${i}].itemId`, `MATERIAL 参照 "${itemId}" が materials.json に存在しません。`);
        } else {
          pass(`dropTable[${i}]`, `ドロップ参照 "${itemId}" OK`);
        }
      });
    }
  }

  // --- necromance（味方化設定。audit と同等のルール） ---
  const necro = draft.necromance;
  if (!isRecord(necro)) {
    fail('necromance', 'necromance セクションが存在しません。');
  } else {
    const captureRate = getNum(necro, 'captureRate');
    if (captureRate === null || captureRate < 0 || captureRate > 1) {
      fail('necromance.captureRate', 'captureRate は 0〜1 の数値である必要があります。');
    }
    const allyCost = getNum(necro, 'allyCost');
    if (allyCost === null || allyCost < 1 || !Number.isInteger(allyCost)) {
      fail('necromance.allyCost', 'allyCost は 1 以上の整数である必要があります。');
    }
    if (!isRecord(necro.allyStats)) {
      fail('necromance.allyStats', 'allyStats が存在しません。');
    } else {
      for (const key of STAT_KEYS) {
        const v = getNum(necro.allyStats, key);
        if (v === null || v < 0) {
          fail(`necromance.allyStats.${key}`, `allyStats.${key} は 0 以上の数値である必要があります。`);
        }
      }
    }
    if (!Array.isArray(necro.skillIds)) {
      fail('necromance.skillIds', 'skillIds は配列である必要があります。');
    } else if (necro.skillIds.length === 0) {
      warn('necromance.skillIds', 'skillIds が空です。味方化時のスキルを 1 つ以上指定してください。');
    } else {
      for (const sid of necro.skillIds) {
        if (typeof sid !== 'string' || !ctx.skillIds.has(sid)) {
          fail('necromance.skillIds', `skillIds 参照 "${String(sid)}" が skills.json に存在しません。`);
        } else {
          pass('necromance.skillIds', `ネクロマンススキル参照 "${sid}" OK`);
        }
      }
    }
  }

  // --- shieldHp / maxShieldHp（ELITE/BOSS のシールド。任意） ---
  const shieldHp = getNum(draft, 'shieldHp');
  const maxShieldHp = getNum(draft, 'maxShieldHp');
  if (draft.shieldHp !== undefined && (shieldHp === null || shieldHp < 0)) {
    fail('shieldHp', 'shieldHp は 0 以上の数値である必要があります。');
  }
  if (draft.maxShieldHp !== undefined && (maxShieldHp === null || maxShieldHp < 0)) {
    fail('maxShieldHp', 'maxShieldHp は 0 以上の数値である必要があります。');
  }
  if ((shieldHp ?? 0) > 0 && (maxShieldHp ?? 0) <= 0) {
    warn('maxShieldHp', 'shieldHp を設定する場合は maxShieldHp も同値以上で設定してください。');
  }

  // --- gimmicks（ボスギミック。任意。主に ELITE/BOSS 用） ---
  const gimmicks = draft.gimmicks;
  if (gimmicks !== undefined) {
    if (!Array.isArray(gimmicks)) {
      fail('gimmicks', 'gimmicks は配列である必要があります。');
    } else {
      if (gimmicks.length > 0 && tier === 'MINION') {
        warn('gimmicks', 'MINION にギミックは通常不要です。ELITE/BOSS 向けの機能です。');
      }
      const hasShield = (shieldHp ?? 0) > 0 || (maxShieldHp ?? 0) > 0;
      gimmicks.forEach((g, i) => {
        if (!isRecord(g)) {
          fail(`gimmicks[${i}]`, 'ギミックエントリがオブジェクトではありません。');
          return;
        }
        const trigger = g.trigger;
        const effect = g.effect;
        if (
          typeof trigger !== 'string' ||
          !VALID_GIMMICK_TRIGGERS.includes(trigger as (typeof VALID_GIMMICK_TRIGGERS)[number])
        ) {
          fail(`gimmicks[${i}].trigger`, `trigger は ${VALID_GIMMICK_TRIGGERS.join(' / ')} のいずれかである必要があります（現在: ${String(trigger)}）。`);
        }
        if (
          typeof effect !== 'string' ||
          !VALID_GIMMICK_EFFECTS.includes(effect as (typeof VALID_GIMMICK_EFFECTS)[number])
        ) {
          fail(`gimmicks[${i}].effect`, `effect は ${VALID_GIMMICK_EFFECTS.join(' / ')} のいずれかである必要があります（現在: ${String(effect)}）。`);
        }
        if (typeof g.value !== 'number' || !Number.isFinite(g.value)) {
          fail(`gimmicks[${i}].value`, 'value は数値である必要があります。');
        }
        // 意味的整合（ソフト警告）
        if (effect === 'REVIVE' && trigger !== 'HP_BELOW_50') {
          warn(`gimmicks[${i}]`, 'REVIVE は HP_BELOW_50 トリガーで使う設計です（HP0遷移として処理）。');
        }
        if (trigger === 'ON_SHIELD_BREAK' && !hasShield) {
          warn(`gimmicks[${i}]`, 'ON_SHIELD_BREAK を使うには shieldHp / maxShieldHp の設定が必要です。');
        }
        if (
          typeof trigger === 'string' &&
          typeof effect === 'string' &&
          VALID_GIMMICK_TRIGGERS.includes(trigger as (typeof VALID_GIMMICK_TRIGGERS)[number]) &&
          VALID_GIMMICK_EFFECTS.includes(effect as (typeof VALID_GIMMICK_EFFECTS)[number])
        ) {
          pass(`gimmicks[${i}]`, `ギミック ${trigger}→${effect} OK`);
        }
      });
    }
  }

  // --- battle（任意だが構造チェック） ---
  if (draft.battle !== undefined && !isRecord(draft.battle)) {
    fail('battle', 'battle はオブジェクトである必要があります。');
  }

  const ok = findings.every((f) => f.level !== 'FAIL');
  if (ok && findings.length === 0) {
    pass('root', '構造・参照・tier 帯すべて問題ありません。');
  }
  return { ok, findings };
}

/** 検証結果を LLM へのフィードバック文字列に整形する（再生成ループ用）。 */
export function findingsToFeedback(findings: EnemyValidationFinding[]): string {
  const problems = findings.filter((f) => f.level !== 'PASS');
  if (problems.length === 0) return '';
  return problems
    .map((f) => `- [${f.level}] ${f.field}: ${f.message}`)
    .join('\n');
}
