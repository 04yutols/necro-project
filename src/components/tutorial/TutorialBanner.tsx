'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';
import { BANNER_LABELS } from '../../hooks/useTutorialTrigger';

const AUTO_DISMISS_MS = 3000;

export function TutorialBanner() {
  const { bannerQueue, dismissBanner } = useTutorialStore();
  const current = bannerQueue[0];

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismissBanner, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          onClick={dismissBanner}
          style={{
            position: 'fixed',
            top: 'max(0px, env(safe-area-inset-top, 0px))',
            left: 0,
            right: 0,
            zIndex: 8500,
            background: 'linear-gradient(90deg, #8B00FF, #4400AA)',
            padding: '10px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(139,0,255,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>✦</span>
            <p style={{
              fontFamily: "'Noto Sans JP', sans-serif",
              fontSize: 13,
              color: '#fff',
              fontWeight: 'bold',
              letterSpacing: '0.04em',
            }}>
              {BANNER_LABELS[current]}
            </p>
          </div>
          <p style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 9,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            TAP TO CLOSE
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
