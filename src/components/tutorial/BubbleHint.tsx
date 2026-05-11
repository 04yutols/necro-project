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

export function BubbleHint({ hint }: Props) {
  const { isHintViewed, markHintViewed } = useTutorialStore();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isHintViewed(hint.id)) return;
    const el = document.getElementById(hint.targetId);
    if (!el) return;
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    let x = cx - BUBBLE_W / 2;
    let y: number;
    switch (hint.position) {
      case 'above': y = b.top - BUBBLE_GAP - 90; break;
      case 'below': y = b.bottom + BUBBLE_GAP; break;
      case 'left':  x = b.left - BUBBLE_W - BUBBLE_GAP; y = b.top + b.height / 2 - 40; break;
      case 'right': x = b.right + BUBBLE_GAP; y = b.top + b.height / 2 - 40; break;
      default: y = b.bottom + BUBBLE_GAP;
    }
    x = Math.max(8, Math.min(x, window.innerWidth - BUBBLE_W - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - 100));
    setPos({ x, y });
    setShow(true);
  }, [hint.id]);

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
            width: BUBBLE_W,
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
