#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const masterDir = path.join(rootDir, 'src/data/master');
const stagesPath = path.join(masterDir, 'stages.json');
const enemiesPath = path.join(masterDir, 'enemies.json');
const yomiFloorsPath = path.join(rootDir, 'src/logic/YomiFloors.ts');

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const force = args.has('--force');
const jsonOutput = args.has('--json');
const floors = parseFloors(getArgValue('--floors='));

const CH1_FINAL_NODE_ID = 'area1_node3';
const YOMI_STAGE_ID_PATTERN = /^yomi_b\d{2,}$/;
const MINION_POOL = ['grave_soldier', 'rot_hound', 'hollow_handmaid', 'earthbound_grudge', 'bloodmire_leech', 'wandering_guard_wraith', 'dragonbone_spawn'];
const ELITE_SHIELD_POOL = ['abyss_warden', 'bone_colossus', 'cursed_head_maid'];
const ELITE_CLOSER_POOL = ['abyss_warden', 'grave_knight', 'bone_colossus', 'cursed_head_maid'];
const BOSS_ENEMY = 'ossuary_wyrm_lord';

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function parseFloors(value) {
  if (!value) return Array.from({ length: 20 }, (_, index) => index + 1);
  const rangeMatch = /^(\d+)-(\d+)$/.exec(value);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      throw new Error(`Invalid --floors range: ${value}`);
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const list = value.split(',').map(part => Number.parseInt(part.trim(), 10));
  if (list.some(floor => !Number.isInteger(floor) || floor < 1)) {
    throw new Error(`Invalid --floors value: ${value}`);
  }
  return [...new Set(list)].sort((a, b) => a - b);
}

function floorId(n) {
  return `yomi_b${String(n).padStart(2, '0')}`;
}

function computeStatScale(n) {
  if (n <= 1) return undefined;
  return {
    hp: Number((1.09 ** (n - 1)).toFixed(4)),
    atk: Number((1.07 ** (n - 1)).toFixed(4)),
    def: Number((1.045 ** (n - 1)).toFixed(4)),
  };
}

function floorType(n) {
  if (n % 10 === 0) return 'BOSS';
  if (n % 5 === 0) return 'ELITE';
  return 'NORMAL';
}

function withScale(wave, scale) {
  return scale ? { ...wave, statScale: scale } : wave;
}

function buildWavesForFloor(n) {
  const idx = n - 1;
  const scale = computeStatScale(n);
  const type = floorType(n);

  if (type === 'BOSS') {
    return [
      withScale({
        label: 'WAVE 1',
        role: 'WARMUP',
        enemyIds: [MINION_POOL[idx % MINION_POOL.length], MINION_POOL[(idx + 3) % MINION_POOL.length]],
        intent: 'ボス戦前の消耗。',
      }, scale),
      withScale({
        label: 'WAVE 2',
        role: 'ELITE',
        enemyIds: ['bone_colossus'],
        intent: '強化ELITEで防壁破壊を練習させる。',
      }, scale),
      withScale({
        label: 'WAVE 3',
        role: 'BOSS',
        enemyIds: [BOSS_ENEMY],
        intent: n === 10
          ? '最初のボス階。HP50%以下の怒りと復活を強化された数値で越える。'
          : '第1章の死骨竜王を黄泉の最深補正で越える最終試練。',
      }, scale),
    ];
  }

  if (type === 'ELITE') {
    return [
      withScale({
        label: 'WAVE 1',
        role: 'WARMUP',
        enemyIds: [MINION_POOL[idx % MINION_POOL.length], MINION_POOL[(idx + 2) % MINION_POOL.length]],
        intent: '節目階の導入戦。',
      }, scale),
      withScale({
        label: 'WAVE 2',
        role: 'SHIELD',
        enemyIds: [ELITE_SHIELD_POOL[idx % ELITE_SHIELD_POOL.length], MINION_POOL[(idx + 4) % MINION_POOL.length]],
        intent: '防壁持ちの精鋭で突破力を確認する。',
      }, scale),
      withScale({
        label: 'WAVE 3',
        role: 'ELITE',
        enemyIds: ['bone_colossus'],
        intent: '節目階の単体ELITE。',
      }, scale),
    ];
  }

  return [
    withScale({
      label: 'WAVE 1',
      role: 'WARMUP',
      enemyIds: [MINION_POOL[idx % MINION_POOL.length], MINION_POOL[(idx + 3) % MINION_POOL.length]],
      intent: '通常階の露払い。',
    }, scale),
    withScale({
      label: 'WAVE 2',
      role: 'SHIELD',
      enemyIds: [MINION_POOL[(idx + 1) % MINION_POOL.length], ELITE_SHIELD_POOL[idx % ELITE_SHIELD_POOL.length]],
      intent: '防壁持ちを混ぜた中盤戦。',
    }, scale),
    withScale({
      label: 'WAVE 3',
      role: 'ELITE',
      enemyIds: [ELITE_CLOSER_POOL[idx % ELITE_CLOSER_POOL.length], MINION_POOL[(idx + 5) % MINION_POOL.length]],
      intent: '精鋭と随伴を倒して次階へ降りる。',
    }, scale),
  ];
}

