'use client';

import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 9998,
            }}
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              background: 'rgba(10,5,26,0.97)',
              border: '1px solid rgba(139,0,255,0.3)',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 400,
              width: 'calc(100vw - 48px)',
              boxShadow: '0 0 40px rgba(139,0,255,0.2)',
            }}
          >
            <h3
              style={{
                color: '#e0d0ff',
                fontSize: 15,
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                color: '#a5a9b4',
                fontSize: 13,
                fontFamily: 'Space Grotesk, sans-serif',
                lineHeight: 1.6,
                marginBottom: 20,
              }}
            >
              {message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={onCancel}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#a1a1aa',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={onConfirm}
                style={{
                  background: danger ? 'rgba(127,29,29,0.4)' : 'rgba(139,0,255,0.25)',
                  border: `1px solid ${danger ? 'rgba(220,38,38,0.6)' : 'rgba(139,0,255,0.6)'}`,
                  color: danger ? '#fca5a5' : '#d8b4fe',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 600,
                }}
              >
                {danger ? '削除する' : '確認'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
