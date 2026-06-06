#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const masterDir = path.join(rootDir, 'src/data/master');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const showAll = args.has('--all');
const jsonOutput = args.has('--json');
const typeFilter = normalizeType(getArgValue('--type='));
const idFilter = getArgValue('--id=');

const data = {
  areas: readJson('areas.json'),
  enemies: readJson('enemies.json'),
  stages: readJson('stages.json'),
  items: readJson('items.json'),
  materials: readJson('materials.json'),
  monsters: readJson('monsters.json'),
  skills: readJson('skills.json'),
  jobs: readJson('jobs.json'),
  demonForms: readJson('demonForms.json'),
};

const ELEMENTS = new Set(['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE']);
const TRIBES = new Set(['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC']);
const ENEMY_TIERS = new Set(['MINION', 'ELITE', 'BOSS']);
const NODE_TYPES = new Set(['SAFE', 'DUNGEON', 'BOSS']);
const AREA_GIMMICKS = new Set(['NONE', 'SLIP_DAMAGE', 'STATUS_AILMENT']);
const WAVE_ROLES = new Set(['WARMUP', 'SHIELD', 'ELITE', 'BOSS']);
const DROP_TYPES = new Set(['WEAPON', 'RESIDUE', 'MATERIAL', 'MONSTER', 'CONSUMABLE']);
const ITEM_TYPES = new Set(['WEAPON', 'CONSUMABLE']);
const WEAPON_RARITIES = new Set(['R', 'SR', 'SSR', 'UR']);
const WEAPON_SUBOPTION_RULES = {
  R: { optionCount: 1, elementDamageOptionCount: 0 },
  SR: { optionCount: 1, elementDamageOptionCount: 0 },
  SSR: { optionCount: 2, elementDamageOptionCount: 1 },
  UR: { optionCount: 2, elementDamageOptionCount: 1 },
};
const RESIDUE_RARITIES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const MATERIAL_RARITIES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
const SPRITES = new Set(['WRAITH', 'GIANT', 'WYRM']);
const ATTACK_TYPES = new Set(['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON', 'HEAL']);
const SKILL_TYPES = new Set(['PHYSICAL', 'MAGICAL', 'SUPPORT', 'HEAL']);
const TARGET_TYPES = new Set(['SINGLE', 'ALL_ENEMIES', 'SELF', 'ALLY', 'ALL_ALLIES']);
const GIMMICK_TRIGGERS = new Set(['HP_BELOW_50', 'TURN_3', 'ON_SHIELD_BREAK', 'ON_REVIVE']);
const GIMMICK_EFFECTS = new Set(['ENRAGE', 'AV_DELAY', 'REVIVE', 'SUMMON_MINIONS']);
const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'];
const JOB_BASE_STAT_SAMPLE_LEVELS = [1, 50, 100];

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(masterDir, filename), 'utf8'));
}

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function normalizeType(value) {
  if (!value) return undefined;
  return ({
    enemy: 'enemies',
    enemies: 'enemies',
    area: 'areas',
    areas: 'areas',
    stage: 'stages',
    stages: 'stages',
    item: 'items',
    items: 'items',
    material: 'materials',
    materials: 'materials',
    monster: 'monsters',
    monsters: 'monsters',
    skill: 'skills',
    skills: 'skills',
    job: 'jobs',
    jobs: 'jobs',
    demonForm: 'demonForms',
    demonForms: 'demonForms',
  })[value] ?? value;
}

function createFinding(scope, id, level, message) {
  return { scope, id, level, message };
}

function shouldInclude(scope, id) {
  if (typeFilter && typeFilter !== scope) return false;
  if (idFilter && idFilter !== id) return false;
  return true;
}