function buildRewardsForFloor(n) {
  const milestone = [5, 10, 15, 20].includes(n);
  const guaranteed = [
    {
      type: 'MATERIAL',
      itemId: n < 5 ? 'bone_chip' : n < 10 ? 'grave_crystal' : 'ossuary_memory',
      quantity: milestone ? 2 : 1 + Math.floor(n / 7),
    },
  ];
  if (milestone) {
    guaranteed.push({
      type: 'WEAPON_MATERIAL',
      weaponMaterialType: n < 10 ? 'IDEA_SR' : n < 20 ? 'IDEA_SSR' : 'ABYSSAL_OBSIDIAN',
      quantity: 1,
    });
    guaranteed.push({
      type: 'RESIDUE',
      rarity: n < 10 ? 'RARE' : n < 20 ? 'EPIC' : 'LEGENDARY',
      quantity: 1,
    });
  }
  return {
    baseExp: 0,
    baseGold: 0,
    dropTable: [],
    firstClearGuaranteed: guaranteed,
  };
}

function buildStageForFloor(n) {
  const type = floorType(n);
  return {
    id: floorId(n),
    name: `Yomi Depths B${n}`,
    nameJa: `黄泉の階層 B${n}`,
    nameEn: `YOMI B${n}`,
    chapter: 1,
    chapterName: '黄泉の階層',
    area: 99,
    nodeType: 'DUNGEON',
    element: 'DARK',
    difficulty: n,
    sortOrder: 9000 + n,
    description: type === 'BOSS'
      ? `${n}階層ごとのボス階。強化された死骨竜王オッサリウスが待ち構える。`
      : type === 'ELITE'
        ? '黄泉の節目に置かれた精鋭階。初回踏破で宝箱報酬を得る。'
        : '第1章の敵影が再構成された黄泉の通常階。',
    waveCount: 3,
    areaGimmick: 'NONE',
    unlockRequires: [n === 1 ? CH1_FINAL_NODE_ID : floorId(n - 1)],
    waves: buildWavesForFloor(n),
    rewards: buildRewardsForFloor(n),
    position: { x: 900000 + n * 100, y: 900000 },
  };
}

function effectiveStatsForStage(stage, enemies) {
  return stage.waves.flatMap((wave, waveIndex) => wave.enemyIds.map(enemyId => {
    const enemy = enemies[enemyId];
    const scale = wave.statScale ?? {};
    return {
      stageId: stage.id,
      floor: Number.parseInt(stage.id.replace('yomi_b', ''), 10),
      wave: waveIndex + 1,
      role: wave.role,
      enemyId,
      hp: Math.floor(enemy.stats.hp * (scale.hp ?? 1)),
      atk: Math.floor(enemy.stats.atk * (scale.atk ?? 1)),
      def: Math.floor(enemy.stats.def * (scale.def ?? 1)),
      shieldHp: enemy.shieldHp ?? 0,
    };
  }));
}

