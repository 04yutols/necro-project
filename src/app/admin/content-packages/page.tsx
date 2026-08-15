import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import type { ContentChange } from '@/lib/content/contentBundle';
import type { AssetRecord, ContentPackage, ContentReviewItemState } from '@/lib/content/contentPackage';
import { getContentReviewReadiness, getContentReviewSummary, syncContentReviewItems } from '@/lib/content/contentReviewWorkflow';
import { inspectFileTransaction } from '@/lib/content/contentTransaction';
import { standardAssetContactSheetPath } from '@/lib/content/assetSpec';
import { ContentPackageWorkflowControls, ContentReviewItemControls } from '@/components/admin/ContentReviewControls';

export const dynamic = 'force-dynamic';

type PackageView = {
  pkg: ContentPackage;
  fileName: string;
  availableAssets: Set<string>;
  contactSheet: boolean;
};

type FlatValue = string | number | boolean | null;

const stateColor: Record<string, string> = {
  PASS: '#65d9a6', READY: '#65d9a6', APPLIED: '#65d9a6', APPROVED: '#65d9a6',
  WARN: '#f0c66c', INCOMPLETE: '#f0c66c', PLANNED: '#a78bfa', PENDING: '#a78bfa', RUNNING: '#60a5fa', VALIDATED: '#60a5fa', REVIEWED: '#c4b5fd', DRAFT: '#a78bfa',
  FAIL: '#f87171', BLOCKED: '#f87171', PARTIAL: '#f87171', CHANGES_REQUESTED: '#f87171',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function exists(relativePath: string | undefined): Promise<boolean> {
  if (!relativePath) return false;
  try {
    await fs.access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function loadPackages(): Promise<PackageView[]> {
  const directory = path.join(process.cwd(), 'content/packages');
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const packages: PackageView[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(directory, entry.name), 'utf8')) as ContentPackage;
      if (pkg.schemaVersion !== 2 || !Array.isArray(pkg.targets)) continue;
      const availability = await Promise.all(pkg.assets.map(async asset => [asset.id, await exists(asset.sourcePath ?? asset.originalPath)] as const));
      packages.push({
        pkg,
        fileName: entry.name,
        availableAssets: new Set(availability.filter(([, present]) => present).map(([id]) => id)),
        contactSheet: await exists(standardAssetContactSheetPath(pkg.id)),
      });
    } catch {
      // Invalid JSON remains visible to the CLI validator, not the review reader.
    }
  }
  return packages.sort((a, b) => Number(Boolean(b.pkg.orchestration)) - Number(Boolean(a.pkg.orchestration)) || a.pkg.id.localeCompare(b.pkg.id));
}

async function masterRecord(change: ContentChange): Promise<unknown> {
  const masterFile: Partial<Record<ContentChange['scope'], string>> = {
    enemy: 'enemies.json', monster: 'monsters.json', skill: 'skills.json', job: 'jobs.json', weapon: 'items.json', stage: 'stages.json', 'residue-name': 'residueNames.json',
  };
  const fileName = masterFile[change.scope];
  if (fileName) {
    const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'src/data/master', fileName), 'utf8')) as Record<string, unknown>;
    return data[change.id] ?? null;
  }
  if (change.scope === 'story-character') {
    const data = JSON.parse(await fs.readFile(path.join(process.cwd(), 'src/data/story/characters.json'), 'utf8')) as Record<string, unknown>;
    return data[change.id] ?? null;
  }
  return null;
}

function assetAlt(pkg: ContentPackage, asset: AssetRecord): string {
  return pkg.localization.find(item => item.ownerId === asset.ownerId && item.locale === 'ja' && item.kind === 'alt')?.text ?? asset.kind;
}

function flattenFields(value: unknown, prefix = '', depth = 0): Map<string, FlatValue> {
  const result = new Map<string, FlatValue>();
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    result.set(prefix || 'value', value as FlatValue);
    return result;
  }
  if (Array.isArray(value)) {
    if (value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) result.set(prefix || 'value', value.join(' / '));
    else if (depth < 2) value.forEach((item, index) => flattenFields(item, `${prefix}[${index}]`, depth + 1).forEach((field, key) => result.set(key, field)));
    else result.set(prefix || 'value', `${value.length}件`);
    return result;
  }
  if (isRecord(value) && depth < 3) {
    for (const [key, child] of Object.entries(value)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      flattenFields(child, childPrefix, depth + 1).forEach((field, fieldKey) => result.set(fieldKey, field));
    }
  } else if (isRecord(value)) result.set(prefix || 'value', `${Object.keys(value).length}項目`);
  return result;
}

