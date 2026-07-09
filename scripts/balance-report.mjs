#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const stagesPath = path.join(rootDir, 'src/data/master/stages.json');
const enemiesPath = path.join(rootDir, 'src/data/master/enemies.json');

const stages = JSON.parse(fs.readFileSync(stagesPath, 'utf8'));
const enemies = JSON.parse(fs.readFileSync(enemiesPath, 'utf8'));

const args = new Set(process.argv.slice(2));
const stageFilter = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--stage='))
  ?.slice('--stage='.length);
const showAll = args.has('--all');
const strict = args.has('--strict');

const HP_RATIO_WARN = 1.2;
const HP_RATIO_FAIL = 1.0;
const ATK_RATIO_WARN = 0.9;
const THREAT_RATIO_WARN = 1.0;

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
  const maxHp = enemy.stats?.hp ?? 0;
  const ratio = typeof revive.value === 'number' && revive.value > 0 && revive.value < 1
    ? revive.value
    : 0.5;
  return Math.max(1, Math.floor(maxHp * ratio));
}

function getSummonBonusHp(enemy) {
  const summon = enemy.gimmicks?.find((gimmick) => gimmick.effect === 'SUMMON_MINIONS');
  if (!summon) return 0;

  const pool = enemy.id === 'blood_mire_queen'
    ? ['bloodmire_leech', 'rot_hound']
    : enemy.id === 'ossuary_wyrm_lord'
      ? ['grave_soldier', 'earthbound_grudge']
      : ['grave_soldier', 'rot_hound', 'hollow_handmaid'];
  const count = Math.max(0, Math.min(pool.length, Math.floor(summon.value ?? 2)));
  return pool
    .slice(0, count)
    .map((id) => enemies[id]?.stats?.hp ?? 0)
    .reduce((sum, hp) => sum + hp, 0);
}

function getEnemyMetrics(enemy) {
  const hp = enemy.stats?.hp ?? 0;
  const shield = enemy.shieldHp ?? enemy.maxShieldHp ?? 0;
  const reviveHp = getReviveBonusHp(enemy);
  const summonHp = getSummonBonusHp(enemy);
  const effectiveHp = hp + shield + reviveHp + summonHp;
  const critFactor = 1 + ((enemy.stats?.critRate ?? 0) / 100) * ((enemy.stats?.critDmg ?? 150) / 100);
  const threat = (enemy.stats?.atk ?? 0) * ((enemy.stats?.spd ?? 100) / 100) * critFactor;

  return {
    hp,
    shield,
    reviveHp,
    summonHp,
    effectiveHp,
    atk: enemy.stats?.atk ?? 0,
    def: enemy.stats?.def ?? 0,
    spd: enemy.stats?.spd ?? 0,
    threat,
  };
}

function getWaveEnemies(wave) {
  return wave.enemyIds
    .map((enemyId) => enemies[enemyId])
    .filter(Boolean);
}

function getWaveMetrics(wave) {
  const waveEnemies = getWaveEnemies(wave);
  const entries = waveEnemies.map((enemy) => ({ enemy, metrics: getEnemyMetrics(enemy) }));
  const totals = entries.reduce((sum, entry) => ({
    hp: sum.hp + entry.metrics.hp,
    effectiveHp: sum.effectiveHp + entry.metrics.effectiveHp,
    threat: sum.threat + entry.metrics.threat,
  }), { hp: 0, effectiveHp: 0, threat: 0 });
  const strongest = entries
    .slice()
    .sort((a, b) => b.metrics.effectiveHp - a.metrics.effectiveHp)[0];

  return { entries, totals, strongest };
}