function add(findings, scope, id, level, message) {
  if (shouldInclude(scope, id)) findings.push(createFinding(scope, id, level, message));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isElementDamageSubOption(option) {
  return /^(FIRE|WATER|THUNDER|EARTH|WIND|ICE|LIGHT|DARK)_DMG_BOOST$/.test(option?.type);
}

function validateRecordIds(findings, scope, records, options = {}) {
  for (const [key, value] of Object.entries(records)) {
    if (!shouldInclude(scope, key)) continue;
    if (!isObject(value)) {
      add(findings, scope, key, 'FAIL', 'entry must be an object');
      continue;
    }
    if (options.requiresId && value.id !== key) {
      add(findings, scope, key, 'FAIL', `id must match key (${key})`);
    }
    if (!options.requiresId && value.id && value.id !== key) {
      add(findings, scope, key, 'FAIL', `optional id must match key (${key})`);
    }
  }
}

function validateStats(findings, scope, id, stats) {
  if (!isObject(stats)) {
    add(findings, scope, id, 'FAIL', 'stats must be an object');
    return;
  }
  for (const stat of STAT_KEYS) {
    if (!isNumber(stats[stat])) {
      add(findings, scope, id, 'FAIL', `stats.${stat} must be a number`);
    } else if (stats[stat] < 0) {
      add(findings, scope, id, 'FAIL', `stats.${stat} must be >= 0`);
    }
  }
  if (isNumber(stats.critDmg) && stats.critDmg < 100) {
    add(findings, scope, id, 'WARN', 'stats.critDmg is below 100');
  }
}

function jobPowerScore(stats) {
  return Number((
    (stats.hp ?? 0) * 0.15 +
    (stats.atk ?? 0) * 3 +
    (stats.def ?? 0) * 2 +
    (stats.spd ?? 0) +
    (stats.critRate ?? 0) * 2 +
    (stats.critDmg ?? 0) * 0.5 +
    (stats.effectHit ?? 0) * 0.8 +
    (stats.effectRes ?? 0) * 0.8
  ).toFixed(2));
}

function validateResistances(findings, scope, id, resistances, weaknesses) {
  if (!isObject(resistances)) {
    add(findings, scope, id, 'FAIL', 'resistances must be an object');
    return;
  }
  for (const [element, value] of Object.entries(resistances)) {
    if (!ELEMENTS.has(element)) add(findings, scope, id, 'FAIL', `unknown resistance element ${element}`);
    if (!isNumber(value)) add(findings, scope, id, 'FAIL', `resistances.${element} must be a number`);
  }

  if (Array.isArray(weaknesses)) {
    for (const element of weaknesses) {
      if (!ELEMENTS.has(element)) {
        add(findings, scope, id, 'FAIL', `unknown weakness element ${element}`);
      } else if ((resistances[element] ?? 0) >= 0) {
        add(findings, scope, id, 'WARN', `weakness ${element} is not backed by a negative resistance`);
      }
    }

    for (const [element, value] of Object.entries(resistances)) {
      if (value < 0 && !weaknesses.includes(element)) {
        add(findings, scope, id, 'WARN', `negative resistance ${element} is missing from weaknesses`);
      }
    }
  }
}

function validateDropEntry(findings, scope, id, source, drop) {
  if (!isObject(drop)) {
    add(findings, scope, id, 'FAIL', `${source} drop entry must be an object`);
    return;
  }
  if (!DROP_TYPES.has(drop.type)) add(findings, scope, id, 'FAIL', `${source} has unknown drop type ${drop.type}`);
  if (!isNumber(drop.rate) || drop.rate < 0 || drop.rate > 1) {
    add(findings, scope, id, 'FAIL', `${source} drop rate must be between 0 and 1`);
  }

  if (drop.type === 'WEAPON') {
    if (!drop.itemId || !data.items[drop.itemId]) add(findings, scope, id, 'FAIL', `${source} weapon itemId does not exist: ${drop.itemId}`);
    const item = data.items[drop.itemId];
    if (item && item.type !== 'WEAPON') add(findings, scope, id, 'FAIL', `${source} itemId is not a WEAPON: ${drop.itemId}`);
    const rarity = drop.rarity ?? item?.weaponRarity ?? item?.rarity;
    if (!WEAPON_RARITIES.has(rarity)) add(findings, scope, id, 'FAIL', `${source} weapon rarity is invalid: ${rarity}`);
    if (rarity === 'UR' && !drop.isHidden) add(findings, scope, id, 'FAIL', `${source} UR weapon must use isHidden: true`);
  }

  if (drop.type === 'CONSUMABLE') {
    if (!drop.itemId || !data.items[drop.itemId]) add(findings, scope, id, 'FAIL', `${source} consumable itemId does not exist: ${drop.itemId}`);
    const item = data.items[drop.itemId];
    if (item && item.type !== 'CONSUMABLE') add(findings, scope, id, 'FAIL', `${source} itemId is not a CONSUMABLE: ${drop.itemId}`);
  }

  if (drop.type === 'MATERIAL') {
    if (!drop.itemId || !data.materials[drop.itemId]) add(findings, scope, id, 'FAIL', `${source} material itemId does not exist: ${drop.itemId}`);
    if (drop.rarity && !MATERIAL_RARITIES.has(drop.rarity)) add(findings, scope, id, 'FAIL', `${source} material rarity is invalid: ${drop.rarity}`);
  }

  if (drop.type === 'RESIDUE' && !RESIDUE_RARITIES.has(drop.rarity ?? 'COMMON')) {
    add(findings, scope, id, 'FAIL', `${source} residue rarity is invalid: ${drop.rarity}`);
  }

  if (drop.type === 'MONSTER' && (!drop.monsterId || !data.monsters[drop.monsterId])) {
    add(findings, scope, id, 'FAIL', `${source} monsterId does not exist: ${drop.monsterId}`);
  }
}

function validateEnemies(findings) {
  validateRecordIds(findings, 'enemies', data.enemies, { requiresId: true });
  for (const [id, enemy] of Object.entries(data.enemies)) {
    if (!shouldInclude('enemies', id)) continue;
    for (const field of ['name', 'nameJa', 'nameEn', 'tier', 'tribe', 'stats', 'resistances', 'weaknesses', 'dropTable']) {
      if (enemy[field] === undefined) add(findings, 'enemies', id, 'FAIL', `${field} is required`);
    }
    if (!ENEMY_TIERS.has(enemy.tier)) add(findings, 'enemies', id, 'FAIL', `unknown tier ${enemy.tier}`);
    if (!TRIBES.has(enemy.tribe)) add(findings, 'enemies', id, 'FAIL', `unknown tribe ${enemy.tribe}`);
    validateStats(findings, 'enemies', id, enemy.stats);
    validateResistances(findings, 'enemies', id, enemy.resistances, enemy.weaknesses);

    if (enemy.shieldHp !== undefined && !isNumber(enemy.shieldHp)) add(findings, 'enemies', id, 'FAIL', 'shieldHp must be a number');
    if (enemy.maxShieldHp !== undefined && !isNumber(enemy.maxShieldHp)) add(findings, 'enemies', id, 'FAIL', 'maxShieldHp must be a number');
    if (enemy.shieldHp !== undefined && enemy.maxShieldHp !== undefined && enemy.shieldHp !== enemy.maxShieldHp) {
      add(findings, 'enemies', id, 'WARN', 'shieldHp and maxShieldHp differ');
    }
    if (enemy.tier === 'MINION' && (enemy.shieldHp ?? 0) > 0) {
      add(findings, 'enemies', id, 'WARN', 'MINION usually should not have shieldHp');
    }
    if ((enemy.tier === 'ELITE' || enemy.tier === 'BOSS') && !enemy.shieldHp) {
      add(findings, 'enemies', id, 'WARN', `${enemy.tier} has no shieldHp`);
    }

    for (const [index, gimmick] of (enemy.gimmicks ?? []).entries()) {
      if (!GIMMICK_TRIGGERS.has(gimmick.trigger)) add(findings, 'enemies', id, 'FAIL', `gimmicks[${index}].trigger is invalid: ${gimmick.trigger}`);
      if (!GIMMICK_EFFECTS.has(gimmick.effect)) add(findings, 'enemies', id, 'FAIL', `gimmicks[${index}].effect is invalid: ${gimmick.effect}`);
      if (gimmick.value !== undefined && !isNumber(gimmick.value)) add(findings, 'enemies', id, 'FAIL', `gimmicks[${index}].value must be a number`);
    }

    for (const [index, drop] of (enemy.dropTable ?? []).entries()) {
      validateDropEntry(findings, 'enemies', id, `dropTable[${index}]`, drop);
    }

    if (enemy.battle) {
      if (enemy.battle.color && !/^#[0-9a-f]{6}$/i.test(enemy.battle.color)) add(findings, 'enemies', id, 'FAIL', 'battle.color must be #RRGGBB');
      if (enemy.battle.sprite && !SPRITES.has(enemy.battle.sprite)) add(findings, 'enemies', id, 'FAIL', `battle.sprite is invalid: ${enemy.battle.sprite}`);
      if (enemy.battle.size !== undefined && (!isNumber(enemy.battle.size) || enemy.battle.size <= 0)) add(findings, 'enemies', id, 'FAIL', 'battle.size must be a positive number');
    }
  }
}

function validateAreas(findings) {
  validateRecordIds(findings, 'areas', data.areas, { requiresId: true });
  for (const [id, area] of Object.entries(data.areas)) {
    if (!shouldInclude('areas', id)) continue;
    for (const field of ['chapter', 'area', 'nameJa', 'nameEn', 'description', 'color', 'position']) {
      if (area[field] === undefined) add(findings, 'areas', id, 'FAIL', `${field} is required`);
    }
    if (!Number.isInteger(area.chapter) || area.chapter < 1) add(findings, 'areas', id, 'FAIL', 'chapter must be an integer >= 1');
    if (!Number.isInteger(area.area) || area.area < 1) add(findings, 'areas', id, 'FAIL', 'area must be an integer >= 1');
    if (area.color && !/^#[0-9a-f]{6}$/i.test(area.color)) add(findings, 'areas', id, 'FAIL', 'color must be #RRGGBB');
    if (!isObject(area.position) || !isNumber(area.position.x) || !isNumber(area.position.y)) {
      add(findings, 'areas', id, 'FAIL', 'position must include numeric x/y');
    }
  }
}

function validateStages(findings) {
  validateRecordIds(findings, 'stages', data.stages, { requiresId: true });
  const positions = [];
  for (const [id, stage] of Object.entries(data.stages)) {
    if (!shouldInclude('stages', id)) continue;
    for (const field of ['name', 'nameJa', 'nameEn', 'chapter', 'area', 'nodeType', 'element', 'difficulty', 'waveCount', 'unlockRequires', 'waves', 'rewards', 'position']) {
      if (stage[field] === undefined) add(findings, 'stages', id, 'FAIL', `${field} is required`);
    }
    if (!NODE_TYPES.has(stage.nodeType)) add(findings, 'stages', id, 'FAIL', `unknown nodeType ${stage.nodeType}`);
    if (!ELEMENTS.has(stage.element)) add(findings, 'stages', id, 'FAIL', `unknown element ${stage.element}`);
    if (!AREA_GIMMICKS.has(stage.areaGimmick ?? 'NONE')) add(findings, 'stages', id, 'FAIL', `unknown areaGimmick ${stage.areaGimmick}`);
    const areaId = `ch${stage.chapter}_area${stage.area}`;
    if (!data.areas[areaId]) add(findings, 'stages', id, 'FAIL', `references missing area ${areaId}`);
    if (!Array.isArray(stage.unlockRequires)) add(findings, 'stages', id, 'FAIL', 'unlockRequires must be an array');
    for (const requiredId of stage.unlockRequires ?? []) {
      if (!data.stages[requiredId]) add(findings, 'stages', id, 'FAIL', `unlockRequires references missing stage ${requiredId}`);
      if (requiredId === id) add(findings, 'stages', id, 'FAIL', 'stage cannot unlock itself');
    }

    if (!Array.isArray(stage.waves)) {
      add(findings, 'stages', id, 'FAIL', 'waves must be an array');
    } else if (stage.waveCount !== stage.waves.length) {
      add(findings, 'stages', id, 'FAIL', `waveCount ${stage.waveCount} does not match waves.length ${stage.waves.length}`);
    }

    if (stage.nodeType === 'SAFE' && (stage.waves?.length ?? 0) > 0) {
      add(findings, 'stages', id, 'FAIL', 'SAFE stage must not have waves');
    }
    if ((stage.nodeType === 'DUNGEON' || stage.nodeType === 'BOSS') && (stage.waves?.length ?? 0) === 0) {
      add(findings, 'stages', id, 'FAIL', `${stage.nodeType} stage must have waves`);
    }
    if (stage.nodeType === 'BOSS' && !stage.isAreaBoss) {
      add(findings, 'stages', id, 'WARN', 'BOSS stage should set isAreaBoss: true');
    }

    for (const [waveIndex, wave] of (stage.waves ?? []).entries()) {
      if (!WAVE_ROLES.has(wave.role)) add(findings, 'stages', id, 'FAIL', `waves[${waveIndex}].role is invalid: ${wave.role}`);
      if (!Array.isArray(wave.enemyIds) || wave.enemyIds.length === 0) add(findings, 'stages', id, 'FAIL', `waves[${waveIndex}].enemyIds must not be empty`);
      const waveEnemies = (wave.enemyIds ?? []).map((enemyId) => data.enemies[enemyId]).filter(Boolean);
      for (const enemyId of wave.enemyIds ?? []) {
        if (!data.enemies[enemyId]) add(findings, 'stages', id, 'FAIL', `waves[${waveIndex}] references missing enemy ${enemyId}`);
      }
      if (wave.role === 'BOSS' && !waveEnemies.some((enemy) => enemy.tier === 'BOSS')) {
        add(findings, 'stages', id, 'WARN', `waves[${waveIndex}] role BOSS has no BOSS-tier enemy`);
      }
      if (wave.role === 'SHIELD' && !waveEnemies.some((enemy) => (enemy.shieldHp ?? 0) > 0)) {
        add(findings, 'stages', id, 'WARN', `waves[${waveIndex}] role SHIELD has no shielded enemy`);
      }
    }

    if (!isObject(stage.rewards)) {
      add(findings, 'stages', id, 'FAIL', 'rewards must be an object');
    } else {
      if (!isNumber(stage.rewards.baseExp) || stage.rewards.baseExp < 0) add(findings, 'stages', id, 'FAIL', 'rewards.baseExp must be >= 0');
      if (!isNumber(stage.rewards.baseGold) || stage.rewards.baseGold < 0) add(findings, 'stages', id, 'FAIL', 'rewards.baseGold must be >= 0');
      for (const [index, drop] of (stage.rewards.dropTable ?? []).entries()) {
        validateDropEntry(findings, 'stages', id, `rewards.dropTable[${index}]`, drop);
      }
    }

    if (!isObject(stage.position) || !isNumber(stage.position.x) || !isNumber(stage.position.y)) {
      add(findings, 'stages', id, 'FAIL', 'position must include numeric x/y');
    } else {
      positions.push({ id, x: stage.position.x, y: stage.position.y });
    }
  }

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 28 && shouldInclude('stages', a.id)) {
        add(findings, 'stages', a.id, 'WARN', `position is close to ${b.id} (${Math.round(distance)}px)`);
      }
    }
  }

  validateUnlockCycles(findings);
}

