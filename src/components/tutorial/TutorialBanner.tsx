'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useGameStore } from '../../store/useGameStore';
import { BANNER_LABELS } from '../../data/tutorial/phases';
import { getTutorialPhaseDestinationTab } from '../../data/tutorial/triggers';
import { confirmTutorialBanner } from './TutorialBanner.actions';

export function TutorialBanner() {
  const bannerQueue = useTutorialStore(s => s.bannerQueue);
  const dismissBanner = useTutorialStore(s => s.dismissBanner);
  const setCurrentTab = useGameStore(s => s.setCurrentTab);
  const current = bannerQueue[0];
  const destinationTab = current ? getTutorialPhaseDestinationTab(current) : null;

  const handleConfirm = () => {
    if (!current) return;
    confirmTutorialBanner({ phase: current, setCurrentTab, dismissBanner });
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          style={{
            position: 'fixed',
            top: 'max(0px, env(safe-area-inset-top, 0px))',
            left: 0,
            right: 0,
            zIndex: 9400,
            background: 'linear-gradient(90deg, #8B00FF, #4400AA)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 20px rgba(139,0,255,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 14, color: '#fff' }}>✦</span>
            <p style={{
              fontFamily: "var(--font-noto-sans-jp), sans-serif",
              fontSize: 13,
              color: '#fff',
              fontWeight: 'bold',
              letterSpacing: '0.04em',
              margin: 0,
              lineHeight: 1.45,
              minWidth: 0,
            }}>
              {BANNER_LABELS[current]}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                minHeight: 32,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.34)',
                background: 'rgba(255,255,255,0.16)',
                color: '#fff',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{destinationTab ? '確認する' : '閉じる'}</span>
              {destinationTab && <ChevronRight size={14} aria-hidden="true" />}
            </button>
            {destinationTab && (
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="閉じる"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(0,0,0,0.12)',
                  color: 'rgba(255,255,255,0.78)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