function compareBossWave(stage, wave, waveIndex) {
  const hasBoss = getWaveEnemies(wave).some((enemy) => enemy.tier === 'BOSS');
  if (wave.role !== 'BOSS' && !hasBoss) return [];

  const previousWave = stage.waves[waveIndex - 1];
  if (!previousWave) return [];

  const bossMetrics = getWaveMetrics(wave);
  const previousMetrics = getWaveMetrics(previousWave);
  const boss = bossMetrics.entries.find((entry) => entry.enemy.tier === 'BOSS') ?? bossMetrics.entries[0];
  const previousStrongest = previousMetrics.strongest;
  if (!boss || !previousStrongest) return [];

  const hpRatio = boss.metrics.effectiveHp / Math.max(1, previousStrongest.metrics.effectiveHp);
  const atkRatio = boss.metrics.atk / Math.max(1, previousStrongest.metrics.atk);
  const waveThreatRatio = bossMetrics.totals.threat / Math.max(1, previousMetrics.totals.threat);
  const findings = [];

  if (hpRatio < HP_RATIO_FAIL) {
    findings.push({
      level: 'FAIL',
      message: `ボス実効HPが直前最強敵未満 (${formatNumber(hpRatio)}x)`,
    });
  } else if (hpRatio < HP_RATIO_WARN) {
    findings.push({
      level: 'WARN',
      message: `ボス実効HPが直前最強敵に近すぎる (${formatNumber(hpRatio)}x)`,
    });
  }

  if (atkRatio < ATK_RATIO_WARN) {
    findings.push({
      level: 'WARN',
      message: `ボスATKが直前最強敵より低い (${formatNumber(atkRatio)}x)`,
    });
  }

  if (waveThreatRatio < THREAT_RATIO_WARN) {
    findings.push({
      level: 'WARN',
      message: `BOSS WAVE脅威度が直前WAVE未満 (${formatNumber(waveThreatRatio)}x)`,
    });
  }

  return findings.map((finding) => ({
    ...finding,
    stage,
    wave,
    boss,
    previousWave,
    previousStrongest,
    bossMetrics,
    previousMetrics,
    hpRatio,
    atkRatio,
    waveThreatRatio,
  }));
}

function printWave(stage, wave, waveIndex) {
  const metrics = getWaveMetrics(wave);
  console.log(`  ${wave.label} ${pad(`[${wave.role}]`, 10)} ${wave.intent}`);
  for (const { enemy, metrics: m } of metrics.entries) {
    const gimmicks = enemy.gimmicks?.map((g) => g.effect).join('/') ?? '-';
    console.log(
      `    - ${pad(enemy.id, 22)} ${pad(enemy.nameJa ?? enemy.name, 12)} ${pad(enemy.tier, 6)}`
      + ` HP ${pad(m.hp, 5)} SH ${pad(m.shield, 4)} REV ${pad(m.reviveHp, 4)} SUM ${pad(m.summonHp, 4)}`
      + ` EHP ${pad(m.effectiveHp, 5)} ATK ${pad(m.atk, 4)} DEF ${pad(m.def, 4)} SPD ${pad(m.spd, 4)} THR ${pad(formatNumber(m.threat), 6)} G ${gimmicks}`
    );
  }
  console.log(
    `    total: HP ${formatNumber(metrics.totals.hp)} / EHP ${formatNumber(metrics.totals.effectiveHp)} / THR ${formatNumber(metrics.totals.threat)}`
  );

  const findings = wave.role === 'BOSS' ? compareBossWave(stage, wave, waveIndex) : [];
  for (const finding of findings) {
    console.log(`    ${finding.level}: ${finding.message}`);
  }
  return findings;
}

function main() {
  const selectedStages = Object.values(stages)
    .filter((stage) => stage.waves?.length)
    .filter((stage) => !stageFilter || stage.id === stageFilter)
    .sort((a, b) => (a.chapter - b.chapter) || (a.area - b.area) || (a.difficulty - b.difficulty));

  if (selectedStages.length === 0) {
    console.error(stageFilter ? `No stage found: ${stageFilter}` : 'No combat stages found.');
    process.exit(1);
  }

  const allFindings = [];
  console.log('Necromance Brave balance report');
  console.log(`Targets: ${stageFilter ?? 'all combat stages'}\n`);

  for (const stage of selectedStages) {
    const stageFindings = stage.waves.flatMap((wave, waveIndex) => compareBossWave(stage, wave, waveIndex));
    if (!showAll && stageFindings.length === 0) continue;

    console.log(`${stage.id} / ${stage.nameJa} / difficulty ${stage.difficulty}`);
    stage.waves.forEach((wave, waveIndex) => {
      const findings = printWave(stage, wave, waveIndex);
      allFindings.push(...findings);
    });
    console.log('');
  }

  if (allFindings.length === 0) {
    console.log('OK: boss stat inversion warnings were not detected.');
  } else {
    console.log(`Summary: ${allFindings.length} warning(s) detected.`);
  }

  if (strict && allFindings.some((finding) => finding.level === 'FAIL')) {
    process.exit(2);
  }
}

main();
