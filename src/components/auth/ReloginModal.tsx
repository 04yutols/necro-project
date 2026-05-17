'use client';

import React, { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, LogIn } from 'lucide-react';
import { emitAuthChanged, signInWithCredentials } from './authClient';

interface ReloginModalProps {
  open: boolean;
  onRecovered: () => void;
}

export function ReloginModal({ open, onRecovered }: ReloginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await signInWithCredentials(email, password);
      emitAuthChanged();
      onRecovered();
    } catch (err) {
      setError(err instanceof Error ? err.message : '再ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'grid',
            placeItems: 'center',
            padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 18px calc(env(safe-area-inset-bottom, 0px) + 18px)',
            background: 'rgba(0,0,0,0.64)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              width: 'min(410px, 100%)',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 36px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderRadius: 20,
              border: '1px solid rgba(139,0,255,0.42)',
              background: 'linear-gradient(180deg, rgba(12,6,28,0.97), rgba(4,2,12,0.99))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.78), 0 0 38px rgba(139,0,255,0.22)',
              color: '#F0EAFF',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 15,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid rgba(212,175,55,0.34)',
                background: 'rgba(212,175,55,0.08)',
                color: '#D4AF37',
                flexShrink: 0,
              }}>
                <KeyRound size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 17, fontWeight: 800, letterSpacing: '0.06em' }}>
                  SESSION EXPIRED
                </div>
                <div style={{ color: 'rgba(220,210,240,0.68)', fontSize: 12, lineHeight: 1.55, marginTop: 4 }}>
                  セッションの有効期限が切れました。再度ログインしてください。
                </div>
              </div>
            </div>

            <Field label="EMAIL">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                style={inputStyle}
              />
            </Field>
            <Field label="PASSWORD">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                minLength={8}
                required
                style={inputStyle}
              />
            </Field>

            {error && (
              <div style={{
                marginBottom: 14,
                borderRadius: 12,
                border: '1px solid rgba(139,0,0,0.34)',
                background: 'rgba(139,0,0,0.14)',
                color: '#FFB4B4',
                padding: '10px 12px',
                fontSize: 12,
                lineHeight: 1.55,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                minHeight: 50,
                borderRadius: 15,
                border: '1px solid rgba(139,0,255,0.6)',
                background: submitting ? 'rgba(139,0,255,0.1)' : 'linear-gradient(135deg, rgba(139,0,255,0.42), rgba(188,0,251,0.18))',
                color: '#F0EAFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.12em',
                opacity: submitting ? 0.65 : 1,
              }}
            >
              <LogIn size={16} />
              {submitting ? '接続中' : '再ログイン'}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 7, marginBottom: 13 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: '#8b7da8', letterSpacing: '0.16em', fontFamily: "'Cinzel', serif" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 13,
  border: '1px solid rgba(139,0,255,0.22)',
  background: 'rgba(0,0,0,0.34)',
  color: '#F0EAFF',
  outline: 'none',
  padding: '0 13px',
  fontSize: 15,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};
