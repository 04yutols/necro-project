'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FastForward, Pause, Play, SkipForward } from 'lucide-react';
import type { CharacterPortrait as PortraitState, DialogueLine, StoryScene } from '../../types/story';
import { useStoryStore } from '../../store/useStoryStore';
import { TypewriterText } from './TypewriterText';
import { CharacterPortrait, getStoryCharacter } from './CharacterPortrait';

interface Props {
  scene: StoryScene;
  onDone: () => void;
  onSkip: () => void;
}

const BACKGROUND_STYLE: Record<string, { base: string; aura: string; label: string }> = {
  DARK: {
    base: 'linear-gradient(180deg, #020106, #090313 58%, #020106)',
    aura: 'radial-gradient(circle at 50% 44%, rgba(139,0,255,0.22), transparent 42%)',
    label: 'MEMORY DEPTH',
  },
  SEPIA: {
    base: 'linear-gradient(180deg, #160f09, #26170b 54%, #070306)',
    aura: 'radial-gradient(circle at 44% 32%, rgba(212,175,55,0.18), transparent 40%)',
    label: 'OLD MEMORY',
  },
  BLOOD_RED: {
    base: 'linear-gradient(180deg, #120307, #21050c 52%, #050106)',
    aura: 'radial-gradient(circle at 54% 42%, rgba(239,68,68,0.24), transparent 42%)',
    label: 'BLOOD MEMORY',
  },
  RUIN_LIGHT: {
    base: 'linear-gradient(180deg, #080711, #141021 55%, #05030b)',
    aura: 'radial-gradient(circle at 48% 24%, rgba(250,204,21,0.16), transparent 34%)',
    label: 'RUIN LIGHT',
  },
  BLUR_MAP: {
    base: 'linear-gradient(180deg, #05030f, #0a0618 52%, #020106)',
    aura: 'radial-gradient(circle at 50% 40%, rgba(139,0,255,0.2), transparent 44%)',
    label: 'FALLEN CAPITAL',
  },
  STAGE_DARK: {
    base: 'linear-gradient(180deg, #05030f, #120417 52%, #020106)',
    aura: 'radial-gradient(circle at 64% 34%, rgba(239,68,68,0.22), transparent 38%)',
    label: 'DRAGONBONE ALTAR',
  },
};

function resolvePortraits(lines: DialogueLine[], index: number): PortraitState[] {
  let portraits: PortraitState[] = [];
  for (let i = 0; i <= index; i += 1) {
    if (lines[i]?.portraits?.length) {
      portraits = lines[i].portraits ?? [];
    } else if (lines[i]?.speaker && lines[i]?.expression) {
      const speaker = lines[i].speaker;
      portraits = portraits.map(p => p.characterId === speaker ? { ...p, expression: lines[i].expression ?? p.expression } : p);
    }
  }
  return portraits;
}

