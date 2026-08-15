import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { isContentPackage, type ContentEvidence, type ContentPackage, type SkillPresentationRecord } from '../src/lib/content/contentPackage';
import { createPresentationSchedule, validateSkillPresentationSpec, type SkillPresentationSpec } from '../src/lib/presentation/skillPresentation';

const ROOT = process.cwd();

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function readPackage(filePath: string): ContentPackage {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isContentPackage(raw)) throw new Error('content:present requires a schemaVersion 2 Content Package.');
  return raw;
}

function runtimeSpec(record: SkillPresentationRecord): SkillPresentationSpec | undefined {
  if (record.state !== 'READY' || !record.element || !record.attackType || !record.label || !record.timeline || !record.vfx || !record.sfx || !record.accessibility || !record.performance) return undefined;
  return {
    effectKey: record.effectKey,
    element: record.element,
    attackType: record.attackType,
    label: record.label,
    timeline: record.timeline,
    vfx: record.vfx,
    sfx: record.sfx,
    accessibility: record.accessibility,
    performance: record.performance,
  };
}

function storyboard(specs: SkillPresentationSpec[]): string {
  const width = 1280;
  const rowHeight = 190;
  const height = 110 + rowHeight * specs.length;
  const rows = specs.map((spec, index) => {
    const y = 88 + index * rowHeight;
    const schedule = createPresentationSchedule(spec);
    const phases = [
      ['CAST', spec.timeline.castMs, '#6d28d9'],
      ['TRAVEL', spec.timeline.travelMs, '#2563eb'],
      ['IMPACT', spec.timeline.impactMs, '#dc2626'],
      ['AFTERMATH', spec.timeline.aftermathMs, '#a16207'],
    ] as const;
    const total = phases.reduce((sum, phase) => sum + phase[1], 0);
    let cursor = 0;
    const bars = phases.map(([label, duration, color]) => {
      const x = 330 + cursor / total * 870;
      const w = Math.max(1, duration / total * 870);
      cursor += duration;
      return `<rect x="${x}" y="${y + 62}" width="${w}" height="30" rx="3" fill="${color}" opacity=".82"/><text x="${x + 8}" y="${y + 82}" fill="#fff" font-size="11" font-family="monospace">${label}</text>`;
    }).join('');
    const hits = schedule.damageTimingsMs.map((time, hitIndex) => {
      const x = 330 + time / schedule.totalMs * 870;
      return `<path d="M${x} ${y + 53}V${y + 102}" stroke="${spec.vfx.colors.accent}" stroke-width="3"/><text x="${x + 5}" y="${y + 51}" fill="${spec.vfx.colors.accent}" font-size="10" font-family="monospace">HIT ${hitIndex + 1} ${time}ms</text>`;
    }).join('');
    const cues = spec.sfx.cues.map(cue => escapeXml(`${cue.layer}:${cue.profileKey}@${cue.atMs}ms p${cue.pitch}`)).join('  ·  ');
    return `<g>
      <rect x="40" y="${y}" width="1160" height="162" rx="14" fill="#0e0b15" stroke="#8b00ff" stroke-opacity=".34"/>
      <circle cx="92" cy="${y + 62}" r="28" fill="${spec.vfx.colors.primary}" opacity=".25" stroke="${spec.vfx.colors.primary}"/>
      <text x="132" y="${y + 35}" fill="#eadfff" font-size="20" font-weight="700" font-family="serif">${escapeXml(spec.label)}</text>
      <text x="132" y="${y + 58}" fill="#a78bfa" font-size="13" font-family="monospace">${escapeXml(spec.effectKey)}</text>
      <text x="132" y="${y + 82}" fill="#8f86a6" font-size="12" font-family="monospace">${spec.element} / ${spec.attackType} / ${spec.vfx.implementation}</text>
      ${bars}${hits}
      <text x="330" y="${y + 122}" fill="#b8aec8" font-size="11" font-family="monospace">SFX ${cues}</text>
      <text x="330" y="${y + 144}" fill="#8f86a6" font-size="11" font-family="sans-serif">${escapeXml(spec.vfx.shapeCue)} · particles ${spec.vfx.particleBudget}/${spec.performance.lowDeviceParticleBudget} · DOM ${spec.vfx.domNodeBudget}/${spec.performance.maxDomNodes} · flash ≤${spec.accessibility.flashHzMax}Hz</text>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#170b23"/><stop offset="1" stop-color="#030106"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="40" y="48" fill="#d4af37" font-size="13" letter-spacing="4" font-family="monospace">NECROMANCE BRAVE / SKILL PRESENTATION EVIDENCE</text>
    ${rows}
  </svg>`;
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

const target = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!target) throw new Error('Usage: npm run content:present -- <package.json>');
const packagePath = path.resolve(ROOT, target);
const pkg = readPackage(packagePath);
const specs = pkg.presentation.map(runtimeSpec).filter((spec): spec is SkillPresentationSpec => Boolean(spec));
if (specs.length === 0) throw new Error('No READY presentation records were found.');

const findings = specs.flatMap(spec => validateSkillPresentationSpec(spec).map(finding => ({ ...finding, effectKey: spec.effectKey })));
for (const finding of findings) console.log(`${finding.level.padEnd(4)} ${finding.effectKey} ${finding.field}: ${finding.message}`);
if (findings.some(finding => finding.level === 'FAIL')) {
  process.exitCode = 2;
} else {
  const relativeArtifactPath = `content/packages/${pkg.id}/reviews/presentation-preview.svg`;
  const artifactPath = path.join(ROOT, relativeArtifactPath);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  const svg = storyboard(specs);
  fs.writeFileSync(artifactPath, svg, 'utf8');
  const contentHash = sha256(svg);
  const at = new Date().toISOString();
  const owners = [...new Set(pkg.presentation.filter(record => record.state === 'READY').map(record => record.ownerId))];
  const generated: ContentEvidence[] = owners.map(ownerId => ({
    id: `${ownerId}_presentation_preview`,
    ownerId,
    kind: 'presentation-preview',
    status: findings.some(finding => finding.level === 'WARN') ? 'WARN' : 'PASS',
    summary: `${specs.filter(spec => pkg.presentation.some(record => record.ownerId === ownerId && record.effectKey === spec.effectKey)).length}演出のtimeline・damage・VFX/SFX・accessibility・performance予算をstoryboard検査。`,
    artifactPath: relativeArtifactPath,
    contentHash,
    createdAt: at,
  }));
  const generatedIds = new Set(generated.map(item => item.id));
  pkg.evidence = [...pkg.evidence.filter(item => !generatedIds.has(item.id)), ...generated];
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`PRESENTED ${specs.length} effect(s): ${relativeArtifactPath}`);
  console.log(`Evidence sha256: ${contentHash}`);
}
