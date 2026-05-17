'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';

interface BubbleHintData {
  id: string;
  targetId: string;
  title: string;
  body: string;
  position: 'above' | 'below' | 'left' | 'right';
}

interface Props {
  hint: BubbleHintData;
}

const BUBBLE_W = 210;
const BUBBLE_GAP = 12;
const BUBBLE_H = 104;
const PAD = 10;

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    w: Math.round(vv?.width ?? window.innerWidth),
    h: Math.round(vv?.height ?? window.innerHeight),
  };
}

export function BubbleHint({ hint }: Props) {
  const { isHintViewed, markHintViewed } = useTutorialStore();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isHintViewed(hint.id)) return;
    let raf = 0;
    let timer = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const el = document.getElementById(hint.targetId);
      if (!el) return;

      const { w, h } = getViewportSize();
      const b = el.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const bubbleW = Math.min(BUBBLE_W, w - PAD * 2);
      let x = cx - bubbleW / 2;
      let y = b.bottom + BUBBLE_GAP;

      if (hint.position === 'above') {
        y = b.top - BUBBLE_GAP - BUBBLE_H;
      } else if (hint.position === 'left') {
        x = b.left - bubbleW - BUBBLE_GAP;
        y = cy - BUBBLE_H / 2;
      } else if (hint.position === 'right') {
        x = b.right + BUBBLE_GAP;
        y = cy - BUBBLE_H / 2;
      }

      x = Math.max(PAD, Math.min(x, w - bubbleW - PAD));
      y = Math.max(PAD, Math.min(y, h - BUBBLE_H - PAD));
      setPos({ x, y });
      setShow(true);

      if (!resizeObserver && 'ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(scheduleMeasure);
        resizeObserver.observe(el);
      }
    };

    function scheduleMeasure() {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    }

    scheduleMeasure();
    timer = window.setTimeout(scheduleMeasure, 260);
    window.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
    };
  }, [hint.id, hint.position, hint.targetId, isHintViewed]);

  const dismiss = () => {
    setShow(false);
    markHintViewed(hint.id);
  };

  if (isHintViewed(hint.id)) return null;

  return (
    <AnimatePresence>
      {show && pos && (
        <motion.div
          key={hint.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            width: `min(${BUBBLE_W}px, calc(100vw - ${PAD * 2}px))`,
            zIndex: 8000,
            background: 'rgba(12,6,24,0.92)',
            border: '1px solid rgba(139,0,255,0.4)',
            borderRadius: 6,
            padding: '10px 12px',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
          }}
        >
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 10,
            color: '#B09FF8',
            letterSpacing: '0.06em',
            marginBottom: 5,
          }}>
            {hint.title}
          </p>
          <p style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            fontSize: 11,
            color: 'rgba(210,200,235,0.88)',
            lineHeight: 1.7,
          }}>
            {hint.body}
          </p>
          <p style={{
            marginTop: 6,
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            color: 'rgba(139,0,255,0.6)',
            letterSpacing: '0.1em',
          }}>
            TAP TO CLOSE
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