function validateUnlockCycles(findings) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(stageId) {
    if (visited.has(stageId)) return;
    if (visiting.has(stageId)) {
      const cycle = [...stack.slice(stack.indexOf(stageId)), stageId].join(' -> ');
      add(findings, 'stages', stageId, 'FAIL', `unlockRequires cycle detected: ${cycle}`);
      return;
    }
    visiting.add(stageId);
    stack.push(stageId);
    for (const requiredId of data.stages[stageId]?.unlockRequires ?? []) {
      if (data.stages[requiredId]) visit(requiredId);
    }
    stack.pop();
    visiting.delete(stageId);
    visited.add(stageId);
  }

  for (const stageId of Object.keys(data.stages)) visit(stageId);
}

function validateItems(findings) {
  validateRecordIds(findings, 'items', data.items, { requiresId: true });
  for (const [id, item] of Object.entries(data.items)) {
    if (!shouldInclude('items', id)) continue;
    if (!ITEM_TYPES.has(item.type)) add(findings, 'items', id, 'FAIL', `unknown item type ${item.type}`);
    if (item.type === 'WEAPON') {
      if (!WEAPON_RARITIES.has(item.rarity)) add(findings, 'items', id, 'FAIL', `invalid weapon rarity ${item.rarity}`);
      if (item.weaponRarity !== item.rarity) add(findings, 'items', id, 'WARN', 'weaponRarity should match rarity');
      if (!['LOW', 'MID', 'HIGH', 'MYTHIC'].includes(item.archetype)) add(findings, 'items', id, 'FAIL', `invalid archetype ${item.archetype}`);
      if (!Number.isInteger(item.rank) || item.rank < 0 || item.rank > 5) add(findings, 'items', id, 'WARN', 'rank should be 0-5 for instances or 1-5 for masters');
      if (!Number.isInteger(item.ilv) || item.ilv < 1 || item.ilv > 90) add(findings, 'items', id, 'FAIL', 'ilv must be 1-90');
      const subOptions = Array.isArray(item.subOptions) ? item.subOptions : [];
      const subOptionRule = WEAPON_SUBOPTION_RULES[item.rarity];
      if (subOptionRule && subOptions.length !== subOptionRule.optionCount) {
        add(findings, 'items', id, 'FAIL', `${item.rarity} weapon must contain ${subOptionRule.optionCount} sub option(s)`);
      }
      const elementDamageOptionCount = subOptions.filter(isElementDamageSubOption).length;
      if (subOptionRule && elementDamageOptionCount !== subOptionRule.elementDamageOptionCount) {
        add(findings, 'items', id, 'FAIL', `${item.rarity} weapon must contain ${subOptionRule.elementDamageOptionCount} element damage sub option(s)`);
      }
      for (const [index, option] of subOptions.entries()) {
        if (!isObject(option) || typeof option.type !== 'string' || !isNumber(option.value)) {
          add(findings, 'items', id, 'FAIL', `subOptions[${index}] must contain string type and numeric value`);
        }
      }
      for (const passiveKey of ['passiveA', 'passiveB']) {
        const passive = item[passiveKey];
        if (!passive) continue;
        if (!Array.isArray(passive.values) || passive.values.length !== 5) {
          add(findings, 'items', id, 'FAIL', `${passiveKey}.values must contain 5 rank values`);
        }
        if (passive.descTemplate && !passive.descTemplate.includes('{value}')) {
          add(findings, 'items', id, 'WARN', `${passiveKey}.descTemplate should include {value}`);
        }
      }
    }
  }
}

