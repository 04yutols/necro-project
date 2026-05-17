'use client';

import { useEffect, useState } from 'react';
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
const BUBBLE_MAX_W = 260;
const BUBBLE_GAP = 18;
const BUBBLE_ESTIMATED_H = 126;
const VIEWPORT_PAD = 12;

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

export function SpotlightOverlay({ step, onNext, onSkip, canSkip, zBase = 9500 }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [bubbleReady, setBubbleReady] = useState(false);

  useEffect(() => {
    let raf = 0;
    let bubbleTimer = 0;
    let resizeObserver: ResizeObserver | null = null;
    const retryTimers: number[] = [];
    let cancelled = false;

    setBubbleReady(false);
    const measure = () => {
      if (cancelled) return;
      const el = document.getElementById(step.targetId);
      const { w, h } = getViewportSize();
      setVp({ w, h });
      if (!el) {
        // 要素が見つからない場合は画面中央にスポットライト
        setRect({ cx: w / 2, cy: h / 2, r: 60, top: h/2-60, left: w/2-60, width: 120, height: 120 });
      } else {
        const b = el.getBoundingClientRect();
        const r = Math.max(44, Math.max(b.width, b.height) / 2 + SPOTLIGHT_PAD);
        setRect({ cx: b.left + b.width / 2, cy: b.top + b.height / 2, r, top: b.top, left: b.left, width: b.width, height: b.height });
        if (!resizeObserver && 'ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(scheduleMeasure);
          resizeObserver.observe(el);
        }
      }
    };

    function scheduleMeasure() {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    }

    scheduleMeasure();
    [90, 240, 520].forEach(delay => {
      retryTimers.push(window.setTimeout(scheduleMeasure, delay));
    });
    bubbleTimer = window.setTimeout(() => {
      if (!cancelled) setBubbleReady(true);
    }, 460);

    window.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(bubbleTimer);
      retryTimers.forEach(window.clearTimeout);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
    };
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
  const bubbleW = Math.min(BUBBLE_MAX_W, Math.max(188, W - VIEWPORT_PAD * 2));
  const fitsAbove = rect.top - BUBBLE_GAP - BUBBLE_ESTIMATED_H > VIEWPORT_PAD;
  const fitsBelow = rect.top + rect.height + BUBBLE_GAP + BUBBLE_ESTIMATED_H < H - VIEWPORT_PAD;
  const fitsLeft = rect.left - BUBBLE_GAP - bubbleW > VIEWPORT_PAD;
  const fitsRight = rect.left + rect.width + BUBBLE_GAP + bubbleW < W - VIEWPORT_PAD;
  let placement = step.position;
  if (placement === 'left' && !fitsLeft) placement = fitsRight ? 'right' : (fitsBelow || !fitsAbove ? 'below' : 'above');
  if (placement === 'right' && !fitsRight) placement = fitsLeft ? 'left' : (fitsBelow || !fitsAbove ? 'below' : 'above');
  if (placement === 'above' && !fitsAbove) placement = fitsBelow ? 'below' : 'above';
  if (placement === 'below' && !fitsBelow) placement = fitsAbove ? 'above' : 'below';

  let bubbleX = cx - bubbleW / 2;
  let bubbleY = cy + r + BUBBLE_GAP;
  if (placement === 'above') {
    bubbleY = cy - r - BUBBLE_GAP - BUBBLE_ESTIMATED_H;
  } else if (placement === 'left') {
    bubbleX = rect.left - bubbleW - BUBBLE_GAP;
    bubbleY = cy - BUBBLE_ESTIMATED_H / 2;
  } else if (placement === 'right') {
    bubbleX = rect.left + rect.width + BUBBLE_GAP;
    bubbleY = cy - BUBBLE_ESTIMATED_H / 2;
  }
  bubbleX = clamp(bubbleX, VIEWPORT_PAD, W - bubbleW - VIEWPORT_PAD);
  bubbleY = clamp(bubbleY, VIEWPORT_PAD, H - BUBBLE_ESTIMATED_H - VIEWPORT_PAD);

  // 三角矢印方向
  const arrowOnTop = placement === 'below'; // バブルが下→矢印は上向き（バブル上端に）
  const arrowOnBottom = placement === 'above';
  const arrowOnLeft = placement === 'right';
  const arrowOnRight = placement === 'left';
  const arrowX = clamp(cx - bubbleX - 8, 10, bubbleW - 26);
  const arrowY = clamp(cy - bubbleY - 8, 14, BUBBLE_ESTIMATED_H - 24);
  const clipId = `tut-spotlight-clip-${step.id}`;

  return (
    <>
      {/* ── Dark overlay (SVG clipPath) ── */}
      {/* iOS Safari: SVG は transform なし、クリックハンドラのみ */}
      <svg
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: zBase, pointerEvents: 'all' }}
        onClick={onNext}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path fillRule="evenodd" d={clipPath} />
          </clipPath>
        </defs>
        <motion.rect
          x={0} y={0} width={W} height={H}
          fill="rgba(0,0,0,0.72)"
          clipPath={`url(#${clipId})`}
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
            initial={{
              opacity: 0,
              x: placement === 'left' ? -8 : placement === 'right' ? 8 : 0,
              y: placement === 'above' ? -8 : placement === 'below' ? 8 : 0,
            }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              left: bubbleX,
              top: bubbleY,
              width: bubbleW,
              zIndex: zBase + 2,
              pointerEvents: 'none',
            }}
          >
            {/* 三角矢印（バブル上端） */}
            {arrowOnTop && (
              <div style={{
                width: 0, height: 0,
                marginLeft: arrowX,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid rgba(139,0,255,0.5)',
              }} />
            )}

            {/* バブル本体 */}
            <div style={{
              position: 'relative',
              background: 'rgba(12,6,24,0.95)',
              border: '1px solid rgba(139,0,255,0.5)',
              borderRadius: 6,
              padding: '12px 14px',
              backdropFilter: 'blur(10px)',
            }}>
              {arrowOnRight && (
                <div style={{
                  position: 'absolute',
                  right: -8,
                  top: arrowY,
                  width: 0,
                  height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderLeft: '8px solid rgba(139,0,255,0.5)',
                }} />
              )}
              {arrowOnLeft && (
                <div style={{
                  position: 'absolute',
                  left: -8,
                  top: arrowY,
                  width: 0,
                  height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderRight: '8px solid rgba(139,0,255,0.5)',
                }} />
              )}
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
                marginLeft: arrowX,
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
