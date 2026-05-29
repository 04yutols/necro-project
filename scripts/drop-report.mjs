#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const stages = readJson('src/data/master/stages.json');
const enemies = readJson('src/data/master/enemies.json');
const items = readJson('src/data/master/items.json');
const materials = readJson('src/data/master/materials.json');

const args = new Set(process.argv.slice(2));
const showAll = args.has('--all');
const strict = args.has('--strict');
const stageFilter = getArgValue('--stage=');

const EXPECTED = {
  R_WEAPON: [1, 3],
  SR_WEAPON: [0.05, 1],
  SSR_WEAPON: [0.005, 0.05],
  UR_WEAPON: [0, 0.0002],
  EPIC_RESIDUE: [0.3, 1.2],
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '-';
  if (value > 0 && value < 0.001) return value.toExponential(2);
  if (Math.abs(value) >= 100) return String(Math.round(value));
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : `${text}${' '.repeat(width - text.length)}`;
}

function isWeaponEntry(entry) {
  return entry.type === 'WEAPON';
}

function getEntryRarity(entry) {
  if (entry.rarity) return entry.rarity;
  if (entry.type === 'WEAPON') return items[entry.itemId]?.weaponRarity ?? items[entry.itemId]?.rarity;
  if (entry.type === 'RESIDUE') return entry.rarity ?? 'COMMON';
  if (entry.type === 'MATERIAL') return materials[entry.itemId]?.rarity;
  return items[entry.itemId]?.rarity;
}

function getBucket(entry) {
  const rarity = getEntryRarity(entry);
  if (entry.type === 'WEAPON') return `${rarity ?? 'UNKNOWN'}_WEAPON`;
  if (entry.type === 'RESIDUE') return `${rarity ?? 'COMMON'}_RESIDUE`;
  if (entry.type === 'MATERIAL') return `${rarity ?? 'UNKNOWN'}_MATERIAL`;
  if (entry.type === 'CONSUMABLE') return 'CONSUMABLE';
  if (entry.type === 'MONSTER') return 'MONSTER';
  return entry.type ?? 'UNKNOWN';
}

function getReferenceIssue(entry) {
  if (!entry.itemId) return null;
  if (entry.type === 'WEAPON' || entry.type === 'CONSUMABLE') {
    return items[entry.itemId] ? null : `missing itemId ${entry.itemId}`;
  }
  if (entry.type === 'MATERIAL') {
    return materials[entry.itemId] ? null : `missing materialId ${entry.itemId}`;
  }
  return null;
}

function collectStageDropEntries(stage) {
  const entries = [];
  for (const entry of stage.rewards?.dropTable ?? []) {
    entries.push({ source: `stage:${stage.id}`, entry });
  }
  for (const wave of stage.waves ?? []) {
    for (const enemyId of wave.enemyIds ?? []) {
      const enemy = enemies[enemyId];
      if (!enemy) {
        entries.push({ source: `enemy:${enemyId}`, entry: null, missingEnemy: true });
        continue;
      }
      for (const entry of enemy.dropTable ?? []) {
        entries.push({ source: `enemy:${enemyId}`, entry });
      }
    }
  }
  return entries;
}

function summarizeStage(stage) {
  const totals = new Map();
  const findings = [];
  const entries = collectStageDropEntries(stage);
  const hasBoss = (stage.waves ?? []).some((wave) =>
    (wave.enemyIds ?? []).some((enemyId) => enemies[enemyId]?.tier === 'BOSS' || wave.role === 'BOSS')
  );

  for (const { source, entry, missingEnemy } of entries) {
    if (missingEnemy) {
      findings.push({ level: 'FAIL', message: `${source} is referenced by waves but missing in enemies.json` });
      continue;
    }

    if (typeof entry.rate !== 'number' || entry.rate < 0 || entry.rate > 1) {
      findings.push({ level: 'FAIL', message: `${source} has invalid drop rate ${entry.rate}` });
    }

    const refIssue = getReferenceIssue(entry);
    if (refIssue) {
      findings.push({ level: 'FAIL', message: `${source} ${refIssue}` });
    }

    const bucket = getBucket(entry);
    totals.set(bucket, (totals.get(bucket) ?? 0) + Math.max(0, entry.rate ?? 0));

    const rarity = getEntryRarity(entry);
    if (isWeaponEntry(entry) && rarity === 'UR') {
      if (!entry.isHidden) {
        findings.push({ level: 'FAIL', message: `${source} UR weapon ${entry.itemId} is not hidden` });
      }
      if ((entry.rate ?? 0) > 0.0001) {
        findings.push({ level: 'WARN', message: `${source} UR weapon ${entry.itemId} rate is high (${formatNumber(entry.rate)})` });
      }
    }

    if (isWeaponEntry(entry) && rarity === 'SSR' && ((entry.rate ?? 0) < 0.005 || (entry.rate ?? 0) > 0.02)) {
      findings.push({ level: 'WARN', message: `${source} SSR weapon ${entry.itemId} rate is outside 0.5%-2.0% (${formatNumber(entry.rate)})` });
    }
  }

  const expectedBuckets = Object.entries(EXPECTED).filter(([bucket]) => {
    if (!hasBoss && (bucket === 'SSR_WEAPON' || bucket === 'UR_WEAPON' || bucket === 'EPIC_RESIDUE')) {
      return false;
    }
    return true;
  });

  for (const [bucket, [min, max]] of expectedBuckets) {
    const value = totals.get(bucket) ?? 0;
    if (value < min) {
      findings.push({ level: 'WARN', message: `${bucket} expected count is low (${formatNumber(value)}, target ${formatNumber(min)}-${formatNumber(max)})` });
    } else if (value > max) {
      findings.push({ level: 'WARN', message: `${bucket} expected count is high (${formatNumber(value)}, target ${formatNumber(min)}-${formatNumber(max)})` });
    }
  }

  return { totals, findings, entries };
}

function printStage(stage, summary) {
  console.log(`${stage.id} / ${stage.nameJa} / difficulty ${stage.difficulty}`);
  const sortedBuckets = [...summary.totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [bucket, value] of sortedBuckets) {
    console.log(`  ${pad(bucket, 18)} ${formatNumber(value)}`);
  }
  for (const finding of summary.findings) {
    console.log(`  ${finding.level}: ${finding.message}`);
  }
}

function main() {
  const combatStages = Object.values(stages)
    .filter((stage) => stage.waves?.length)
    .filter((stage) => !stageFilter || stage.id === stageFilter)
    .sort((a, b) => (a.chapter - b.chapter) || (a.area - b.area) || (a.difficulty - b.difficulty));

  if (combatStages.length === 0) {
    console.error(stageFilter ? `No combat stage found: ${stageFilter}` : 'No combat stages found.');
    process.exit(1);
  }

  const summaries = combatStages.map((stage) => ({ stage, summary: summarizeStage(stage) }));
  const visibleSummaries = showAll
    ? summaries
    : summaries.filter(({ summary }) => summary.findings.length > 0);

  console.log('Necromance Brave drop economy report');
  console.log(`Targets: ${stageFilter ?? 'all combat stages'}\n`);

  for (const { stage, summary } of visibleSummaries) {
    printStage(stage, summary);
    console.log('');
  }

  const allFindings = summaries.flatMap(({ summary }) => summary.findings);
  if (allFindings.length === 0) {
    console.log('OK: drop economy warnings were not detected.');
  } else {
    console.log(`Summary: ${allFindings.length} warning(s) detected.`);
  }

  if (strict && allFindings.some((finding) => finding.level === 'FAIL')) {
    process.exit(2);
  }
}

main();