function validateMaterials(findings) {
  validateRecordIds(findings, 'materials', data.materials, { requiresId: true });
  for (const [id, material] of Object.entries(data.materials)) {
    if (!shouldInclude('materials', id)) continue;
    if (!material.name) add(findings, 'materials', id, 'FAIL', 'name is required');
    if (!Number.isInteger(material.quantity) || material.quantity < 1) add(findings, 'materials', id, 'FAIL', 'quantity must be >= 1');
    if (!isNumber(material.expValue) || material.expValue <= 0) add(findings, 'materials', id, 'FAIL', 'expValue must be > 0');
    if (!MATERIAL_RARITIES.has(material.rarity)) add(findings, 'materials', id, 'FAIL', `invalid rarity ${material.rarity}`);
  }
}

function validateMonsters(findings) {
  validateRecordIds(findings, 'monsters', data.monsters, { requiresId: false });
  for (const [id, monster] of Object.entries(data.monsters)) {
    if (!shouldInclude('monsters', id)) continue;
    if (!monster.name) add(findings, 'monsters', id, 'FAIL', 'name is required');
    if (!TRIBES.has(monster.tribe)) add(findings, 'monsters', id, 'FAIL', `unknown tribe ${monster.tribe}`);
    if (!Number.isInteger(monster.cost) || monster.cost < 1 || monster.cost > 6) add(findings, 'monsters', id, 'WARN', 'cost should be 1-6');
    validateStats(findings, 'monsters', id, monster.stats);
    validateResistances(findings, 'monsters', id, monster.resistances);
  }
}