function selfCheck(stages, enemies, generated) {
  const failures = [];
  const yomiFloorsSource = fs.readFileSync(yomiFloorsPath, 'utf8');
  if (!yomiFloorsSource.includes(`export const CH1_FINAL_NODE_ID = '${CH1_FINAL_NODE_ID}'`)) {
    failures.push(`CH1_FINAL_NODE_ID mismatch: generator=${CH1_FINAL_NODE_ID}`);
  }
  if (!stages[CH1_FINAL_NODE_ID]) {
    failures.push(`Missing CH1 final node: ${CH1_FINAL_NODE_ID}`);
  }

  for (const [id, stage] of Object.entries(generated)) {
    if (!YOMI_STAGE_ID_PATTERN.test(id)) failures.push(`${id}: invalid yomi stage id`);
    if (stage.id !== id) failures.push(`${id}: id must match key`);
    if (stage.nodeType !== 'DUNGEON') failures.push(`${id}: nodeType must be DUNGEON`);
    if ('isAreaBoss' in stage) failures.push(`${id}: isAreaBoss must be omitted`);
    if (stage.chapter !== 1 || stage.area !== 99) failures.push(`${id}: chapter/area must be 1/99`);
    if (stage.rewards.baseExp !== 0 || stage.rewards.baseGold !== 0 || stage.rewards.dropTable.length !== 0) {
      failures.push(`${id}: base rewards and dropTable must be empty`);
    }
    for (const wave of stage.waves) {
      for (const enemyId of wave.enemyIds) {
        if (!enemies[enemyId]) failures.push(`${id}: unknown enemy ${enemyId}`);
      }
      if (wave.role === 'SHIELD' && !wave.enemyIds.some(enemyId => (enemies[enemyId]?.shieldHp ?? 0) > 0)) {
        failures.push(`${id}: SHIELD wave must include shield enemy`);
      }
      if (wave.role === 'BOSS' && !wave.enemyIds.some(enemyId => enemies[enemyId]?.tier === 'BOSS')) {
        failures.push(`${id}: BOSS wave must include boss enemy`);
      }
    }
  }

  const allForChain = { ...stages, ...generated };
  for (const n of floors) {
    const id = floorId(n);
    const stage = generated[id];
    if (!stage) continue;
    const expectedUnlock = n === 1 ? CH1_FINAL_NODE_ID : floorId(n - 1);
    if (stage.unlockRequires.length !== 1 || stage.unlockRequires[0] !== expectedUnlock) {
      failures.push(`${id}: unlockRequires must be [${expectedUnlock}]`);
    }
    if (!allForChain[expectedUnlock]) failures.push(`${id}: missing unlock target ${expectedUnlock}`);
  }

  return failures;
}

function printTextReport(generated, effectiveStats, existingIds) {
  console.log(`Yomi floor generator (${write ? 'write' : 'dry-run'})`);
  console.log(`Target floors: ${floors.map(floor => `B${floor}`).join(', ')}`);
  if (existingIds.length > 0) console.log(`Existing yomi stages: ${existingIds.join(', ')}`);
  console.log('');
  console.log('Generated stage ids:');
  console.log(Object.keys(generated).join(', '));
  console.log('');
  console.log('Effective stats sample:');
  for (const row of effectiveStats.filter(row => row.role === 'BOSS' || row.floor === 1 || row.floor === 5 || row.floor === 10 || row.floor === 20)) {
    console.log(`${row.stageId} W${row.wave} ${row.enemyId}: HP${row.hp} ATK${row.atk} DEF${row.def} SH${row.shieldHp}`);
  }
}

const stages = readJson(stagesPath);
const enemies = readJson(enemiesPath);
const generated = Object.fromEntries(floors.map(floor => [floorId(floor), buildStageForFloor(floor)]));
const existingIds = Object.keys(generated).filter(id => stages[id]);
const effectiveStats = Object.values(generated).flatMap(stage => effectiveStatsForStage(stage, enemies));
const failures = selfCheck(stages, enemies, generated);

if (failures.length > 0) {
  if (jsonOutput) {
    console.log(JSON.stringify({ ok: false, failures }, null, 2));
  } else {
    console.error('Yomi generator self-check failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
  }
  process.exit(1);
}

if (write && existingIds.length > 0 && !force) {
  const message = `Refusing to overwrite existing yomi stages without --force: ${existingIds.join(', ')}`;
  if (jsonOutput) console.log(JSON.stringify({ ok: false, error: message, existingIds }, null, 2));
  else console.error(message);
  process.exit(1);
}

if (write) {
  writeJsonAtomic(stagesPath, { ...stages, ...generated });
}

if (jsonOutput) {
  console.log(JSON.stringify({
    ok: true,
    written: write,
    forced: force,
    floors,
    stageIds: Object.keys(generated),
    stages: generated,
    effectiveStats,
  }, null, 2));
} else {
  printTextReport(generated, effectiveStats, existingIds);
  if (write) console.log(`\nWrote ${Object.keys(generated).length} yomi stages to ${path.relative(rootDir, stagesPath)}`);
}
