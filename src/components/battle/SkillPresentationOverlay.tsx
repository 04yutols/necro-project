'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  createPresentationSchedule,
  type SkillPresentationSpec,
} from '../../lib/presentation/skillPresentation';

export type ActiveSkillPresentation = {
  id: number;
  name: string;
  targetIds: number[];
  aoe: boolean;
  spec: SkillPresentationSpec;
  playbackRate: number;
};

type SkillPresentationOverlayProps = {
  effect: ActiveSkillPresentation | null;
  forceReducedMotion?: boolean;
  forceLowDevice?: boolean;
};

function getEffectAnchor(targetIds: number[], aoe: boolean) {
  if (aoe || targetIds.length > 1) return { x: 50, y: 34 };
  const positions: Record<number, { x: number; y: number }> = {
    0: { x: 23, y: 34 },
    1: { x: 50, y: 32 },
    2: { x: 73, y: 34 },
  };
  return positions[targetIds[0]] ?? { x: 50, y: 34 };
}

function Marker({ spec }: { spec: SkillPresentationSpec }) {
  const color = spec.vfx.colors.primary;
  if (spec.vfx.targetMarker === 'NONE') return null;
  if (spec.vfx.targetMarker === 'CROSSHAIR') {
    return (
      <div className="presentation-crosshair" style={{ '--effect-color': color } as CSSProperties}>
        <i/><i/><i/><i/>
      </div>
    );
  }
  return (
    <div className={`presentation-marker presentation-marker--${spec.vfx.targetMarker.toLowerCase()}`} style={{ '--effect-color': color } as CSSProperties}>
      {spec.vfx.targetMarker === 'RUNE' && <span>✦</span>}
    </div>
  );
}

function AttackShape({ spec, reducedMotion }: { spec: SkillPresentationSpec; reducedMotion: boolean }) {
  const { attackType, vfx } = spec;
  const vars = {
    '--effect-primary': vfx.colors.primary,
    '--effect-secondary': vfx.colors.secondary,
    '--effect-accent': vfx.colors.accent,
  } as CSSProperties;

  if (reducedMotion) {
    return <div className="presentation-static-glyph" style={vars}>{attackType === 'HEAL' ? '◇' : attackType === 'SUMMON' ? '♜' : '✦'}</div>;
  }

  if (attackType === 'SLASH') {
    return <div className="presentation-slashes" style={vars}>{[0, 1, 2].map(index => <i key={index} style={{ '--slash-index': index } as CSSProperties}/>)}</div>;
  }
  if (attackType === 'STRIKE') {
    return <div className="presentation-strike" style={vars}><i/><i/><b/></div>;
  }
  if (attackType === 'PROJECTILE') {
    return <div className="presentation-projectile" style={vars}><i/><b/><span/></div>;
  }
  if (attackType === 'MAGIC') {
    return <div className="presentation-magic" style={vars}><i/><i/><span>✦</span></div>;
  }
  if (attackType === 'SUMMON') {
    return <div className="presentation-summon" style={vars}><i/><i/><b/><span>♜</span></div>;
  }
  return <div className="presentation-heal" style={vars}><i/><i/><b>◇</b></div>;
}