function validateJobs(findings) {
  const tier1ScoreSamples = [];
  for (const [id, job] of Object.entries(data.jobs)) {
    if (!shouldInclude('jobs', id)) continue;
    if ('growthModifiers' in job) add(findings, 'jobs', id, 'FAIL', 'growthModifiers is deprecated; edit baseStatsByLevel instead');
    if (!isNumber(job.tier) || job.tier < 1) add(findings, 'jobs', id, 'FAIL', 'tier must be >= 1');
    if (!ATTACK_TYPES.has(job.baseAttackType)) add(findings, 'jobs', id, 'FAIL', `invalid baseAttackType ${job.baseAttackType}`);
    if (!isObject(job.energyCurve)) {
      add(findings, 'jobs', id, 'FAIL', 'energyCurve is required');
    }
    if (!isObject(job.baseStatsByLevel)) {
      add(findings, 'jobs', id, 'FAIL', 'baseStatsByLevel is required');
      continue;
    }

    let previousStats = null;
    for (let level = 1; level <= 100; level += 1) {
      const stats = job.baseStatsByLevel[String(level)];
      if (!isObject(stats)) {
        add(findings, 'jobs', id, 'FAIL', `baseStatsByLevel.${level} is required`);
        continue;
      }
      validateStats(findings, 'jobs', id, stats);
      if (previousStats && stats.hp < previousStats.hp) {
        add(findings, 'jobs', id, 'WARN', `baseStatsByLevel.${level}.hp is lower than previous level`);
      }
      previousStats = stats;
    }

    if (job.tier === 1) {
      for (const level of JOB_BASE_STAT_SAMPLE_LEVELS) {
        const stats = job.baseStatsByLevel[String(level)];
        if (isObject(stats)) tier1ScoreSamples.push(jobPowerScore(stats));
      }
    }
  }

  const tier1Average = tier1ScoreSamples.length > 0
    ? tier1ScoreSamples.reduce((sum, score) => sum + score, 0) / tier1ScoreSamples.length
    : 0;
  if (tier1Average <= 0) return;

  for (const [id, job] of Object.entries(data.jobs)) {
    if (!shouldInclude('jobs', id) || job.tier <= 1 || !isObject(job.baseStatsByLevel)) continue;
    const scores = JOB_BASE_STAT_SAMPLE_LEVELS
      .map((level) => job.baseStatsByLevel[String(level)])
      .filter(isObject)
      .map(jobPowerScore);
    const average = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
    if (average < tier1Average * 1.02) {
      add(findings, 'jobs', id, 'WARN', 'tier 2 power score is too close to tier 1 average');
    }
  }
}

