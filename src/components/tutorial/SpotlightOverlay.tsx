'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TutorialStep } from '../../data/tutorial/phases';

interface Props {
  step: TutorialStep;
  onNext: () => void;
  onSkip: () => void;
  canSkip: boolean;
  zBase?: number;
}

interface Rect {
  cx: number; cy: number; r: number;
  top: number; left: number; width: number; height: number;
}

const SPOTLIGHT_PAD = 24;
const BUBBLE_W = 230;
const BUBBLE_GAP = 18;
const BUBBLE_ESTIMATED_H = 110;

export function SpotlightOverlay({ step, onNext, onSkip, canSkip, zBase = 9500 }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [bubbleReady, setBubbleReady] = useState(false);

  useEffect(() => {
    setBubbleReady(false);
    const measure = () => {
      const el = document.getElementById(step.targetId);
      const w = window.innerWidth;
      const h = window.innerHeight;
      setVp({ w, h });
      if (!el) {
        // 要素が見つからない場合は画面中央にスポットライト
        setRect({ cx: w / 2, cy: h / 2, r: 60, top: h/2-60, left: w/2-60, width: 120, height: 120 });
      } else {
        const b = el.getBoundingClientRect();
        const r = Math.max(b.width, b.height) / 2 + SPOTLIGHT_PAD;
        setRect({ cx: b.left + b.width / 2, cy: b.top + b.height / 2, r, top: b.top, left: b.left, width: b.width, height: b.height });
      }
      setTimeout(() => setBubbleReady(true), 500);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step.targetId, step.id]);

  if (!rect || vp.w === 0) return null;

  const { cx, cy, r } = rect;
  const { w: W, h: H } = vp;

  // SVG clipPath: 全画面矩形 + 円形の穴（evenodd）
  const circlePath =
    `M ${cx} ${cy} m -${r} 0 ` +
    `a ${r} ${r} 0 1 0 ${2 * r} 0 ` +
    `a ${r} ${r} 0 1 0 ${-(2 * r)} 0`;
  const clipPath = `M 0 0 H ${W} V ${H} H 0 Z ${circlePath}`;

  // バブル位置計算
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const bubbleX = clamp(cx - BUBBLE_W / 2, 8, W - BUBBLE_W - 8);
  let bubbleY: number;
  switch (step.position) {
    case 'above':
      bubbleY = cy - r - BUBBLE_GAP - BUBBLE_ESTIMATED_H;
      break;
    case 'below':
      bubbleY = cy + r + BUBBLE_GAP;
      break;
    case 'left':
      bubbleY = cy - BUBBLE_ESTIMATED_H / 2;
      break;
    case 'right':
      bubbleY = cy - BUBBLE_ESTIMATED_H / 2;
      break;
    default:
      bubbleY = cy + r + BUBBLE_GAP;
  }
  bubbleY = clamp(bubbleY, 8, H - BUBBLE_ESTIMATED_H - 8);

  // 三角矢印方向
  const arrowOnTop = step.position === 'below'; // バブルが下→矢印は上向き（バブル上端に）
  const arrowOnBottom = step.position === 'above';

  return (
    <>
      {/* ── Dark overlay (SVG clipPath) ── */}
      {/* iOS Safari: SVG は transform なし、クリックハンドラのみ */}
      <svg
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: zBase, pointerEvents: 'all' }}
        onClick={onNext}
      >
        <defs>
          <clipPath id="tut-spotlight-clip" clipPathUnits="userSpaceOnUse">
            <path fillRule="evenodd" d={clipPath} />
          </clipPath>
        </defs>
        <motion.rect
          x={0} y={0} width={W} height={H}
          fill="rgba(0,0,0,0.72)"
          clipPath="url(#tut-spotlight-clip)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </svg>

      {/* ── Glow ring (motion.div, transform のみ) ── */}
      {/* iOS Safari ルール: transform と overflow:hidden を分離 */}
      <motion.div
        style={{
          position: 'fixed',
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          border: '3px solid rgba(139,0,255,0.65)',
          boxShadow: '0 0 18px rgba(139,0,255,0.35)',
          zIndex: zBase + 1,
          pointerEvents: 'none',
        }}
        initial={{ scale: 1.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      />

      {/* ── Bubble hint ── */}
      <AnimatePresence>
        {bubbleReady && (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: step.position === 'above' ? -8 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              left: bubbleX,
              top: bubbleY,
              width: BUBBLE_W,
              zIndex: zBase + 2,
              pointerEvents: 'none',
            }}
          >
            {/* 三角矢印（バブル上端） */}
            {arrowOnTop && (
              <div style={{
                width: 0, height: 0,
                marginLeft: clamp(cx - bubbleX - 8, 8, BUBBLE_W - 24),
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid rgba(139,0,255,0.5)',
              }} />
            )}

            {/* バブル本体 */}
            <div style={{
              background: 'rgba(12,6,24,0.95)',
              border: '1px solid rgba(139,0,255,0.5)',
              borderRadius: 6,
              padding: '12px 14px',
              backdropFilter: 'blur(10px)',
            }}>
              <p style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 11,
                color: '#B09FF8',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}>
                {step.title}
              </p>
              <p style={{
                fontFamily: "'Noto Sans JP', sans-serif",
                fontSize: 12,
                color: 'rgba(220,210,240,0.9)',
                lineHeight: 1.75,
              }}>
                {step.body}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                style={{
                  marginTop: 10,
                  padding: '5px 16px',
                  background: '#8B00FF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 3,
                  fontFamily: "'Cinzel', serif",
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  pointerEvents: 'all',
                }}
              >
                次へ
              </button>
            </div>

            {/* 三角矢印（バブル下端） */}
            {arrowOnBottom && (
              <div style={{
                width: 0, height: 0,
                marginLeft: clamp(cx - bubbleX - 8, 8, BUBBLE_W - 24),
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid rgba(139,0,255,0.5)',
              }} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skip ── */}
      {canSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            right: 16,
            zIndex: zBase + 3,
            background: 'rgba(120,100,160,0.5)',
            border: '1px solid rgba(139,0,255,0.25)',
            borderRadius: 4,
            color: 'rgba(200,185,225,0.8)',
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            letterSpacing: '0.15em',
            padding: '5px 12px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          SKIP
        </motion.button>
      )}
    </>
  );
}
