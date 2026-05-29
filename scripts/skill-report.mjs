#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const skills = readJson('src/data/master/skills.json');
const jobs = readJson('src/data/master/jobs.json');

const args = new Set(process.argv.slice(2));
const showAll = args.has('--all');
const strict = args.has('--strict');
const skillFilter = getArgValue('--skill=');

const POWER_RANGES = {
  PHYSICAL_SINGLE: {
    1: { low: [1.2, 1.55], mid: [1.45, 1.8], high: [1.7, 2.1] },
    2: { low: [1.4, 1.8], mid: [1.65, 2.1], high: [1.9, 2.4] },
  },
  PHYSICAL_ALL_ENEMIES: {
    1: { low: [0.9, 1.3], mid: [1.25, 1.65], high: [1.5, 1.9] },
    2: { low: [1.1, 1.5], mid: [1.45, 1.9], high: [1.7, 2.15] },
  },
  MAGICAL_SINGLE: {
    1: { low: [1.4, 1.7], mid: [1.6, 2.0], high: [1.9, 2.3] },
    2: { low: [1.55, 1.9], mid: [1.8, 2.25], high: [2.1, 2.5] },
  },
  MAGICAL_ALL_ENEMIES: {
    1: { low: [1.1, 1.45], mid: [1.3, 1.7], high: [1.55, 2.0] },
    2: { low: [1.25, 1.6], mid: [1.5, 1.95], high: [1.75, 2.2] },
  },
};

const POWER_RANGE_TOLERANCE = 0.1;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function getArgValue(prefix) {
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2).replace(/\.00$/, '');
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : `${text}${' '.repeat(width - text.length)}`;
}

function getSkillRefs() {
  const refs = new Map();
  for (const [jobId, job] of Object.entries(jobs)) {
    for (const ref of job.skills ?? []) {
      const current = refs.get(ref.skillId) ?? [];
      current.push({ jobId, displayName: job.displayName ?? job.name ?? jobId, tier: job.tier ?? 1, level: ref.level ?? 1 });
      refs.set(ref.skillId, current);
    }
  }
  return refs;
}

function getCostBand(skill) {
  const cost = skill.mpCost ?? 0;
  if (skill.type === 'PHYSICAL') {
    if (cost <= 8) return 'low';
    if (cost <= 14) return 'mid';
    return 'high';
  }
  if (cost <= 12) return 'low';
  if (cost <= 18) return 'mid';
  return 'high';
}

function getClassKey(skill) {
  const type = skill.type === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';
  const target = skill.targetType === 'ALL_ENEMIES' ? 'ALL_ENEMIES' : 'SINGLE';
  return `${type}_${target}`;
}

function getTier(refs) {
  if (!refs.length) return 1;
  return Math.max(...refs.map((ref) => ref.tier ?? 1));
}

function getPowerRange(skill, tier) {
  if (skill.isUltimate || (skill.mpCost ?? 0) >= 60) {
    const target = skill.targetType === 'ALL_ENEMIES' ? 'aoe' : 'single';
    if (target === 'aoe') return tier >= 2 ? [2.5, 3.5] : [2.0, 2.8];
    return tier >= 2 ? [3.5, 4.8] : [2.8, 3.5];
  }

  const ranges = POWER_RANGES[getClassKey(skill)]?.[tier >= 2 ? 2 : 1];
  return ranges?.[getCostBand(skill)] ?? null;
}