function validateSkills(findings) {
  validateRecordIds(findings, 'skills', data.skills, { requiresId: true });
  const referencedSkillIds = new Set(Object.values(data.jobs).flatMap((job) => (job.skills ?? []).map((skill) => skill.skillId)));
  for (const [id, skill] of Object.entries(data.skills)) {
    if (!shouldInclude('skills', id)) continue;
    if (!SKILL_TYPES.has(skill.type)) add(findings, 'skills', id, 'FAIL', `unknown type ${skill.type}`);
    if (!TARGET_TYPES.has(skill.targetType)) add(findings, 'skills', id, 'FAIL', `unknown targetType ${skill.targetType}`);
    if (!ATTACK_TYPES.has(skill.attackType)) add(findings, 'skills', id, 'FAIL', `unknown attackType ${skill.attackType}`);
    if (!ELEMENTS.has(skill.element)) add(findings, 'skills', id, 'FAIL', `unknown element ${skill.element}`);
    if (!isNumber(skill.mpCost) || skill.mpCost < 0) add(findings, 'skills', id, 'FAIL', 'mpCost must be >= 0');
    if (!isNumber(skill.power) || skill.power < 0) add(findings, 'skills', id, 'FAIL', 'power must be >= 0');
    if (skill.ailmentType && !isNumber(skill.ailmentBaseRate)) add(findings, 'skills', id, 'FAIL', 'ailmentBaseRate is required when ailmentType exists');
    if (!skill.ailmentType && skill.ailmentBaseRate !== undefined) add(findings, 'skills', id, 'FAIL', 'ailmentType is required when ailmentBaseRate exists');
    if (!referencedSkillIds.has(id)) add(findings, 'skills', id, 'WARN', 'skill is not referenced by jobs.json');
  }
  for (const [jobId, job] of Object.entries(data.jobs)) {
    for (const skillRef of job.skills ?? []) {
      if (!data.skills[skillRef.skillId] && (!typeFilter || typeFilter === 'jobs')) {
        add(findings, 'jobs', jobId, 'FAIL', `references missing skill ${skillRef.skillId}`);
      }
    }
  }
}

