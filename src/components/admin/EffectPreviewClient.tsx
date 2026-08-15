'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SkillPresentationOverlay, { type ActiveSkillPresentation } from '../battle/SkillPresentationOverlay';
import { createPresentationSchedule, type SkillPresentationSpec } from '../../lib/presentation/skillPresentation';
import { useSoundEffects } from '../../hooks/useSoundEffects';

type BackgroundKey = 'CAPITAL' | 'VOID' | 'LIGHT';

const BACKGROUNDS: Record<BackgroundKey, string> = {
  CAPITAL: 'radial-gradient(circle at 50% 30%, rgba(139,0,255,.24), transparent 34%), linear-gradient(180deg,#160d20 0%,#09070d 58%,#020204 100%)',
  VOID: 'radial-gradient(circle at 50% 38%, rgba(76,29,149,.34), transparent 42%), linear-gradient(180deg,#07020d,#000)',
  LIGHT: 'radial-gradient(circle at 50% 36%, rgba(212,175,55,.25), transparent 38%), linear-gradient(180deg,#776d7c,#292330 62%,#0b090d)',
};

export default function EffectPreviewClient({ specs }: { specs: SkillPresentationSpec[] }) {
  const [effectKey, setEffectKey] = useState(specs[0]?.effectKey ?? 'common_magic');
  const [speed, setSpeed] = useState(1);
  const [background, setBackground] = useState<BackgroundKey>('CAPITAL');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowDevice, setLowDevice] = useState(false);
  const [active, setActive] = useState<ActiveSkillPresentation | null>(null);
  const replayId = useRef(0);
  const timers = useRef<number[]>([]);
  const sfx = useSoundEffects();

  const spec = useMemo(() => specs.find(item => item.effectKey === effectKey) ?? specs[0], [effectKey, specs]);
  const schedule = useMemo(() => spec ? createPresentationSchedule(spec, speed) : null, [spec, speed]);

  function clearTimers() {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
  }

  function replay() {
    if (!spec || !schedule) return;
    clearTimers();
    const id = ++replayId.current;
    setActive(null);
    window.requestAnimationFrame(() => {
      setActive({ id, name: spec.label, targetIds: [1], aoe: spec.attackType === 'SUMMON', spec, playbackRate: speed });
      schedule.sfxCues.forEach(cue => {
        timers.current.push(window.setTimeout(() => sfx.presentationCue(cue.profileKey, cue.pitch, cue.volume), cue.atMs));
      });
      timers.current.push(window.setTimeout(() => setActive(current => current?.id === id ? null : current), schedule.totalMs));
    });
  }

  useEffect(() => {
    replay();
    return clearTimers;
    // Replay whenever the selected presentation controls change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectKey, speed, reducedMotion, lowDevice]);

  if (!spec || !schedule) return <div>presentation registry is empty.</div>;

  const phases = [
    ['CAST', 0, spec.timeline.castMs],
    ['TRAVEL', spec.timeline.castMs, spec.timeline.travelMs],
    ['IMPACT', spec.timeline.castMs + spec.timeline.travelMs, spec.timeline.impactMs],
    ['AFTERMATH', spec.timeline.castMs + spec.timeline.travelMs + spec.timeline.impactMs, spec.timeline.aftermathMs],
  ] as const;
  const rawTotal = phases.reduce((sum, phase) => sum + phase[2], 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-[10px] font-space tracking-[0.28em] uppercase mb-2" style={{ color: '#8B00FF' }}>Skill Presentation Forge</p>
          <h1 className="font-cinzel text-xl font-bold tracking-widest" style={{ color: '#eadfff' }}>VFX / SFX タイムライン</h1>
          <p className="text-xs mt-2 max-w-2xl" style={{ color: '#8f86a6' }}>effectKeyごとに演出、ヒット時刻、SFX、アクセシビリティ、低性能端末予算を同じ時計で確認します。</p>
        </div>
        <div className="px-4 py-2 rounded-lg text-xs font-mono" style={{ background: '#111018', border: '1px solid rgba(139,0,255,.3)', color: '#c4b5fd' }}>{specs.length} registry entries</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
        <section className="rounded-2xl overflow-hidden" style={{ background: '#0b0810', border: '1px solid rgba(139,0,255,.26)' }}>
          <div className="flex flex-wrap gap-3 p-4" style={{ borderBottom: '1px solid rgba(139,0,255,.18)' }}>
            <label className="grid gap-1 text-[9px] tracking-widest" style={{ color: '#786f8c' }}>EFFECT KEY
              <select data-testid="effect-key-select" value={effectKey} onChange={event => setEffectKey(event.target.value)} className="rounded px-3 py-2 text-xs font-mono" style={{ background: '#08060d', color: '#ded3ef', border: '1px solid #332641' }}>
                {specs.map(item => <option key={item.effectKey} value={item.effectKey}>{item.effectKey}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[9px] tracking-widest" style={{ color: '#786f8c' }}>SPEED
              <select data-testid="effect-speed-select" value={speed} onChange={event => setSpeed(Number(event.target.value))} className="rounded px-3 py-2 text-xs font-mono" style={{ background: '#08060d', color: '#ded3ef', border: '1px solid #332641' }}>
                {[0.5, 1, 1.5, 2].map(value => <option key={value} value={value}>×{value}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[9px] tracking-widest" style={{ color: '#786f8c' }}>BACKGROUND
              <select data-testid="effect-background-select" value={background} onChange={event => setBackground(event.target.value as BackgroundKey)} className="rounded px-3 py-2 text-xs font-mono" style={{ background: '#08060d', color: '#ded3ef', border: '1px solid #332641' }}>
                <option value="CAPITAL">亡国の王都</option><option value="VOID">深淵</option><option value="LIGHT">明背景</option>
              </select>
            </label>
            <div className="flex items-end gap-3 ml-auto">
              <label className="flex items-center gap-2 px-2 py-2 text-[10px]" style={{ color: '#a99fba' }}><input data-testid="effect-reduced-toggle" type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)}/> 動きを抑制</label>
              <label className="flex items-center gap-2 px-2 py-2 text-[10px]" style={{ color: '#a99fba' }}><input data-testid="effect-low-toggle" type="checkbox" checked={lowDevice} onChange={event => setLowDevice(event.target.checked)}/> 低負荷</label>
              <button data-testid="effect-replay" type="button" onClick={replay} className="rounded px-4 py-2 text-xs font-bold" style={{ background: 'linear-gradient(135deg,#8B00FF,#5b21b6)', color: 'white', border: '1px solid #c084fc' }}>再生</button>
            </div>
          </div>

          <div className="relative h-[460px]" style={{ overflow: 'hidden', background: BACKGROUNDS[background] }} data-testid="effect-preview-stage">
            <div className="absolute left-0 right-0 top-[16%] h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(212,175,55,.28),transparent)' }}/>
            <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 grid place-items-center">
              <div className="w-24 h-36 rounded-[46%_46%_28%_28%]" style={{ background: 'radial-gradient(circle at 50% 28%,#75667e 0 12%,#261c2e 13% 44%,#09070c 72%)', border: '1px solid rgba(212,175,55,.2)', boxShadow: '0 20px 34px #000,0 0 26px rgba(139,0,255,.16)' }}/>
              <span className="mt-3 text-[9px] font-cinzel tracking-widest" style={{ color: '#9c91ad' }}>WRAITH TARGET</span>
            </div>
            <SkillPresentationOverlay effect={active} forceReducedMotion={reducedMotion} forceLowDevice={lowDevice}/>
            <div className="absolute left-4 right-4 bottom-4 rounded-xl p-3" style={{ background: 'rgba(3,1,8,.78)', border: '1px solid rgba(139,0,255,.18)' }}>
              <div className="relative h-2 rounded-full" style={{ background: '#17111e' }}>
                {phases.map(([label, start, duration], index) => <i key={label} title={label} className="absolute top-0 h-full" style={{ left: `${start / rawTotal * 100}%`, width: `${duration / rawTotal * 100}%`, background: ['#6d28d9','#2563eb','#dc2626','#a16207'][index], opacity: .8 }}/>) }
                {active && <b key={active.id} className="absolute -top-1 w-1 h-4 bg-white" style={{ animation: `effectPlayhead ${schedule.totalMs}ms linear both` }}/>} 
              </div>
              <div className="flex justify-between mt-2 text-[8px] font-mono" style={{ color: '#7d738d' }}>{phases.map(([label]) => <span key={label}>{label}</span>)}</div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <SpecCard title="TIMELINE" rows={[
            ['total', `${schedule.totalMs} ms`],
            ['damage', schedule.damageTimingsMs.map(value => `${value}ms`).join(' / ')],
            ['hit stop', `${Math.round(spec.vfx.hitStopMs / speed)} ms`],
          ]}/>
          <SpecCard title="VFX BUDGET" rows={[
            ['renderer', spec.vfx.implementation],
            ['particles', `${spec.vfx.particleBudget} / low ${spec.performance.lowDeviceParticleBudget}`],
            ['DOM', `${spec.vfx.domNodeBudget} / max ${spec.performance.maxDomNodes}`],
            ['frame', `${spec.performance.targetFrameMs} ms`],
            ['marker', spec.vfx.targetMarker],
          ]}/>
          <SpecCard title="ACCESSIBILITY" rows={[
            ['reduced', spec.accessibility.reducedMotion],
            ['flash', `≤ ${spec.accessibility.flashHzMax} Hz`],
            ['shape cue', spec.vfx.shapeCue],
            ['color only', spec.accessibility.colorIndependent ? 'NO' : 'YES'],
          ]}/>
          <SpecCard title="SFX CUES" rows={spec.sfx.cues.map(cue => [cue.layer, `${cue.profileKey} @ ${Math.round(cue.atMs / speed)}ms · p${cue.pitch}`])}/>
        </aside>
      </div>
      <style jsx global>{`@keyframes effectPlayhead { from { left:0 } to { left:100% } }`}</style>
    </div>
  );
}

function SpecCard({ title, rows }: { title: string; rows: readonly (readonly [string, string])[] }) {
  return <section className="rounded-xl p-4" style={{ background: '#0e0b15', border: '1px solid rgba(139,0,255,.2)' }}><h2 className="font-cinzel text-[10px] tracking-[.2em] mb-3" style={{ color: '#d4af37' }}>{title}</h2><dl className="grid grid-cols-[82px_1fr] gap-x-3 gap-y-2 text-[10px]">{rows.map(([label, value], index) => <div key={`${label}-${index}`} className="contents"><dt style={{ color: '#6f667e' }}>{label}</dt><dd className="break-words" style={{ color: '#b8aec8' }}>{value}</dd></div>)}</dl></section>;
}
