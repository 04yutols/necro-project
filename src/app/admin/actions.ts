'use server';

import fs from 'fs';
import path from 'path';
import type { NecroConfigData } from '@/types/game';
import type { StoryScene, StoryCharacter } from '@/types/story';
import {
  STORY_PACKS,
  getStoryPackForArchiveChapter,
  sortStoryScenes,
} from '@/data/story/packs';
import type { StoryPack, StoryPackSummary } from '@/data/story/packs';
import { assertDev, withDevGuard } from './adminGuard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AuditLevel = 'PASS' | 'WARN' | 'FAIL';

export type AuditFinding = {
  level: AuditLevel;
  scope: string;
  id: string;
  message: string;
};

export type MasterDataCollection = {
  areas: Record<string, Record<string, unknown>>;
  enemies: Record<string, Record<string, unknown>>;
  stages: Record<string, Record<string, unknown>>;
  jobs: Record<string, Record<string, unknown>>;
  skills: Record<string, Record<string, unknown>>;
  items: Record<string, Record<string, unknown>>;
  materials: Record<string, Record<string, unknown>>;
  monsters: Record<string, Record<string, unknown>>;
  demonForms: Record<string, Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------
const MASTER_DIR = path.join(process.cwd(), 'src', 'data', 'master');
const STORY_DIR = path.join(process.cwd(), 'src', 'data', 'story');
const MASTER_FILE_MAP: Record<keyof MasterDataCollection, string> = {
  areas: 'areas.json',
  enemies: 'enemies.json',
  stages: 'stages.json',
  jobs: 'jobs.json',
  skills: 'skills.json',
  items: 'items.json',
  materials: 'materials.json',
  monsters: 'monsters.json',
  demonForms: 'demonForms.json',
};

function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function normalizeManagedId(id: string, label: string): string {
  const normalized = id.trim();
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    throw new Error(`${label} は英小文字始まりの snake_case で入力してください。`);
  }
  if (['__proto__', 'prototype', 'constructor'].includes(normalized)) {
    throw new Error(`${label} に予約語は使用できません。`);
  }
  return normalized;
}