function validateDemonForms(findings) {
  validateRecordIds(findings, 'demonForms', data.demonForms, { requiresId: false });
  for (const [id, form] of Object.entries(data.demonForms)) {
    if (!shouldInclude('demonForms', id)) continue;
    if (!data.jobs[form.jobId]) add(findings, 'demonForms', id, 'FAIL', `jobId does not exist: ${form.jobId}`);
  }
}

function printFindings(findings) {
  const visible = showAll
    ? findings
    : findings.filter((finding) => finding.level !== 'OK');
  if (jsonOutput) {
    console.log(JSON.stringify({ findings: visible, summary: summarize(findings) }, null, 2));
    return;
  }

  console.log('Necromance Brave master data audit');
  console.log(`Targets: ${typeFilter ?? 'all master data'}${idFilter ? ` / ${idFilter}` : ''}\n`);
  if (visible.length === 0) {
    console.log('OK: master data audit warnings were not detected.');
    return;
  }

  for (const finding of visible) {
    console.log(`${finding.level.padEnd(4)} ${finding.scope}/${finding.id}: ${finding.message}`);
  }
  const summary = summarize(findings);
  console.log(`\nSummary: ${summary.FAIL} fail(s), ${summary.WARN} warn(s).`);
}

function summarize(findings) {
  return findings.reduce((sum, finding) => {
    sum[finding.level] = (sum[finding.level] ?? 0) + 1;
    return sum;
  }, { FAIL: 0, WARN: 0 });
}

function main() {
  const findings = [];
  validateAreas(findings);
  validateEnemies(findings);
  validateStages(findings);
  validateItems(findings);
  validateMaterials(findings);
  validateMonsters(findings);
  validateJobs(findings);
  validateSkills(findings);
  validateDemonForms(findings);
  printFindings(findings);

  if (strict && findings.some((finding) => finding.level === 'FAIL')) {
    process.exit(2);
  }
}

main();
