'use client';

import React, { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, LogIn, UserPlus } from 'lucide-react';
import { emitAuthChanged, signInWithCredentials, signUpWithCredentials } from './authClient';

type AuthMode = 'login' | 'signup';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await signUpWithCredentials(email, password, displayName);
      }
      await signInWithCredentials(email, password);
      emitAuthChanged();
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="h-[100dvh] w-full overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 0%, rgba(139,0,255,0.2), transparent 48%), #050505',
        color: '#F0EAFF',
      }}
    >
      <div
        className="h-full min-h-0 overflow-y-auto safe-scroll"
        style={{
          padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 18px calc(env(safe-area-inset-bottom, 0px) + 22px)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            style={{
              width: 'min(440px, 100%)',
              borderRadius: 20,
              border: '1px solid rgba(139,0,255,0.34)',
              background: 'linear-gradient(180deg, rgba(12,6,28,0.96), rgba(4,2,12,0.98))',
              boxShadow: '0 28px 80px rgba(0,0,0,0.75), 0 0 34px rgba(139,0,255,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid rgba(212,175,55,0.36)',
                background: 'rgba(212,175,55,0.08)',
                color: '#D4AF37',
                flexShrink: 0,
              }}>
                <Cloud size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 19, fontWeight: 800, letterSpacing: '0.04em', lineHeight: 1.1 }}>
                  NECROMANCE BRAVE
                </div>
                <div style={{ fontSize: 11, color: 'rgba(220,210,240,0.62)', fontFamily: "'Noto Sans JP', sans-serif", marginTop: 5 }}>
                  クラウドセーブに接続
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {(['login', 'signup'] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setError(null);
                  }}
                  style={{
                    minHeight: 44,
                    borderRadius: 13,
                    border: mode === nextMode ? '1px solid rgba(139,0,255,0.58)' : '1px solid rgba(255,255,255,0.08)',
                    background: mode === nextMode ? 'rgba(139,0,255,0.2)' : 'rgba(255,255,255,0.04)',
                    color: mode === nextMode ? '#E9D5FF' : '#8b7da8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                  }}
                >
                  {nextMode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
                  {nextMode === 'login' ? 'ログイン' : '新規登録'}
                </button>
              ))}
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
                style={inputStyle}
              />
            </Field>
            {mode === 'signup' && (
              <Field label="PLAYER NAME">
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={16}
                  required
                  style={inputStyle}
                />
              </Field>
            )}

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
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.16em',
                opacity: submitting ? 0.65 : 1,
                boxShadow: submitting ? 'none' : '0 0 18px rgba(139,0,255,0.28)',
              }}
            >
              {submitting ? '通信中' : mode === 'login' ? 'ログイン' : '登録してログイン'}
            </button>
          </motion.form>
        </div>
      </div>
    </div>
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