function readMasterJson(filename: string): Record<string, Record<string, unknown>> {
  const filePath = path.join(MASTER_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, Record<string, unknown>>;
}

function readNecroConfigJson(): NecroConfigData {
  const raw = fs.readFileSync(path.join(MASTER_DIR, 'necroConfig.json'), 'utf-8');
  return JSON.parse(raw) as NecroConfigData;
}

function getNestedNumber(obj: unknown, pathKeys: string[]): number | null {
  let current: unknown = obj;
  for (const key of pathKeys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

function validateNecroConfigData(config: unknown): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const check = (pathKey: string, min: number, max: number, options: { minExclusive?: boolean; maxInclusive?: boolean } = {}) => {
    const value = getNestedNumber(config, pathKey.split('.'));
    const minOk = options.minExclusive ? (value !== null && value > min) : (value !== null && value >= min);
    const maxOk = options.maxInclusive === false ? (value !== null && value < max) : (value !== null && value <= max);
    if (!minOk || !maxOk) {
      const left = options.minExclusive ? `>${min}` : `>=${min}`;
      const right = options.maxInclusive === false ? `<${max}` : `<=${max}`;
      findings.push({ level: 'FAIL', scope: 'necroConfig', id: pathKey, message: `${pathKey} は ${left} かつ ${right} の数値である必要があります。` });
    } else {
      findings.push({ level: 'PASS', scope: 'necroConfig', id: pathKey, message: `${pathKey} OK` });
    }
  };

  check('monsterStatMultiplier.kA', 0, 0.1);
  check('monsterStatMultiplier.kB', 0, 0.05);
  check('monsterStatMultiplier.k2', 0, 1);
  check('maxCost.base', 1, 100);
  check('maxCost.d1', 1, 100);
  check('maxCost.c2', 0, 20);
  check('captureRate.rankMultiplier', 1, 2);
  check('captureRate.cap', 0, 1, { minExclusive: true });
  check('expCurve.coefficient', 1, 50);
  check('expCurve.necroExpRate', 1, 3);

  return findings;
}

function assertValidNecroConfig(config: unknown): asserts config is NecroConfigData {
  const fails = validateNecroConfigData(config).filter((finding) => finding.level === 'FAIL');
  if (fails.length > 0) {
    throw new Error(fails.map((finding) => finding.message).join('\n'));
  }
}

// ---------------------------------------------------------------------------
// Public: read all master data
// ---------------------------------------------------------------------------
export async function getAllMasterData(): Promise<MasterDataCollection> {
  assertDev();
  return {
    areas: readMasterJson('areas.json'),
    enemies: readMasterJson('enemies.json'),
    stages: readMasterJson('stages.json'),
    jobs: readMasterJson('jobs.json'),
    skills: readMasterJson('skills.json'),
    items: readMasterJson('items.json'),
    materials: readMasterJson('materials.json'),
    monsters: readMasterJson('monsters.json'),
    demonForms: readMasterJson('demonForms.json'),
  };
}

export async function getNecroConfig(): Promise<NecroConfigData> {
  assertDev();
  return readNecroConfigJson();
}

export async function saveNecroConfig(
  config: NecroConfigData,
): Promise<{ success: boolean; error?: string }> {
  assertDev();
  try {
    assertValidNecroConfig(config);
    writeJsonAtomic(path.join(MASTER_DIR, 'necroConfig.json'), config);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Public: read single master file
// ---------------------------------------------------------------------------
export async function getMasterFile(
  name: keyof MasterDataCollection,
): Promise<Record<string, Record<string, unknown>>> {
  assertDev();
  return readMasterJson(MASTER_FILE_MAP[name]);
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------
function getStringArray(obj: Record<string, unknown>, key: string): string[] {
  const val = obj[key];
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is string => typeof x === 'string');
}

function getArray(obj: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const val = obj[key];
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function getString(obj: Record<string, unknown>, key: string): string {
  const val = obj[key];
  return typeof val === 'string' ? val : '';
}

const WEAPON_SUBOPTION_RULES: Record<string, { optionCount: number; elementDamageOptionCount: number }> = {
  R: { optionCount: 1, elementDamageOptionCount: 0 },
  SR: { optionCount: 1, elementDamageOptionCount: 0 },
  SSR: { optionCount: 2, elementDamageOptionCount: 1 },
  UR: { optionCount: 2, elementDamageOptionCount: 1 },
};
const JOB_STAT_KEYS = ['hp', 'mp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'];
const JOB_POSITIVE_STAT_KEYS = new Set(['hp', 'mp', 'atk', 'spd']);
const WEAPON_MATERIAL_TYPES = new Set(['IDEA_COMMON', 'IDEA_SR', 'IDEA_SSR', 'ABYSSAL_OBSIDIAN']);

function isElementDamageSubOption(option: Record<string, unknown>): boolean {
  return /^(FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK)_DMG_BOOST$/.test(getString(option, 'type'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jobPowerScore(stats: Record<string, unknown>): number {
  return (
    Number(stats.hp ?? 0) * 0.15 +
    Number(stats.atk ?? 0) * 3 +
    Number(stats.def ?? 0) * 2 +
    Number(stats.spd ?? 0) +
    Number(stats.critRate ?? 0) * 2 +
    Number(stats.critDmg ?? 0) * 0.5 +
    Number(stats.effectHit ?? 0) * 0.8 +
    Number(stats.effectRes ?? 0) * 0.8
  );
}

// ---------------------------------------------------------------------------
// Public: run full audit
// ---------------------------------------------------------------------------
/**
 * マスターデータ監査。`override` を渡すと、その分だけ in-memory で差し替えてから検査する
 * （非破壊プレビュー用。監査エージェント Agent B が修正パッチを保存前に検証するのに使う）。
 * override 無し時はディスクの現状をそのまま検査する（= 従来の runMasterDataAudit）。
 */
export async function auditMasterData(
  override?: Partial<MasterDataCollection>,
): Promise<AuditFinding[]> {
  assertDev();

  const base = await getAllMasterData();
  // override されたファイルはエンティティ単位でマージ（指定 entity のみ差し替え/追加）
  const data: MasterDataCollection = { ...base };
  if (override) {
    for (const key of Object.keys(override) as (keyof MasterDataCollection)[]) {
      const ov = override[key];
      if (ov) data[key] = { ...base[key], ...ov };
    }
  }
  const findings: AuditFinding[] = [];

  const enemyIds = new Set(Object.keys(data.enemies));
  const stageIds = new Set(Object.keys(data.stages));
  const areaIds = new Set(Object.keys(data.areas));
  const jobIds = new Set(Object.keys(data.jobs));
  const skillIds = new Set(Object.keys(data.skills));
  const itemIds = new Set(Object.keys(data.items));
  const materialIds = new Set(Object.keys(data.materials));
  const demonFormJobIds = new Set(Object.keys(data.demonForms));

  findings.push(...validateNecroConfigData(readNecroConfigJson()));

  // ---------------------------------------------------------------------------
  // 1. ID integrity: each entry's `id` field must match its key (when present)
  // ---------------------------------------------------------------------------
  const scopesWithId: [string, Record<string, Record<string, unknown>>, { allowKeyOnly?: boolean }?][] = [
    ['areas', data.areas],
    ['enemies', data.enemies],
    ['stages', data.stages],
    ['skills', data.skills],
    ['items', data.items],
    ['materials', data.materials],
    ['monsters', data.monsters, { allowKeyOnly: true }],
  ];

  for (const [scope, collection, options] of scopesWithId) {
    for (const [key, entry] of Object.entries(collection)) {
      const idField = entry['id'];
      if (idField === undefined && options?.allowKeyOnly) {
        findings.push({ level: 'WARN', scope, id: key, message: `"id" フィールドが存在しません（キーIDとして監査）。` });
      } else if (idField === undefined) {
        findings.push({ level: 'WARN', scope, id: key, message: `"id" フィールドが存在しません。` });
      } else if (idField !== key) {
        findings.push({
          level: 'FAIL',
          scope,
          id: key,
          message: `ID不整合: キー="${key}" vs id="${String(idField)}"`,
        });
      } else {
        findings.push({ level: 'PASS', scope, id: key, message: 'ID整合性 OK' });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 1.25 Area reference: stages.chapter + stages.area must exist in areas
  // ---------------------------------------------------------------------------
  for (const [areaKey, area] of Object.entries(data.areas)) {
    const chapter = area['chapter'];
    const areaNo = area['area'];
    const color = getString(area, 'color');
    const position = area['position'] as Record<string, unknown> | undefined;
    if (!Number.isInteger(chapter) || Number(chapter) < 1) {
      findings.push({ level: 'FAIL', scope: 'areas', id: areaKey, message: 'chapter は 1 以上の整数である必要があります。' });
    }
    if (!Number.isInteger(areaNo) || Number(areaNo) < 1) {
      findings.push({ level: 'FAIL', scope: 'areas', id: areaKey, message: 'area は 1 以上の整数である必要があります。' });
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      findings.push({ level: 'FAIL', scope: 'areas', id: areaKey, message: 'color は #RRGGBB 形式である必要があります。' });
    }
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      findings.push({ level: 'FAIL', scope: 'areas', id: areaKey, message: 'position.x / position.y は数値である必要があります。' });
    }
  }

  for (const [stageKey, stage] of Object.entries(data.stages)) {
    const chapter = stage['chapter'];
    const areaNo = stage['area'];
    const inferredAreaId = `ch${String(chapter)}_area${String(areaNo)}`;
    if (!areaIds.has(inferredAreaId)) {
      findings.push({
        level: 'FAIL',
        scope: 'stages',
        id: stageKey,
        message: `参照先エリア "${inferredAreaId}" が areas.json に存在しません。`,
      });
    } else {
      findings.push({ level: 'PASS', scope: 'stages', id: stageKey, message: `エリア参照 "${inferredAreaId}" OK` });
    }
  }

  // ---------------------------------------------------------------------------
  // 1.5 Weapon sub options: rarity controls count and fixed element slots
  // ---------------------------------------------------------------------------
  for (const [itemKey, item] of Object.entries(data.items)) {
    if (getString(item, 'type') !== 'WEAPON') continue;
    const rarity = getString(item, 'weaponRarity') || getString(item, 'rarity');
    const rule = WEAPON_SUBOPTION_RULES[rarity];
    const subOptions = getArray(item, 'subOptions');
    if (!rule) {
      findings.push({ level: 'FAIL', scope: 'items', id: itemKey, message: `武器レアリティ "${rarity}" は未対応です。` });
      continue;
    }
    if (subOptions.length !== rule.optionCount) {
      findings.push({ level: 'FAIL', scope: 'items', id: itemKey, message: `${rarity} 武器のサブオプションは ${rule.optionCount} 枠必要です。` });
    }
    const elementDamageOptionCount = subOptions.filter(isElementDamageSubOption).length;
    if (elementDamageOptionCount !== rule.elementDamageOptionCount) {
      findings.push({ level: 'FAIL', scope: 'items', id: itemKey, message: `${rarity} 武器の属性ダメージ枠は ${rule.elementDamageOptionCount} 枠必要です。` });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Enemy reference: stages.waves[].enemyIds must exist in enemies
  // ---------------------------------------------------------------------------
  for (const [stageKey, stage] of Object.entries(data.stages)) {
    const waves = getArray(stage, 'waves');
    if (waves.length === 0) {
      findings.push({ level: 'PASS', scope: 'stages', id: stageKey, message: 'WAVE なし（SAFEノード）' });
      continue;
    }
    for (const wave of waves) {
      const enemyIds2 = getStringArray(wave, 'enemyIds');
      for (const eid of enemyIds2) {
        if (!enemyIds.has(eid)) {
          findings.push({
            level: 'FAIL',
            scope: 'stages',
            id: stageKey,
            message: `参照先の敵 "${eid}" が enemies.json に存在しません。`,
          });
        } else {
          findings.push({ level: 'PASS', scope: 'stages', id: stageKey, message: `敵参照 "${eid}" OK` });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Skill reference: jobs.skills[].skillId must exist in skills
  // ---------------------------------------------------------------------------
  for (const [jobKey, job] of Object.entries(data.jobs)) {
    const skillRefs = getArray(job, 'skills');
    if (skillRefs.length === 0) {
      findings.push({ level: 'WARN', scope: 'jobs', id: jobKey, message: 'スキル参照が 0 件です。' });
      continue;
    }
    for (const ref of skillRefs) {
      const sid = getString(ref, 'skillId');
      if (!sid) {
        findings.push({ level: 'WARN', scope: 'jobs', id: jobKey, message: 'skillId フィールドが空のスキル参照があります。' });
        continue;
      }
      if (!skillIds.has(sid)) {
        findings.push({
          level: 'FAIL',
          scope: 'jobs',
          id: jobKey,
          message: `参照先のスキル "${sid}" が skills.json に存在しません。`,
        });
      } else {
        findings.push({ level: 'PASS', scope: 'jobs', id: jobKey, message: `スキル参照 "${sid}" OK` });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3.25 Enemy necromance settings: capture rate, ally stats, and skill refs
  // ---------------------------------------------------------------------------
  for (const [enemyKey, enemy] of Object.entries(data.enemies)) {
    const necromance = enemy['necromance'];
    if (!isRecord(necromance)) {
      findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: 'necromance セクションが存在しません。' });
      continue;
    }

    const captureRate = necromance.captureRate;
    if (typeof captureRate !== 'number' || !Number.isFinite(captureRate) || captureRate < 0 || captureRate > 1) {
      findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: 'necromance.captureRate は 0〜1 の数値である必要があります。' });
    }

    const allyCost = necromance.allyCost;
    if (!Number.isInteger(allyCost) || Number(allyCost) < 1) {
      findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: 'necromance.allyCost は 1 以上の整数である必要があります。' });
    }

    if (!isRecord(necromance.allyStats)) {
      findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: 'necromance.allyStats が存在しません。' });
    } else {
      for (const statKey of JOB_STAT_KEYS) {
        const value = necromance.allyStats[statKey];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: `necromance.allyStats.${statKey} は 0 以上の数値である必要があります。` });
        }
      }
    }

    const necromanceSkillIds = getStringArray(necromance, 'skillIds');
    if (!Array.isArray(necromance.skillIds)) {
      findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: 'necromance.skillIds は配列である必要があります。' });
    }
    for (const skillId of necromanceSkillIds) {
      if (!skillIds.has(skillId)) {
        findings.push({ level: 'FAIL', scope: 'enemies', id: enemyKey, message: `necromance.skillIds の参照先 "${skillId}" が skills.json に存在しません。` });
      } else {
        findings.push({ level: 'PASS', scope: 'enemies', id: enemyKey, message: `ネクロマンススキル参照 "${skillId}" OK` });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3.5 Job base stats: each job must define Lv1-100 fixed base stats
  // ---------------------------------------------------------------------------
  const tier1ScoreSamples: number[] = [];
  for (const [jobKey, job] of Object.entries(data.jobs)) {
    if ('growthModifiers' in job) {
      findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: 'growthModifiers は廃止済みです。baseStatsByLevel を編集してください。' });
    }
    const table = job.baseStatsByLevel;
    if (!isRecord(table)) {
      findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: 'baseStatsByLevel が存在しません。' });
      continue;
    }

    let previous: Record<string, unknown> | null = null;
    for (let level = 1; level <= 100; level += 1) {
      const stats = table[String(level)];
      if (!isRecord(stats)) {
        findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level} が存在しません。` });
        continue;
      }
      for (const statKey of JOB_STAT_KEYS) {
        const value = stats[statKey];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level}.${statKey} は数値である必要があります。` });
        } else if (JOB_POSITIVE_STAT_KEYS.has(statKey) && value <= 0) {
          findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level}.${statKey} は 1 以上である必要があります。` });
        } else if (value < 0) {
          findings.push({ level: 'FAIL', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level}.${statKey} は 0 以上である必要があります。` });
        }
      }
      if (previous && typeof stats.hp === 'number' && typeof previous.hp === 'number' && stats.hp < previous.hp) {
        findings.push({ level: 'WARN', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level}.hp が前レベルより低下しています。` });
      }
      if (previous && typeof stats.mp === 'number' && typeof previous.mp === 'number' && stats.mp < previous.mp) {
        findings.push({ level: 'WARN', scope: 'jobs', id: jobKey, message: `baseStatsByLevel.${level}.mp が前レベルより低下しています。` });
      }
      previous = stats;
    }

    if (Number(job.tier) === 1) {
      [1, 50, 100].forEach((level) => {
        const stats = table[String(level)];
        if (isRecord(stats)) tier1ScoreSamples.push(jobPowerScore(stats));
      });
    }
  }

  const tier1AverageScore = tier1ScoreSamples.length > 0
    ? tier1ScoreSamples.reduce((sum, score) => sum + score, 0) / tier1ScoreSamples.length
    : 0;
  if (tier1AverageScore > 0) {
    for (const [jobKey, job] of Object.entries(data.jobs)) {
      const table = job.baseStatsByLevel;
      if (Number(job.tier) <= 1 || !isRecord(table)) continue;
      const tier2Scores = [1, 50, 100]
        .map((level) => table[String(level)])
        .filter(isRecord)
        .map(jobPowerScore);
      const average = tier2Scores.reduce((sum, score) => sum + score, 0) / Math.max(1, tier2Scores.length);
      if (average < tier1AverageScore * 1.02) {
        findings.push({ level: 'WARN', scope: 'jobs', id: jobKey, message: 'Tier2職業としての総合スコアがTier1平均に近すぎます。' });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Drop table reference: dropTable[].itemId must exist in items or materials
  // ---------------------------------------------------------------------------
  const allDroppable = new Set([...itemIds, ...materialIds]);
  const auditDropReference = (
    scope: string,
    id: string,
    fieldPath: string,
    drop: Record<string, unknown>,
  ) => {
    const dropType = getString(drop, 'type');
    const iid = getString(drop, 'itemId');
    if (dropType === 'RESIDUE') {
      if (iid) {
        findings.push({ level: 'WARN', scope, id, message: `${fieldPath} は RESIDUE のため itemId は無視されます。` });
      }
      return;
    }
    if (dropType === 'MONSTER') {
      const monsterId = getString(drop, 'monsterId');
      if (!monsterId) {
        findings.push({ level: 'WARN', scope, id, message: `${fieldPath}.monsterId が空です。` });
      } else if (!enemyIds.has(monsterId)) {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の MONSTER monsterId "${monsterId}" が enemies.json に存在しません。` });
      } else {
        findings.push({ level: 'PASS', scope, id, message: `確定モンスター参照 "${monsterId}" OK` });
      }
      return;
    }
    if (dropType === 'WEAPON_MATERIAL') {
      const materialType = getString(drop, 'weaponMaterialType') || iid;
      if (!materialType) {
        findings.push({ level: 'WARN', scope, id, message: `${fieldPath}.weaponMaterialType が空です。` });
      } else if (!WEAPON_MATERIAL_TYPES.has(materialType)) {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の WEAPON_MATERIAL "${materialType}" は未定義です。` });
      } else {
        findings.push({ level: 'PASS', scope, id, message: `武器素材報酬 "${materialType}" OK` });
      }
      return;
    }
    if (!iid) {
      findings.push({ level: 'WARN', scope, id, message: `${fieldPath}.itemId が空です。` });
      return;
    }
    if (dropType === 'MATERIAL') {
      if (!materialIds.has(iid)) {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の MATERIAL itemId "${iid}" が materials.json に存在しません。` });
      } else {
        findings.push({ level: 'PASS', scope, id, message: `素材ドロップ参照 "${iid}" OK` });
      }
      return;
    }
    if (dropType === 'WEAPON' || dropType === 'CONSUMABLE') {
      const item = data.items[iid];
      if (!itemIds.has(iid) || !item) {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の ${dropType} itemId "${iid}" が items.json に存在しません。` });
      } else if (dropType === 'CONSUMABLE' && getString(item, 'type') !== 'CONSUMABLE') {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の itemId "${iid}" は CONSUMABLE ではありません。` });
      } else if (dropType === 'WEAPON' && getString(item, 'type') !== 'WEAPON') {
        findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の itemId "${iid}" は WEAPON ではありません。` });
      } else {
        findings.push({ level: 'PASS', scope, id, message: `アイテムドロップ参照 "${iid}" OK` });
      }
      return;
    }
    if (!allDroppable.has(iid)) {
      findings.push({ level: 'FAIL', scope, id, message: `${fieldPath} の itemId "${iid}" が items.json / materials.json のどちらにも存在しません。` });
    } else {
      findings.push({ level: 'WARN', scope, id, message: `${fieldPath} の type "${dropType}" は監査対象外ですが参照 "${iid}" は存在します。` });
    }
  };

  for (const [enemyKey, enemy] of Object.entries(data.enemies)) {
    const drops = getArray(enemy, 'dropTable');
    drops.forEach((drop, index) => auditDropReference('enemies', enemyKey, `dropTable[${index}]`, drop));
  }

  // Stage drop tables
  for (const [stageKey, stage] of Object.entries(data.stages)) {
    const rewards = stage['rewards'] as Record<string, unknown> | undefined;
    if (!rewards) continue;
    const drops = getArray(rewards, 'dropTable');
    drops.forEach((drop, index) => auditDropReference('stages', stageKey, `rewards.dropTable[${index}]`, drop));
    const firstClearDrops = getArray(rewards, 'firstClearGuaranteed');
    firstClearDrops.forEach((drop, index) => auditDropReference('stages', stageKey, `rewards.firstClearGuaranteed[${index}]`, drop));
  }

  // ---------------------------------------------------------------------------
  // 5. Unlock conditions: stages.unlockRequires[] must be valid stage IDs
  // ---------------------------------------------------------------------------
  for (const [stageKey, stage] of Object.entries(data.stages)) {
    const reqs = getStringArray(stage, 'unlockRequires');
    if (reqs.length === 0) {
      findings.push({ level: 'PASS', scope: 'stages', id: stageKey, message: '解放条件なし（初期開放）' });
      continue;
    }
    for (const req of reqs) {
      if (!stageIds.has(req)) {
        findings.push({
          level: 'FAIL',
          scope: 'stages',
          id: stageKey,
          message: `unlockRequires の "${req}" が stages.json に存在しません。`,
        });
      } else {
        findings.push({ level: 'PASS', scope: 'stages', id: stageKey, message: `解放条件 "${req}" OK` });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Demon form jobId reference
  // ---------------------------------------------------------------------------
  void demonFormJobIds; // used via Object.entries below
  for (const [formKey, form] of Object.entries(data.demonForms)) {
    const jid = getString(form, 'jobId');
    if (!jid) {
      findings.push({ level: 'FAIL', scope: 'demonForms', id: formKey, message: '"jobId" フィールドが存在しません。' });
      continue;
    }
    if (!jobIds.has(jid)) {
      findings.push({
        level: 'FAIL',
        scope: 'demonForms',
        id: formKey,
        message: `jobId "${jid}" が jobs.json に存在しません。`,
      });
    } else {
      findings.push({ level: 'PASS', scope: 'demonForms', id: formKey, message: `jobId "${jid}" OK` });
    }
  }

  return findings;
}

/** 後方互換: 従来の全件監査（ディスク現状）。 */
export async function runMasterDataAudit(): Promise<AuditFinding[]> {
  return auditMasterData();
}

// ---------------------------------------------------------------------------
// Public: dependency cross-reference
// ---------------------------------------------------------------------------
export type DependencyRef = {
  scope: string;
  id: string;
  label: string;
  href: string;
  context: string;
};

export async function getDependencies(
  fileKey: keyof MasterDataCollection,
  entryKey: string,
): Promise<DependencyRef[]> {
  assertDev();
  const data = await getAllMasterData();
  const refs: DependencyRef[] = [];

  switch (fileKey) {
    case 'areas': {
      const area = data.areas[entryKey];
      if (!area) break;
      for (const [stageKey, stage] of Object.entries(data.stages)) {
        const inferredAreaId = `ch${String(stage.chapter)}_area${String(stage.area)}`;
        if (inferredAreaId === entryKey) {
          refs.push({
            scope: 'stages',
            id: stageKey,
            label: (stage.nameJa as string) || stageKey,
            href: `/admin/stages/${stageKey}`,
            context: `CH${String(stage.chapter)} / AREA ${String(stage.area)}`,
          });
        }
      }
      break;
    }
    case 'enemies': {
      for (const [stageKey, stage] of Object.entries(data.stages)) {
        const waves = (stage.waves as Array<Record<string, unknown>>) ?? [];
        for (const wave of waves) {
          const eIds = (wave.enemyIds as string[]) ?? [];
          if (eIds.includes(entryKey)) {
            refs.push({
              scope: 'stages',
              id: stageKey,
              label: (stage.nameJa as string) || stageKey,
              href: `/admin/stages/${stageKey}`,
              context: `${wave.label ?? ''} · ${wave.role ?? ''}`,
            });
          }
        }
      }
      break;
    }
    case 'skills': {
      for (const [jobKey, job] of Object.entries(data.jobs)) {
        const skills = (job.skills as Array<Record<string, unknown>>) ?? [];
        for (const skillRef of skills) {
          if (skillRef.skillId === entryKey) {
            refs.push({
              scope: 'jobs',
              id: jobKey,
              label: (job.displayName as string) || jobKey,
              href: `/admin/jobs/${jobKey}`,
              context: `Lv${skillRef.level ?? '?'} 解放`,
            });
          }
        }
      }
      for (const [enemyKey, enemy] of Object.entries(data.enemies)) {
        const necromance = enemy.necromance as Record<string, unknown> | undefined;
        const skillIds = Array.isArray(necromance?.skillIds) ? necromance.skillIds : [];
        if (skillIds.includes(entryKey)) {
          refs.push({
            scope: 'enemies',
            id: enemyKey,
            label: (enemy.nameJa as string) || enemyKey,
            href: `/admin/enemies/${enemyKey}`,
            context: 'ネクロマンス味方化スキル',
          });
        }
      }
      break;
    }
    case 'items':
    case 'materials': {
      for (const [enemyKey, enemy] of Object.entries(data.enemies)) {
        const drops = (enemy.dropTable as Array<Record<string, unknown>>) ?? [];
        for (const drop of drops) {
          if (drop.itemId === entryKey) {
            const rate = (drop.rate as number) ?? 0;
            refs.push({
              scope: 'enemies',
              id: enemyKey,
              label: (enemy.nameJa as string) || enemyKey,
              href: `/admin/enemies/${enemyKey}`,
              context: `ドロップ率 ${Math.round(rate * 100)}%`,
            });
          }
        }
      }
      for (const [stageKey, stage] of Object.entries(data.stages)) {
        const rewards = (stage.rewards as Record<string, unknown>) ?? {};
        const drops = [
          ...((rewards.dropTable as Array<Record<string, unknown>>) ?? []),
          ...((rewards.firstClearGuaranteed as Array<Record<string, unknown>>) ?? []),
        ];
        for (const drop of drops) {
          if (drop.itemId === entryKey) {
            const rate = (drop.rate as number) ?? 0;
            refs.push({
              scope: 'stages',
              id: stageKey,
              label: (stage.nameJa as string) || stageKey,
              href: `/admin/stages/${stageKey}`,
              context: `ステージ報酬 ${Math.round(rate * 100)}%`,
            });
          }
        }
      }
      break;
    }
    case 'jobs': {
      for (const [formKey, form] of Object.entries(data.demonForms)) {
        if (form.jobId === entryKey) {
          refs.push({
            scope: 'demonForms',
            id: formKey,
            label: (form.formName as string) || formKey,
            href: `/admin/demon-forms/${formKey}`,
            context: '魔神化フォーム',
          });
        }
      }
      for (const [jobKey, job] of Object.entries(data.jobs)) {
        const unlockReqs = (job.unlockRequires as Array<Record<string, unknown>>) ?? [];
        for (const req of unlockReqs) {
          if (req.jobId === entryKey) {
            refs.push({
              scope: 'jobs',
              id: jobKey,
              label: (job.displayName as string) || jobKey,
              href: `/admin/jobs/${jobKey}`,
              context: `転職条件 Lv${req.minLevel ?? '?'}`,
            });
          }
        }
      }
      break;
    }
    case 'stages': {
      for (const [stageKey, stage] of Object.entries(data.stages)) {
        const reqs = (stage.unlockRequires as string[]) ?? [];
        if (reqs.includes(entryKey)) {
          refs.push({
            scope: 'stages',
            id: stageKey,
            label: (stage.nameJa as string) || stageKey,
            href: `/admin/stages/${stageKey}`,
            context: '解放条件として参照',
          });
        }
      }
      break;
    }
    case 'demonForms': {
      const form = data.demonForms[entryKey];
      if (form) {
        const jobId = form.jobId as string;
        if (jobId && data.jobs[jobId]) {
          const job = data.jobs[jobId];
          refs.push({
            scope: 'jobs',
            id: jobId,
            label: (job.displayName as string) || jobId,
            href: `/admin/jobs/${jobId}`,
            context: '対応職業',
          });
        }
      }
      break;
    }
    case 'monsters':
    default:
      break;
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Public: get single entry
// ---------------------------------------------------------------------------
export async function getEntry(
  fileKey: keyof MasterDataCollection,
  entryKey: string,
): Promise<Record<string, unknown> | null> {
  assertDev();
  const data = await getMasterFile(fileKey);
  const entry = data[entryKey];
  return entry ?? null;
}

// ---------------------------------------------------------------------------
// Public: save entry (create or update)
// ---------------------------------------------------------------------------
async function saveEntryImpl(
  fileKey: keyof MasterDataCollection,
  entryKey: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const filePath = path.join(MASTER_DIR, MASTER_FILE_MAP[fileKey]);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const collection = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    collection[entryKey] = data;
    writeJsonAtomic(filePath, collection);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const saveEntry = withDevGuard(saveEntryImpl);

// ---------------------------------------------------------------------------
// Public: delete entry
// ---------------------------------------------------------------------------
async function deleteEntryImpl(
  fileKey: keyof MasterDataCollection,
  entryKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const filePath = path.join(MASTER_DIR, MASTER_FILE_MAP[fileKey]);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const collection = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    delete collection[entryKey];
    writeJsonAtomic(filePath, collection);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const deleteEntry = withDevGuard(deleteEntryImpl);

// ---------------------------------------------------------------------------
// Story: read scenes
// ---------------------------------------------------------------------------
type StoryScenesFile = {
  scenes: StoryScene[];
};

type StorySceneLocation = {
  pack: StoryPack;
  data: StoryScenesFile;
  index: number;
};

function getStoryFilePath(fileName: string): string {
  return path.join(STORY_DIR, fileName);
}

function readStoryScenesFile(fileName: string): StoryScenesFile {
  const raw = fs.readFileSync(getStoryFilePath(fileName), 'utf-8');
  const data = JSON.parse(raw) as StoryScenesFile;
  return { scenes: Array.isArray(data.scenes) ? data.scenes : [] };
}

function writeStoryScenesFile(fileName: string, data: StoryScenesFile): void {
  const sorted = { scenes: sortStoryScenes(data.scenes) };
  writeJsonAtomic(getStoryFilePath(fileName), sorted);
}

function findStorySceneLocation(id: string): StorySceneLocation | null {
  for (const pack of STORY_PACKS) {
    const data = readStoryScenesFile(pack.fileName);
    const index = data.scenes.findIndex(scene => scene.id === id);
    if (index >= 0) {
      return { pack, data, index };
    }
  }
  return null;
}

function requireStoryPackForScene(scene: StoryScene): StoryPack {
  const pack = getStoryPackForArchiveChapter(scene.archiveChapter);
  if (!pack) {
    throw new Error(`archiveChapter=${scene.archiveChapter} に対応するストーリーJSONパックがありません。`);
  }
  return pack;
}

export async function getStoryScenes(): Promise<StoryScene[]> {
  assertDev();
  const scenes = STORY_PACKS.flatMap(pack => readStoryScenesFile(pack.fileName).scenes);
  return sortStoryScenes(scenes);
}

export async function getStoryPackSummaries(): Promise<StoryPackSummary[]> {
  assertDev();
  return STORY_PACKS.map(pack => ({
    id: pack.id,
    fileName: pack.fileName,
    label: pack.label,
    archiveChapterRange: pack.archiveChapterRange,
    sceneCount: readStoryScenesFile(pack.fileName).scenes.length,
  }));
}

export async function getStoryScenesForPack(packId: string): Promise<StoryScene[] | null> {
  assertDev();
  const pack = STORY_PACKS.find(p => p.id === packId);
  if (!pack) return null;
  const data = readStoryScenesFile(pack.fileName);
  return sortStoryScenes(data.scenes);
}

export async function getStoryScene(id: string): Promise<StoryScene | null> {
  assertDev();
  const location = findStorySceneLocation(id);
  return location?.data.scenes[location.index] ?? null;
}

// ---------------------------------------------------------------------------
// Story: save scene (create or update)
// ---------------------------------------------------------------------------
export async function saveStoryScene(
  scene: StoryScene,
): Promise<{ success: boolean; error?: string }> {
  assertDev();
  try {
    if (!scene.id.trim()) {
      throw new Error('シーンIDは必須です。');
    }

    const targetPack = requireStoryPackForScene(scene);
    const existing = findStorySceneLocation(scene.id);

    if (existing && existing.pack.fileName !== targetPack.fileName) {
      existing.data.scenes.splice(existing.index, 1);
      writeStoryScenesFile(existing.pack.fileName, existing.data);

      const targetData = readStoryScenesFile(targetPack.fileName);
      targetData.scenes.push(scene);
      writeStoryScenesFile(targetPack.fileName, targetData);
    } else if (existing) {
      existing.data.scenes[existing.index] = scene;
      writeStoryScenesFile(existing.pack.fileName, existing.data);
    } else {
      const targetData = readStoryScenesFile(targetPack.fileName);
      targetData.scenes.push(scene);
      writeStoryScenesFile(targetPack.fileName, targetData);
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Story: delete scene
// ---------------------------------------------------------------------------
export async function deleteStoryScene(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  assertDev();
  try {
    const existing = findStorySceneLocation(id);
    if (!existing) {
      throw new Error(`シーン "${id}" が登録済みパックに存在しません。`);
    }

    existing.data.scenes.splice(existing.index, 1);
    writeStoryScenesFile(existing.pack.fileName, existing.data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Story: characters
// ---------------------------------------------------------------------------
export async function getStoryCharacters(): Promise<Record<string, StoryCharacter>> {
  assertDev();
  const filePath = path.join(STORY_DIR, 'characters.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, StoryCharacter>;
}

export async function saveStoryCharacter(
  char: StoryCharacter,
): Promise<{ success: boolean; error?: string }> {
  assertDev();
  try {
    const id = normalizeManagedId(char.id, 'キャラクターID');
    const filePath = path.join(STORY_DIR, 'characters.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, StoryCharacter>;
    data[id] = { ...char, id };
    writeJsonAtomic(filePath, data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteStoryCharacter(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  assertDev();
  try {
    const normalizedId = normalizeManagedId(id, 'キャラクターID');
    if (normalizedId === 'narrator') {
      throw new Error('narrator は削除できません。');
    }
    const filePath = path.join(STORY_DIR, 'characters.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, StoryCharacter>;
    if (!data[normalizedId]) {
      throw new Error(`キャラクター "${normalizedId}" が存在しません。`);
    }
    delete data[normalizedId];
    writeJsonAtomic(filePath, data);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