export function DialogueScene({ scene, onDone, onSkip }: Props) {
  const isViewed = useStoryStore(state => state.isViewed);
  const [lineIndex, setLineIndex] = useState(0);
  const [lineComplete, setLineComplete] = useState(false);
  const [flush, setFlush] = useState(false);
  const [auto, setAuto] = useState(false);

  const current = scene.lines[lineIndex];
  const isLast = lineIndex >= scene.lines.length - 1;
  const character = getStoryCharacter(current?.speaker);
  const canSkip = scene.isSkippable || isViewed(scene.id);
  const bg = BACKGROUND_STYLE[scene.background ?? 'DARK'] ?? BACKGROUND_STYLE.DARK;

  const portraits = useMemo(
    () => resolvePortraits(scene.lines, lineIndex),
    [scene.lines, lineIndex]
  );

  useEffect(() => {
    setLineIndex(0);
    setLineComplete(false);
    setFlush(false);
    setAuto(false);
  }, [scene.id]);

  useEffect(() => {
    if (!auto || !lineComplete) return;
    const timer = window.setTimeout(() => {
      if (isLast) onDone();
      else {
        setLineIndex(i => i + 1);
        setLineComplete(false);
        setFlush(false);
      }
    }, current?.pauseAfter ?? 1550);
    return () => window.clearTimeout(timer);
  }, [auto, lineComplete, isLast, current?.pauseAfter, onDone]);

  const advance = () => {
    if (!current) {
      onDone();
      return;
    }
    if (!lineComplete) {
      setFlush(true);
      return;
    }
    if (isLast) {
      onDone();
      return;
    }
    setLineIndex(i => i + 1);
    setLineComplete(false);
    setFlush(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={advance}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: bg.base,
        color: '#f0eaff',
        touchAction: 'manipulation',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: bg.aura }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.42) 17%, transparent 34%, transparent 64%, rgba(0,0,0,0.72) 100%)',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.14) 0 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          opacity: 0.08,
          maskImage: 'linear-gradient(180deg, transparent, #000 24%, #000 74%, transparent)',
        }} />

        <div style={{
          position: 'absolute',
          top: 'max(14px, env(safe-area-inset-top, 14px))',
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          zIndex: 3,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: '#8B00FF',
              fontFamily: "'Cinzel Decorative', serif",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textShadow: '0 0 12px rgba(139,0,255,0.7)',
            }}>
              {bg.label}
            </div>
            <div style={{
              marginTop: 3,
              color: 'rgba(240,234,255,0.72)',
              fontFamily: "'Cinzel', serif",
              fontSize: 10,
              letterSpacing: '0.12em',
            }}>
              {scene.archiveTitle}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={event => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setAuto(value => !value)}
              aria-label={auto ? 'オート停止' : 'オート再生'}
              style={{
                width: 38,
                height: 34,
                borderRadius: 10,
                border: '1px solid rgba(139,0,255,0.36)',
                background: auto ? 'rgba(139,0,255,0.24)' : 'rgba(5,2,16,0.72)',
                color: auto ? '#f0eaff' : '#8b7da8',
                display: 'grid',
                placeItems: 'center',
                boxShadow: auto ? '0 0 14px rgba(139,0,255,0.28)' : 'none',
              }}
            >
              {auto ? <Pause size={15} /> : <Play size={15} />}
            </button>
            {canSkip && (
              <button
                type="button"
                onClick={onSkip}
                aria-label="スキップ"
                style={{
                  minWidth: 74,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid rgba(212,175,55,0.38)',
                  background: 'rgba(5,2,16,0.78)',
                  color: '#D4AF37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                }}
              >
                <FastForward size={14} />
                SKIP
              </button>
            )}
          </div>
        </div>

        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '18dvh',
          bottom: 'max(178px, calc(24dvh + env(safe-area-inset-bottom, 0px)))',
          zIndex: 1,
        }}>
          {portraits.map(portrait => (
            <CharacterPortrait
              key={`${portrait.characterId}-${portrait.position}`}
              portrait={portrait}
              isSpeaker={portrait.characterId === current?.speaker}
            />
          ))}
        </div>

        {current?.vfx && (
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '41%',
            width: current.vfx === 'soulChain' ? '58%' : '38%',
            height: current.vfx === 'ssrGoldPillar' ? '58%' : 3,
            transform: 'translate(-50%, -50%)',
            background: current.vfx === 'ssrGoldPillar'
              ? 'linear-gradient(180deg, transparent, rgba(212,175,55,0.46), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(139,0,255,0.8), transparent)',
            boxShadow: current.vfx === 'ssrGoldPillar'
              ? '0 0 42px rgba(212,175,55,0.42)'
              : '0 0 22px rgba(139,0,255,0.8)',
            opacity: 0.8,
            animation: 'storyVfxPulse 1.8s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 4,
          }}
        >
          <div style={{
            margin: '0 auto',
            width: 'min(100%, 760px)',
            padding: '10px 12px max(15px, env(safe-area-inset-bottom, 15px))',
            overflow: 'hidden',
          }}>
            <div style={{
              minHeight: 'clamp(154px, 24dvh, 208px)',
              borderRadius: 8,
              background: 'linear-gradient(180deg, rgba(6,2,16,0.96), rgba(2,1,8,0.98))',
              border: `1px solid ${character?.color ?? '#8B00FF'}66`,
              boxShadow: `0 -14px 44px ${(character?.glow ?? 'rgba(139,0,255,0.28)')}, inset 0 1px 0 rgba(255,255,255,0.07)`,
              backdropFilter: 'blur(14px)',
              padding: '14px 15px 12px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                minHeight: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: character?.color ?? '#8B8370',
                fontFamily: "'Cinzel Decorative', 'Noto Sans JP', serif",
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.08em',
                textShadow: `0 0 12px ${character?.color ?? '#8B8370'}88`,
              }}>
                <span>{current?.speakerJa ?? character?.nameJa ?? ''}</span>
                {!character && <span style={{ color: '#8B8370', fontFamily: "'Cinzel', serif", fontSize: 10 }}>NARRATION</span>}
              </div>
              <div style={{
                height: 1,
                margin: '7px 0 10px',
                background: `linear-gradient(90deg, ${character?.color ?? '#8B8370'}, transparent)`,
              }} />
              <div style={{
                flex: 1,
                minHeight: 0,
                color: '#F0EAFF',
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 'clamp(14px, 3.8vw, 17px)',
                lineHeight: 1.72,
                fontWeight: 600,
                overflow: 'hidden',
              }}>
                <TypewriterText
                  text={current?.text ?? ''}
                  flush={flush}
                  isAuto={auto}
                  onComplete={() => setLineComplete(true)}
                />
              </div>
              {current?.textEn && lineComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    marginTop: 8,
                    color: 'rgba(160,145,200,0.58)',
                    fontFamily: "'IM Fell English', serif",
                    fontSize: 11,
                    fontStyle: 'italic',
                    lineHeight: 1.42,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {current.textEn}
                </motion.div>
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: 9,
                color: '#6b5f7a',
                fontFamily: "'Cinzel', serif",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.08em',
              }}>
                <span>{lineIndex + 1} / {scene.lines.length}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {lineComplete ? <SkipForward size={13} /> : null}
                  {lineComplete ? (isLast ? 'CLOSE' : 'NEXT') : 'TAP'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
