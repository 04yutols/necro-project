#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const stages = readJson('src/data/master/stages.json');
const enemies = readJson('src/data/master/enemies.json');

const args = new Set(process.argv.slice(2));
const showAll = args.has('--all');
const strict = args.has('--strict');
const stageFilter = getArgValue('--stage=');

const TOTAL_EHP_WARN = 2.5;
const TOTAL_EHP_FAIL = 4.0;
const PEAK_THREAT_WARN = 2.0;
const PEAK_THREAT_FAIL = 4.0;
const BACKTRACK_WARN = 0.75;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 100) return String(Math.round(value));
  return value.toFixed(2).replace(/\.00$/, '');
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : `${text}${' '.repeat(width - text.length)}`;
}

function getReviveBonusHp(enemy) {
  const revive = enemy.gimmicks?.find((gimmick) => gimmick.effect === 'REVIVE');
  if (!revive) return 0;

  const hp = enemy.stats?.hp ?? 0;
  const ratio = typeof revive.value === 'number' && revive.value > 0 && revive.value < 1
    ? revive.value
    : 0.5;
  return Math.max(1, Math.floor(hp * ratio));
}

function getSummonBonusHp(enemy) {
  const summon = enemy.gimmicks?.find((gimmick) => gimmick.effect === 'SUMMON_MINIONS');
  if (!summon) return 0;

  const pools = {
    blood_mire_queen: ['bloodmire_leech', 'rot_hound'],
    ossuary_wyrm_lord: ['grave_soldier', 'earthbound_grudge'],
  };
  const pool = pools[enemy.id] ?? ['grave_soldier', 'rot_hound', 'hollow_handmaid'];
  const count = Math.max(0, Math.min(pool.length, Math.floor(summon.value ?? 2)));
  return pool
    .slice(0, count)
    .map((enemyId) => enemies[enemyId]?.stats?.hp ?? 0)
    .reduce((sum, hp) => sum + hp, 0);
}

function getEnemyMetrics(enemy) {
  const hp = enemy.stats?.hp ?? 0;
  const shield = enemy.shieldHp ?? enemy.maxShieldHp ?? 0;
  const effectiveHp = hp + shield + getReviveBonusHp(enemy) + getSummonBonusHp(enemy);
  const critFactor = 1 + ((enemy.stats?.critRate ?? 0) / 100) * ((enemy.stats?.critDmg ?? 150) / 100 - 1);
  const threat = (enemy.stats?.atk ?? 0) * ((enemy.stats?.spd ?? 100) / 100) * critFactor;
  return { effectiveHp, threat };
}

function getWaveMetrics(wave) {
  const entries = wave.enemyIds
    .map((enemyId) => enemies[enemyId])
    .filter(Boolean)
    .map((enemy) => ({ enemy, metrics: getEnemyMetrics(enemy) }));

  return entries.reduce((sum, entry) => ({
    effectiveHp: sum.effectiveHp + entry.metrics.effectiveHp,
    threat: sum.threat + entry.metrics.threat,
  }), { effectiveHp: 0, threat: 0 });
}

function getStageMetrics(stage) {
  const waves = stage.waves.map((wave) => getWaveMetrics(wave));
  return {
    totalEffectiveHp: waves.reduce((sum, wave) => sum + wave.effectiveHp, 0),
    peakWaveThreat: waves.reduce((max, wave) => Math.max(max, wave.threat), 0),
    baseExp: stage.rewards?.baseExp ?? 0,
    baseGold: stage.rewards?.baseGold ?? 0,
    hasRecommendation: Boolean(stage.recommendedLevel || stage.recommendedWeapon),
  };
}