function analyzeSkill(skill, refs) {
  const findings = [];

  if (!refs.length) {
    findings.push({ level: 'WARN', message: 'jobs.jsonから参照されていない' });
  }

  for (const field of ['type', 'targetType', 'attackType', 'element', 'effectKey']) {
    if (!skill[field]) findings.push({ level: 'FAIL', message: `${field} が未設定` });
  }

  const tier = getTier(refs);
  const range = getPowerRange(skill, tier);
  if (range && typeof skill.power === 'number') {
    const [min, max] = range;
    const hasAilment = Boolean(skill.ailmentType && typeof skill.ailmentBaseRate === 'number');
    if (skill.power < min * (1 - POWER_RANGE_TOLERANCE) && !hasAilment) {
      findings.push({ level: 'WARN', message: `power ${formatNumber(skill.power)} が基準下限 ${formatNumber(min)} 未満` });
    } else if (skill.power < min * 0.85) {
      findings.push({ level: 'WARN', message: `状態異常込みでも power ${formatNumber(skill.power)} がかなり低い` });
    }
    if (skill.power > max * (1 + POWER_RANGE_TOLERANCE)) {
      findings.push({ level: 'WARN', message: `power ${formatNumber(skill.power)} が基準上限 ${formatNumber(max)} 超過` });
    }
  }

  if (skill.ailmentType && typeof skill.ailmentBaseRate !== 'number') {
    findings.push({ level: 'FAIL', message: 'ailmentType があるが ailmentBaseRate がない' });
  }
  if (!skill.ailmentType && typeof skill.ailmentBaseRate === 'number') {
    findings.push({ level: 'FAIL', message: 'ailmentBaseRate があるが ailmentType がない' });
  }
  if (typeof skill.ailmentBaseRate === 'number') {
    const budget = (skill.power ?? 0) * 10 + skill.ailmentBaseRate * 100;
    if (budget > 65) {
      findings.push({ level: 'WARN', message: `状態異常budget ${formatNumber(budget)} が高すぎる` });
    } else if (budget < 35) {
      findings.push({ level: 'WARN', message: `状態異常budget ${formatNumber(budget)} が低すぎる` });
    }
  }

  const description = skill.description ?? '';
  const saysDrain = /吸収|回復|生命力/.test(description);
  const hasDrainFlag = skill.healSelfPct || skill.flags?.some((flag) => /DRAIN|HEAL/.test(flag));
  if (saysDrain && !hasDrainFlag) {
    findings.push({ level: 'WARN', message: '説明文はHP吸収/回復だが healSelfPct/flags が未設定' });
  }

  return { tier, range, findings };
}

function main() {
  const refsBySkillId = getSkillRefs();
  const rows = Object.values(skills)
    .filter((skill) => !skillFilter || skill.id === skillFilter)
    .map((skill) => {
      const refs = refsBySkillId.get(skill.id) ?? [];
      return { skill, refs, analysis: analyzeSkill(skill, refs) };
    });

  if (rows.length === 0) {
    console.error(skillFilter ? `No skill found: ${skillFilter}` : 'No skills found.');
    process.exit(1);
  }

  const visibleRows = showAll
    ? rows
    : rows.filter((row) => row.analysis.findings.length > 0);

  console.log('Necromance Brave skill balance report');
  console.log(`Targets: ${skillFilter ?? 'all skills'}\n`);

  for (const row of visibleRows) {
    const skill = row.skill;
    const refs = row.refs.map((ref) => `${ref.displayName}@Lv${ref.level}`).join(', ') || '-';
    const range = row.analysis.range ? `${formatNumber(row.analysis.range[0])}-${formatNumber(row.analysis.range[1])}` : '-';
    console.log(
      `${skill.id} / ${skill.name}`
      + `\n  ${pad(skill.type, 8)} ${pad(skill.targetType, 11)} cost ${pad(skill.mpCost, 3)} power ${pad(formatNumber(skill.power), 5)}`
      + ` tier ${row.analysis.tier} band ${pad(getCostBand(skill), 4)} range ${range}`
      + `\n  refs: ${refs}`
    );
    for (const finding of row.analysis.findings) {
      console.log(`  ${finding.level}: ${finding.message}`);
    }
    console.log('');
  }

  const allFindings = rows.flatMap((row) => row.analysis.findings);
  if (allFindings.length === 0) {
    console.log('OK: skill balance warnings were not detected.');
  } else {
    console.log(`Summary: ${allFindings.length} warning(s) detected.`);
  }

  if (strict && allFindings.some((finding) => finding.level === 'FAIL')) {
    process.exit(2);
  }
}

main();