function displayValue(value: FlatValue | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'なし';
  if (typeof value === 'boolean') return value ? '有効' : '無効';
  return String(value);
}

function SemanticDiff({ before, after }: { before: unknown; after: unknown }) {
  const current = flattenFields(before);
  const proposed = flattenFields(after);
  const fields = [...new Set([...current.keys(), ...proposed.keys()])].filter(key => current.get(key) !== proposed.get(key));
  return (
    <div className="overflow-auto max-h-[34rem] rounded-lg" style={{ border: '1px solid rgba(139,0,255,.14)' }}>
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0" style={{ background: '#100d17', color: '#8f86a6' }}><tr><th className="p-2">項目</th><th className="p-2">現在</th><th className="p-2">提案</th></tr></thead>
        <tbody>{fields.map(field => <tr key={field} style={{ borderTop: '1px solid rgba(139,0,255,.09)' }}><td className="p-2 font-mono" style={{ color: '#9487a3' }}>{field}</td><td className="p-2" style={{ color: '#c9a96c' }}>{displayValue(current.get(field))}</td><td className="p-2" style={{ color: '#d7c5ed' }}>{displayValue(proposed.get(field))}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ReviewControl({ pkg, reviewRef }: { pkg: ContentPackage; reviewRef: string }) {
  const item = pkg.review.items?.find(candidate => candidate.ref === reviewRef);
  const readiness = getContentReviewReadiness(pkg, reviewRef);
  return <ContentReviewItemControls packageId={pkg.id} reviewRef={reviewRef} status={item?.status ?? 'PENDING'} ready={readiness.ready} reasons={readiness.reasons} />;
}

function SimulationPreview({ pkg }: { pkg: ContentPackage }) {
  const simulations = pkg.deliverables.flatMap(deliverable => {
    const simulation = isRecord(deliverable.artifact) && isRecord(deliverable.artifact.simulation) ? deliverable.artifact.simulation : undefined;
    return simulation ? [{ id: deliverable.id, ownerId: deliverable.ownerId, simulation }] : [];
  });
  if (simulations.length === 0) return null;
  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}>
      <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-cinzel text-sm font-bold" style={{ color: '#e0d0ff' }}>BattleEngine シミュレーション</h2><span className="text-[9px] font-mono" style={{ color: '#706779' }}>{simulations.length} runs</span></div>
      <div className="space-y-4">{simulations.map(({ id, ownerId, simulation }) => {
        const metrics = isRecord(simulation.metrics) ? Object.entries(simulation.metrics).filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1])) : [];
        const order = Array.isArray(simulation.actionOrder) ? simulation.actionOrder.filter(isRecord) : [];
        return <article key={id} className="rounded-xl p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.14)' }}>
          <div className="flex justify-between gap-2"><span className="font-mono text-[10px]" style={{ color: '#c8b6dd' }}>{ownerId}</span><span className="text-[9px] font-bold" style={{ color: stateColor[String(simulation.overall)] ?? '#aaa' }}>{String(simulation.overall ?? 'RECORDED')}</span></div>
          {metrics.length > 0 && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">{metrics.map(([name, metric]) => <div key={name} className="rounded p-2" style={{ background: '#0d0a13' }}><div className="text-[9px]" style={{ color: '#756b82' }}>{name}</div><div className="text-base font-mono mt-1" style={{ color: stateColor[String(metric.status)] ?? '#e0d4ee' }}>{String(metric.value ?? '—')}</div><div className="text-[8px] mt-1" style={{ color: '#61586b' }}>{String(metric.summary ?? '')}</div></div>)}</div>}
          {order.length > 0 && <div className="flex gap-1 mt-3 overflow-x-auto pb-1">{order.map((unit, index) => <div key={`${String(unit.id)}:${index}`} className="shrink-0 rounded px-2 py-1 text-[8px]" style={{ color: unit.side === 'ENEMY' ? '#f1a0a0' : '#a9d8c3', border: '1px solid rgba(139,0,255,.15)' }}>{index + 1}. {String(unit.name)} · SPD {String(unit.spd)}</div>)}</div>}
        </article>;
      })}</div>
    </section>
  );
}