function compareStages(previous, current) {
  const previousMetrics = getStageMetrics(previous);
  const currentMetrics = getStageMetrics(current);
  const totalEhpRatio = currentMetrics.totalEffectiveHp / Math.max(1, previousMetrics.totalEffectiveHp);
  const peakThreatRatio = currentMetrics.peakWaveThreat / Math.max(1, previousMetrics.peakWaveThreat);
  const findings = [];

  if (totalEhpRatio >= TOTAL_EHP_FAIL) {
    findings.push({ level: 'FAIL', message: `総EHPが前ステージ比 ${formatNumber(totalEhpRatio)}x で急上昇` });
  } else if (totalEhpRatio >= TOTAL_EHP_WARN) {
    findings.push({ level: 'WARN', message: `総EHPが前ステージ比 ${formatNumber(totalEhpRatio)}x で高め` });
  }

  if (peakThreatRatio >= PEAK_THREAT_FAIL) {
    findings.push({ level: 'FAIL', message: `最大WAVE脅威度が前ステージ比 ${formatNumber(peakThreatRatio)}x で急上昇` });
  } else if (peakThreatRatio >= PEAK_THREAT_WARN) {
    findings.push({ level: 'WARN', message: `最大WAVE脅威度が前ステージ比 ${formatNumber(peakThreatRatio)}x で高め` });
  }

  if (totalEhpRatio <= BACKTRACK_WARN && current.difficulty > previous.difficulty) {
    findings.push({ level: 'WARN', message: `難易度上昇に対して総EHPが低下 (${formatNumber(totalEhpRatio)}x)` });
  }

  if (!currentMetrics.hasRecommendation && (totalEhpRatio >= TOTAL_EHP_WARN || peakThreatRatio >= PEAK_THREAT_WARN)) {
    findings.push({ level: 'WARN', message: '急な難度上昇に対する recommendedLevel / recommendedWeapon が未設定' });
  }

  return {
    previous,
    current,
    previousMetrics,
    currentMetrics,
    totalEhpRatio,
    peakThreatRatio,
    findings,
  };
}

function printStage(stage, metrics) {
  const rec = stage.recommendedLevel || stage.recommendedWeapon
    ? `rec Lv.${stage.recommendedLevel ?? '-'} / ${stage.recommendedWeapon ?? '-'}`
    : 'rec -';
  console.log(
    `  ${pad(stage.id, 14)} diff ${pad(stage.difficulty, 2)} EHP ${pad(formatNumber(metrics.totalEffectiveHp), 6)}`
    + ` peakTHR ${pad(formatNumber(metrics.peakWaveThreat), 7)} EXP ${pad(metrics.baseExp, 4)} Gold ${pad(metrics.baseGold, 5)} ${rec}`
  );
}

function main() {
  const combatStages = Object.values(stages)
    .filter((stage) => stage.waves?.length)
    .sort((a, b) => (a.chapter - b.chapter) || (a.area - b.area) || (a.difficulty - b.difficulty));

  const comparisons = combatStages
    .slice(1)
    .map((stage, index) => compareStages(combatStages[index], stage))
    .filter((comparison) => !stageFilter || comparison.current.id === stageFilter || comparison.previous.id === stageFilter);

  if (comparisons.length === 0) {
    console.error(stageFilter ? `No adjacent combat stage found: ${stageFilter}` : 'No adjacent combat stages found.');
    process.exit(1);
  }

  const visibleComparisons = showAll
    ? comparisons
    : comparisons.filter((comparison) => comparison.findings.length > 0);

  console.log('Necromance Brave progression report');
  console.log(`Targets: ${stageFilter ?? 'all adjacent combat stages'}\n`);

  for (const comparison of visibleComparisons) {
    console.log(`${comparison.previous.id} -> ${comparison.current.id}`);
    printStage(comparison.previous, comparison.previousMetrics);
    printStage(comparison.current, comparison.currentMetrics);
    console.log(`  ratio: EHP ${formatNumber(comparison.totalEhpRatio)}x / peakTHR ${formatNumber(comparison.peakThreatRatio)}x`);
    for (const finding of comparison.findings) {
      console.log(`  ${finding.level}: ${finding.message}`);
    }
    console.log('');
  }

  const allFindings = comparisons.flatMap((comparison) => comparison.findings);
  if (allFindings.length === 0) {
    console.log('OK: progression cliff warnings were not detected.');
  } else {
    console.log(`Summary: ${allFindings.length} warning(s) detected.`);
  }

  if (strict && allFindings.some((finding) => finding.level === 'FAIL')) {
    process.exit(2);
  }
}

main();