export default function SkillPresentationOverlay({ effect, forceReducedMotion, forceLowDevice }: SkillPresentationOverlayProps) {
  const systemReducedMotion = useReducedMotion();
  const [hardwareLowDevice, setHardwareLowDevice] = useState(false);

  useEffect(() => {
    setHardwareLowDevice(typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4);
  }, []);

  const reducedMotion = forceReducedMotion ?? Boolean(systemReducedMotion);
  const lowDevice = forceLowDevice ?? hardwareLowDevice;
  const schedule = useMemo(
    () => effect ? createPresentationSchedule(effect.spec, effect.playbackRate) : null,
    [effect],
  );

  if (!effect || !schedule) return null;

  const { spec } = effect;
  const anchor = getEffectAnchor(effect.targetIds, effect.aoe);
  const reducedBudget = Math.max(0, Math.floor(spec.vfx.particleBudget * spec.accessibility.reducedParticleScale));
  const particleCount = reducedMotion
    ? reducedBudget
    : lowDevice
      ? Math.min(spec.vfx.particleBudget, spec.performance.lowDeviceParticleBudget)
      : spec.vfx.particleBudget;
  const durationSeconds = Math.max(0.1, schedule.totalMs / 1000);
  const styleVars = {
    '--effect-primary': spec.vfx.colors.primary,
    '--effect-secondary': spec.vfx.colors.secondary,
    '--effect-accent': spec.vfx.colors.accent,
    '--effect-duration': `${durationSeconds}s`,
    '--effect-impact-delay': `${schedule.phaseStarts.impact / 1000}s`,
    '--effect-impact-duration': `${Math.max(0.08, spec.timeline.impactMs / effect.playbackRate / 1000)}s`,
  } as CSSProperties;

  return (
    <div
      key={effect.id}
      className={`skill-presentation-overlay${reducedMotion ? ' is-reduced' : ''}`}
      style={styleVars}
      data-effect-key={spec.effectKey}
      data-attack-type={spec.attackType}
      data-renderer={spec.vfx.implementation}
      data-particle-count={particleCount}
      data-low-device={lowDevice}
    >
      <div
        className="presentation-screen-bloom"
        style={{
          background: `radial-gradient(ellipse at ${anchor.x}% ${anchor.y}%, ${spec.vfx.screenFlash.color}${Math.round(spec.vfx.screenFlash.opacity * 255).toString(16).padStart(2, '0')}, transparent 44%)`,
          mixBlendMode: spec.vfx.blendMode,
        }}
      />
      <div className="presentation-anchor" style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, width: effect.aoe ? 300 : 210, height: effect.aoe ? 300 : 210 }}>
        <Marker spec={spec}/>
        <AttackShape spec={spec} reducedMotion={reducedMotion}/>
        <div className="presentation-particles">
          {Array.from({ length: particleCount }, (_, index) => (
            <i
              key={index}
              style={{
                '--particle-index': index,
                '--particle-angle': `${(index * 137.5) % 360}deg`,
                '--particle-distance': `${46 + (index % 7) * 9}px`,
                '--particle-delay': `${(index % 9) * 0.018}s`,
              } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="presentation-name" style={{ left: `${anchor.x}%`, top: `calc(${anchor.y}% - ${effect.aoe ? 142 : 112}px)` }}>
        <small>{spec.label}</small>
        <strong>{effect.name}</strong>
      </div>
      <span className="presentation-shape-cue">{spec.vfx.shapeCue}</span>
      <style jsx global>{`
        .skill-presentation-overlay { position:absolute; inset:0; z-index:32; pointer-events:none; overflow:hidden; }
        .presentation-screen-bloom { position:absolute; inset:0; animation:presentationBloom var(--effect-duration) ease-out both; }
        .presentation-anchor { position:absolute; transform:translate(-50%,-50%); }
        .presentation-name { position:absolute; transform:translateX(-50%); display:grid; justify-items:center; gap:2px; padding:5px 13px; border:1px solid color-mix(in srgb,var(--effect-primary) 58%,transparent); border-radius:999px; background:rgba(5,1,12,.74); color:var(--effect-accent); font-family:'Cinzel',serif; text-shadow:0 0 12px var(--effect-primary); animation:presentationName var(--effect-duration) ease-out both; white-space:nowrap; }
        .presentation-name small { color:var(--effect-primary); font-size:8px; letter-spacing:.16em; }
        .presentation-name strong { font-size:10px; letter-spacing:.08em; }
        .presentation-shape-cue { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
        .presentation-marker,.presentation-crosshair { position:absolute; inset:19%; border:1px solid var(--effect-color); border-radius:50%; filter:drop-shadow(0 0 9px var(--effect-color)); animation:presentationMarker var(--effect-impact-duration) ease-out var(--effect-impact-delay) both; }
        .presentation-marker--rune { border-style:dashed; }
        .presentation-marker--rune::before { content:''; position:absolute; inset:12%; border:1px solid var(--effect-color); transform:rotate(45deg); }
        .presentation-marker--rune span { position:absolute; inset:0; display:grid; place-items:center; color:var(--effect-color); font-size:28px; }
        .presentation-crosshair i { position:absolute; background:var(--effect-color); }
        .presentation-crosshair i:nth-child(1),.presentation-crosshair i:nth-child(2) { width:34%; height:1px; top:50%; }
        .presentation-crosshair i:nth-child(1) { left:-15%; }.presentation-crosshair i:nth-child(2) { right:-15%; }
        .presentation-crosshair i:nth-child(3),.presentation-crosshair i:nth-child(4) { width:1px; height:34%; left:50%; }
        .presentation-crosshair i:nth-child(3) { top:-15%; }.presentation-crosshair i:nth-child(4) { bottom:-15%; }
        .presentation-slashes { position:absolute; inset:8%; transform:rotate(-16deg); }
        .presentation-slashes i { position:absolute; left:-8%; top:calc(35% + var(--slash-index) * 15%); width:116%; height:5px; border-radius:999px; background:linear-gradient(90deg,transparent,var(--effect-primary),var(--effect-accent),var(--effect-primary),transparent); box-shadow:0 0 18px var(--effect-primary); transform:rotate(calc(-9deg + var(--slash-index) * 10deg)) scaleX(0); animation:presentationSlash .5s cubic-bezier(.18,.9,.26,1) calc(var(--effect-impact-delay) + var(--slash-index) * .055s) both; }
        .presentation-strike i { position:absolute; inset:26%; border:3px solid var(--effect-primary); border-radius:50%; animation:presentationRing .54s ease-out var(--effect-impact-delay) both; }
        .presentation-strike i:nth-child(2) { inset:38%; animation-delay:calc(var(--effect-impact-delay) + .08s); }
        .presentation-strike b { position:absolute; left:48%; top:12%; width:7%; height:76%; background:linear-gradient(var(--effect-accent),var(--effect-primary),transparent); clip-path:polygon(50% 0,100% 88%,50% 100%,0 88%); animation:presentationStrike .42s ease-in var(--effect-impact-delay) both; }
        .presentation-projectile i { position:absolute; left:-18%; top:48%; width:85%; height:4px; background:linear-gradient(90deg,transparent,var(--effect-primary),var(--effect-accent)); box-shadow:0 0 14px var(--effect-primary); animation:presentationProjectile calc(var(--effect-impact-delay) + .08s) ease-in both; }
        .presentation-projectile b { position:absolute; left:46%; top:42%; width:16%; aspect-ratio:1; border-radius:50%; background:var(--effect-accent); box-shadow:0 0 24px var(--effect-primary); animation:presentationProjectileCore calc(var(--effect-impact-delay) + .08s) ease-in both; }
        .presentation-projectile span { position:absolute; inset:31%; border:2px solid var(--effect-primary); border-radius:50%; animation:presentationRing var(--effect-impact-duration) ease-out var(--effect-impact-delay) both; }
        .presentation-magic i,.presentation-summon i,.presentation-heal i { position:absolute; inset:19%; border:2px solid var(--effect-primary); border-radius:50%; box-shadow:0 0 24px color-mix(in srgb,var(--effect-primary) 58%,transparent); animation:presentationRune var(--effect-duration) linear both; }
        .presentation-magic i:nth-child(2),.presentation-summon i:nth-child(2),.presentation-heal i:nth-child(2) { inset:32%; border-style:dashed; animation-direction:reverse; }
        .presentation-magic span,.presentation-summon span { position:absolute; inset:0; display:grid; place-items:center; color:var(--effect-accent); font-size:44px; text-shadow:0 0 22px var(--effect-primary); animation:presentationGlyph var(--effect-impact-duration) ease-out var(--effect-impact-delay) both; }
        .presentation-summon b { position:absolute; left:31%; right:31%; bottom:22%; height:48%; border:4px double var(--effect-primary); border-bottom:0; border-radius:48% 48% 0 0; box-shadow:inset 0 0 26px var(--effect-secondary),0 0 24px var(--effect-primary); animation:presentationGate var(--effect-impact-duration) ease-out var(--effect-impact-delay) both; }
        .presentation-heal b { position:absolute; inset:0; display:grid; place-items:center; color:var(--effect-accent); font-size:48px; text-shadow:0 0 20px var(--effect-primary); animation:presentationHeal var(--effect-duration) ease-out both; }
        .presentation-particles { position:absolute; inset:0; }
        .presentation-particles i { position:absolute; left:50%; top:50%; width:4px; height:4px; border-radius:50%; background:var(--effect-accent); box-shadow:0 0 9px var(--effect-primary); transform:rotate(var(--particle-angle)) translateX(0); opacity:0; animation:presentationParticle var(--effect-impact-duration) ease-out calc(var(--effect-impact-delay) + var(--particle-delay)) both; }
        .presentation-static-glyph { position:absolute; inset:18%; display:grid; place-items:center; border:2px double var(--effect-primary); border-radius:50%; color:var(--effect-accent); font-size:48px; background:color-mix(in srgb,var(--effect-secondary) 18%,transparent); box-shadow:0 0 24px var(--effect-primary); animation:presentationReduced var(--effect-duration) ease-out both; }
        .skill-presentation-overlay.is-reduced .presentation-screen-bloom,.skill-presentation-overlay.is-reduced .presentation-marker,.skill-presentation-overlay.is-reduced .presentation-crosshair { animation-name:presentationReduced; }
        @keyframes presentationBloom { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        @keyframes presentationName { 0%{opacity:0;transform:translate(-50%,9px)} 25%{opacity:1;transform:translate(-50%,0)} 78%{opacity:1} 100%{opacity:0} }
        @keyframes presentationMarker { 0%{opacity:0;transform:scale(.45) rotate(-28deg)} 45%{opacity:1} 100%{opacity:0;transform:scale(1.34) rotate(18deg)} }
        @keyframes presentationSlash { 0%{opacity:0;transform:rotate(calc(-9deg + var(--slash-index) * 10deg)) scaleX(0)} 28%{opacity:1} 100%{opacity:0;transform:rotate(calc(-9deg + var(--slash-index) * 10deg)) scaleX(1)} }
        @keyframes presentationRing { 0%{opacity:0;transform:scale(.24)} 35%{opacity:1} 100%{opacity:0;transform:scale(1.65)} }
        @keyframes presentationStrike { 0%{opacity:0;transform:translateY(-48%) scaleY(.3)} 60%{opacity:1;transform:translateY(0) scaleY(1)} 100%{opacity:0} }
        @keyframes presentationProjectile { 0%{opacity:0;transform:translateX(-35%)} 20%{opacity:1} 100%{opacity:0;transform:translateX(78%)} }
        @keyframes presentationProjectileCore { 0%{opacity:0;transform:translateX(-260%)} 20%{opacity:1} 100%{opacity:0;transform:translateX(180%)} }
        @keyframes presentationRune { 0%{opacity:0;transform:scale(.5) rotate(-32deg)} 28%{opacity:1} 78%{opacity:1} 100%{opacity:0;transform:scale(1.08) rotate(52deg)} }
        @keyframes presentationGlyph { 0%{opacity:0;transform:scale(.35)} 48%{opacity:1;transform:scale(1.08)} 100%{opacity:0;transform:scale(1.4)} }
        @keyframes presentationGate { 0%{opacity:0;transform:scaleY(.08);transform-origin:center bottom} 50%{opacity:1;transform:scaleY(1);transform-origin:center bottom} 100%{opacity:0;transform:scaleY(1.08);transform-origin:center bottom} }
        @keyframes presentationHeal { 0%{opacity:0;transform:translateY(34px) scale(.6)} 42%{opacity:1} 100%{opacity:0;transform:translateY(-48px) scale(1.18)} }
        @keyframes presentationParticle { 0%{opacity:0;transform:rotate(var(--particle-angle)) translateX(0) scale(.4)} 24%{opacity:1} 100%{opacity:0;transform:rotate(var(--particle-angle)) translateX(var(--particle-distance)) scale(1.15)} }
        @keyframes presentationReduced { 0%{opacity:0} 30%{opacity:.9} 100%{opacity:0} }
      `}</style>
    </div>
  );
}