function StoryReader({ pkg }: { pkg: ContentPackage }) {
  const scenes = pkg.changes.filter(change => change.scope === 'story-scene').map(change => ({ id: change.id, data: change.data }));
  const triggers = pkg.deliverables.filter(item => item.scope === 'acquisition-link' && item.kind.includes('story') && item.artifact);
  if (scenes.length === 0 && pkg.lore.timelineEvents.length === 0 && triggers.length === 0) return null;
  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}>
      <h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>ストーリー試読</h2>
      <div className="space-y-3">
        {scenes.map(scene => {
          const lines = Array.isArray(scene.data.lines) ? scene.data.lines.filter(isRecord) : [];
          return <article key={scene.id} className="rounded-xl p-4" style={{ background: 'linear-gradient(145deg,#110d16,#07060b)', border: '1px solid rgba(196,181,253,.16)' }}><div className="text-[9px] font-mono" style={{ color: '#73667f' }}>{scene.id}</div><h3 className="font-cinzel text-sm mt-2" style={{ color: '#e7d7bc' }}>{String(scene.data.title ?? scene.id)}</h3><div className="space-y-3 mt-4">{lines.map((line, index) => <div key={index}><div className="text-[9px]" style={{ color: '#9f76d4' }}>{String(line.speakerName ?? line.speakerId ?? '語り')}</div><p className="text-[11px] leading-6 mt-1" style={{ color: '#d3c8da' }}>{String(line.text ?? line.dialogue ?? '')}</p></div>)}</div></article>;
        })}
        {pkg.lore.timelineEvents.map(event => <article key={event.id} className="rounded-xl p-4" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.14)' }}><div className="text-[9px]" style={{ color: '#8f63c8' }}>CH.{event.chapter} · {event.certainty}</div><h3 className="font-cinzel text-xs mt-2" style={{ color: '#e5d7c1' }}>{event.title}</h3><p className="text-[10px] leading-5 mt-2" style={{ color: '#b8adbf' }}>{event.summary}</p></article>)}
        {triggers.map(item => <article key={item.id} className="rounded-xl p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.14)' }}><div className="text-[9px] font-mono" style={{ color: '#8f86a6' }}>{item.id}</div><div className="flex flex-wrap gap-2 mt-2">{[...flattenFields(item.artifact)].map(([key, value]) => <span key={key} className="rounded px-2 py-1 text-[8px]" style={{ color: '#c7b8d8', border: '1px solid rgba(139,0,255,.15)' }}>{key}: {displayValue(value)}</span>)}</div></article>)}
      </div>
    </section>
  );
}

export default async function ContentPackageReviewPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const [views, query] = await Promise.all([loadPackages(), searchParams]);
  const selected = views.find(item => item.pkg.id === query.package) ?? views[0];
  if (!selected) return <div className="max-w-7xl mx-auto px-4 py-8 text-sm" style={{ color: '#8f86a6' }}>Content Package はまだありません。</div>;
  const synced = syncContentReviewItems(selected.pkg).package;
  const pkg = synced;
  const { availableAssets, contactSheet } = selected;
  const diffs = await Promise.all(pkg.changes.map(async change => ({ change, before: await masterRecord(change) })));
  const pending = pkg.deliverables.filter(item => item.required && item.state !== 'READY');
  const failedEvidence = pkg.evidence.filter(item => item.status === 'FAIL' || item.status === 'PENDING');
  const summary = getContentReviewSummary(pkg);
  let snapshotConflicts: string[] = [];
  if (pkg.review.snapshot) {
    try {
      const snapshotPath = path.join(process.cwd(), pkg.review.snapshot);
      const inspection = inspectFileTransaction({ rootDir: process.cwd(), snapshotRootDir: path.join(process.cwd(), '.content-snapshots'), snapshotPath });
      snapshotConflicts = inspection.files.filter(item => item.conflict).map(item => item.targetPath);
    } catch {
      snapshotConflicts = ['snapshot manifestを読み込めません。'];
    }
  }
  const audit = [
    ...pkg.review.history.map(item => ({ id: `${item.at}:${item.to}`, at: item.at, label: `${item.from} → ${item.to}`, actor: item.actor, comment: item.comment ?? `${item.actorType} transition` })),
    ...(pkg.review.audit ?? []).map(item => ({ id: item.id, at: item.at, label: item.action, actor: item.actor, comment: item.comment })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><p className="text-[10px] font-space tracking-[0.28em] uppercase mb-2" style={{ color: '#8B00FF' }}>Content Package / Review Studio</p><h1 className="font-cinzel text-xl font-bold tracking-widest" style={{ color: '#eadfff' }}>{pkg.title}</h1><p className="text-xs mt-2 max-w-3xl" style={{ color: '#8f86a6' }}>{pkg.orchestration?.request.text ?? pkg.brief.playerExperience}</p></div>
        <span className="px-3 py-2 rounded text-[10px] font-mono" style={{ border: '1px solid rgba(139,0,255,.3)', color: stateColor[pkg.status] ?? '#c4b5fd' }}>{pkg.status} · {pkg.orchestration?.state ?? 'MANUAL'} · CH.{pkg.chapter} · r{pkg.revision}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-7">{views.map(view => <Link key={view.pkg.id} href={`/admin/content-packages?package=${encodeURIComponent(view.pkg.id)}`} className="shrink-0 px-3 py-2 rounded text-[10px] font-space" style={{ textDecoration: 'none', color: view.pkg.id === pkg.id ? '#eadfff' : '#8f86a6', background: view.pkg.id === pkg.id ? 'rgba(139,0,255,.18)' : '#111018', border: '1px solid rgba(139,0,255,.24)' }}>{view.pkg.title}</Link>)}</div>

      <ContentPackageWorkflowControls packageId={pkg.id} status={pkg.status} summary={summary} stages={pkg.orchestration?.stages.map(item => item.id) ?? []} snapshot={pkg.review.snapshot} snapshotConflicts={snapshotConflicts} />

      {pkg.orchestration && <section className="rounded-2xl p-4 sm:p-5 mb-7" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="font-cinzel text-sm font-bold tracking-wider" style={{ color: '#e0d0ff' }}>生成パイプライン</h2><span className="text-[10px] font-mono" style={{ color: pkg.orchestration.releaseScope.state === 'IN_SCOPE' ? '#65d9a6' : '#f87171' }}>{pkg.orchestration.releaseScope.state} · {pkg.orchestration.releaseScope.reason}</span></div><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">{pkg.orchestration.stages.map((stage, index) => <article key={stage.id} className="rounded-lg p-3 min-h-32" style={{ background: '#08070d', border: `1px solid ${stateColor[stage.state] ?? '#555'}44` }}><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-mono" style={{ color: '#625b70' }}>{String(index + 1).padStart(2, '0')}</span><span className="text-[9px] font-bold" style={{ color: stateColor[stage.state] ?? '#aaa' }}>{stage.state}</span></div><h3 className="text-xs font-space font-bold mt-2" style={{ color: '#dfd4ef' }}>{stage.id}</h3><p className="text-[9px] leading-4 mt-2" style={{ color: '#81778f' }}>{stage.summary ?? '実行待ち'}</p><p className="text-[9px] font-mono mt-2" style={{ color: '#5f566d' }}>attempt {stage.attempt}</p></article>)}</div></section>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)] gap-7">
        <div className="space-y-7 min-w-0">
          <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-cinzel text-sm font-bold" style={{ color: '#e0d0ff' }}>世界観・制作対象</h2><span className="text-[10px] font-mono" style={{ color: '#8f86a6' }}>{pkg.targets.length} targets</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{pkg.targets.map(target => <article key={target.id} className="rounded-xl p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.16)' }}><div className="flex justify-between gap-2"><h3 className="text-[11px] font-bold" style={{ color: '#e2d6ee' }}>{pkg.localization.find(item => item.ownerId === target.id && item.locale === 'ja' && item.kind === 'name')?.text ?? target.id}</h3><span className="text-[8px]" style={{ color: '#8c65bc' }}>{target.kind}</span></div><p className="text-[9px] leading-4 mt-2" style={{ color: '#81778f' }}>{pkg.lore.entries.find(item => item.id === target.id)?.summary ?? `${target.loreRefs.length}件のLore根拠 / ${pkg.deliverables.filter(item => item.ownerId === target.id).length}成果物`}</p><ReviewControl pkg={pkg} reviewRef={`target:${target.id}`} /></article>)}</div></section>

          <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-cinzel text-sm font-bold" style={{ color: '#e0d0ff' }}>マスターデータ差分</h2><span className="text-[10px] font-mono" style={{ color: '#8f86a6' }}>{diffs.length} changes</span></div><div className="space-y-5">{diffs.map(({ change, before }) => <article key={`${change.scope}:${change.id}`} className="rounded-xl p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.13)' }}><div className="flex items-center gap-2 mb-3"><span className="text-[9px] font-mono px-2 py-1 rounded" style={{ color: before ? '#f0c66c' : '#65d9a6', background: before ? 'rgba(240,198,108,.08)' : 'rgba(101,217,166,.08)' }}>{before ? 'MODIFY' : 'ADD'}</span><span className="text-[10px] font-mono" style={{ color: '#a99fba' }}>{change.scope}:{change.id}</span></div><SemanticDiff before={before} after={change.data} /><ReviewControl pkg={pkg} reviewRef={`change:${change.scope}:${change.id}`} /></article>)}</div></section>

          <SimulationPreview pkg={pkg} />
          <StoryReader pkg={pkg} />

          <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-cinzel text-sm font-bold" style={{ color: '#e0d0ff' }}>画像・コンタクトシート</h2><span className="text-[10px] font-mono" style={{ color: '#8f86a6' }}>{pkg.assets.length} assets</span></div>{contactSheet && <div className="rounded-xl p-2 mb-4" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.15)' }}><img src={`/api/admin/content-assets?packageId=${encodeURIComponent(pkg.id)}&contactSheet=1`} alt={`${pkg.title}の画像コンタクトシート`} className="w-full h-auto rounded" /></div>}<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{pkg.assets.map(asset => <article key={asset.id} className="rounded-xl overflow-hidden" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.18)' }}><div className="h-52 flex items-center justify-center p-3" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(139,0,255,.13), rgba(3,2,7,.98) 70%)' }}>{availableAssets.has(asset.id) ? <img src={`/api/admin/content-assets?packageId=${encodeURIComponent(pkg.id)}&assetId=${encodeURIComponent(asset.id)}`} alt={assetAlt(pkg, asset)} className="max-w-full max-h-full object-contain" /> : <div className="text-center"><div className="text-2xl mb-2" style={{ color: '#3e3150' }}>◇</div><span className="text-[10px]" style={{ color: '#6f667e' }}>原本生成待ち</span></div>}</div><div className="p-3" style={{ borderTop: '1px solid rgba(139,0,255,.12)' }}><div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-mono font-bold truncate" style={{ color: '#e6dcf7' }}>{asset.id}</h3><span className="text-[9px] font-bold" style={{ color: stateColor[asset.state] ?? '#aaa' }}>{asset.state}</span></div><p className="text-[9px] mt-2" style={{ color: '#81778f' }}>{asset.spec?.usage} · {asset.spec?.width}×{asset.spec?.height} · {asset.spec?.transparency}</p><ReviewControl pkg={pkg} reviewRef={`asset:${asset.id}`} /></div></article>)}</div></section>

          {pkg.presentation.length > 0 && <section className="rounded-2xl p-4 sm:p-5" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>スキル VFX / SFX</h2>{pkg.evidence.find(item => item.artifactPath?.endsWith('.svg')) && <img src={`/api/admin/content-assets?packageId=${encodeURIComponent(pkg.id)}&evidence=${encodeURIComponent(path.basename(pkg.evidence.find(item => item.artifactPath?.endsWith('.svg'))!.artifactPath!))}`} alt="VFXとSFXの演出ストーリーボード" className="w-full h-auto rounded-xl mb-4" /> }<div className="grid grid-cols-1 md:grid-cols-2 gap-3">{pkg.presentation.map(item => <article key={item.id} className="rounded-xl p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.15)' }}><div className="flex justify-between"><h3 className="text-[10px] font-mono" style={{ color: '#dcd0e9' }}>{item.effectKey}</h3><span className="text-[9px]" style={{ color: stateColor[item.state] }}>{item.state}</span></div><p className="text-[9px] mt-2" style={{ color: '#81778f' }}>{item.element} · {item.attackType} · impact {item.timeline?.impactMs ?? '—'}ms · damage {item.timeline?.damageTimingsMs?.join(', ') ?? '—'}ms</p><p className="text-[9px] mt-1" style={{ color: '#625b70' }}>{item.sfx?.cues?.map(cue => cue.profileKey).join(' / ') || 'SFX未指定'} / particles {item.vfx?.particleBudget ?? '—'}</p><ReviewControl pkg={pkg} reviewRef={`presentation:${item.id}`} /></article>)}</div></section>}
        </div>

        <aside className="space-y-7 min-w-0">
          <section className="rounded-2xl p-4" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>完成を止めている項目</h2><div className="space-y-2 max-h-96 overflow-auto">{[...pending.map(item => ({ id: item.id, text: `${item.scope}/${item.kind}: ${item.state}` })), ...failedEvidence.map(item => ({ id: item.id, text: `evidence/${item.kind}: ${item.status}` }))].map(item => <div key={item.id} className="rounded px-3 py-2 text-[10px]" style={{ color: '#d8c7ad', background: 'rgba(240,198,108,.06)', border: '1px solid rgba(240,198,108,.14)' }}>{item.text}</div>)}{pending.length === 0 && failedEvidence.length === 0 && <div className="text-[10px]" style={{ color: '#65d9a6' }}>制作上の未完了項目はありません。</div>}</div></section>

          <section className="rounded-2xl p-4" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>検証証跡</h2><div className="space-y-3">{pkg.evidence.map(item => <article key={item.id} className="rounded p-3" style={{ background: '#08070d', border: `1px solid ${stateColor[item.status] ?? '#555'}33` }}><div className="flex justify-between gap-2"><span className="text-[9px] font-mono" style={{ color: '#bbaacd' }}>{item.kind}</span><span className="text-[9px] font-bold" style={{ color: stateColor[item.status] }}>{item.status}</span></div><p className="text-[9px] leading-4 mt-2" style={{ color: '#81778f' }}>{item.summary}</p><ReviewControl pkg={pkg} reviewRef={`evidence:${item.id}`} /></article>)}</div></section>

          <section className="rounded-2xl p-4" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>依存グラフ</h2><div className="space-y-2 max-h-[32rem] overflow-auto">{pkg.dependencies.map(edge => <div key={edge.id} className="rounded p-3" style={{ background: '#08070d', border: '1px solid rgba(139,0,255,.12)' }}><div className="text-[9px] font-mono break-all" style={{ color: '#bca7d9' }}>{edge.from}</div><div className="text-[9px] my-1" style={{ color: '#8B00FF' }}>↓ {edge.relation}</div><div className="text-[9px] font-mono break-all" style={{ color: '#bca7d9' }}>{edge.to}</div><p className="text-[9px] mt-2" style={{ color: '#625b70' }}>{edge.reason}</p></div>)}</div></section>

          <section className="rounded-2xl p-4" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.24)' }}><h2 className="font-cinzel text-sm font-bold mb-4" style={{ color: '#e0d0ff' }}>監査履歴</h2><div className="space-y-3 max-h-[32rem] overflow-auto">{audit.map(item => <div key={item.id} className="pl-3" style={{ borderLeft: '1px solid rgba(139,0,255,.35)' }}><div className="text-[9px] font-mono" style={{ color: '#9671c8' }}>{item.label}</div><div className="text-[9px] mt-1" style={{ color: '#c0b2ce' }}>{item.actor} · {new Date(item.at).toLocaleString('ja-JP')}</div><p className="text-[9px] leading-4 mt-1" style={{ color: '#6f667e' }}>{item.comment}</p></div>)}{audit.length === 0 && <p className="text-[9px]" style={{ color: '#6f667e' }}>最初の判断を記録するとここへ表示されます。</p>}</div></section>
        </aside>
      </div>
    </div>
  );
}
