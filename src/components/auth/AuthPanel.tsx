'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, LogIn, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react';

type AuthMode = 'login' | 'signup';
type SessionStatus = 'loading' | 'guest' | 'authenticated' | 'unavailable';

interface SessionUser {
  name?: string | null;
  email?: string | null;
}

interface AuthSession {
  user?: SessionUser;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Accept: 'application/json',
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return response.json() as Promise<T>;
}

async function getCsrfToken() {
  const data = await readJson<{ csrfToken?: string }>('/api/auth/csrf', { cache: 'no-store' });
  return data?.csrfToken ?? null;
}

async function readSession(): Promise<{ available: boolean; session: AuthSession }> {
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return { available: false, session: {} };
  const session = await response.json().catch(() => null) as AuthSession | null;
  return { available: true, session: session ?? {} };
}

export function AuthPanel() {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const data = await readSession();
      if (!data.available) {
        setStatus('unavailable');
        setUser(null);
        return;
      }
      if (data.session.user) {
        setStatus('authenticated');
        setUser(data.session.user);
        return;
      }
      setStatus('guest');
      setUser(null);
    } catch {
      setStatus('unavailable');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const label = useMemo(() => {
    if (status === 'loading') return 'CHECK';
    if (status === 'authenticated') return 'CLOUD';
    return 'GUEST';
  }, [status]);

  const helperText = useMemo(() => {
    if (status === 'authenticated') return user?.name ?? user?.email ?? 'クラウド同期中';
    if (status === 'unavailable') return 'Next runtimeで認証有効';
    return 'ローカルプレイ';
  }, [status, user]);

  const resetFormState = () => {
    setMessage(null);
    setSubmitting(false);
  };

  const openDialog = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetFormState();
  };

  const closeDialog = () => {
    setMode(null);
    resetFormState();
  };

  const signInWithCredentials = async () => {
    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
      throw new Error('クラウド認証APIに接続できません。Next runtimeで起動してください');
    }

    const body = new URLSearchParams({
      csrfToken,
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: '/',
      redirect: 'false',
      json: 'true',
    });

    const response = await fetch('/api/auth/signin/credentials?redirect=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });
    const contentType = response.headers.get('content-type') ?? '';
    const result = contentType.includes('application/json')
      ? await response.json().catch(() => null) as { error?: string | null } | null
      : null;

    if (!response.ok || result?.error) {
      throw new Error('メールアドレスまたはパスワードが違います');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email, password, displayName }),
        });
        const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
        if (!response.ok || !result?.success) {
          throw new Error(result?.error ?? '登録に失敗しました');
        }
      }

      await signInWithCredentials();
      await loadSession();
      window.dispatchEvent(new Event('necro-auth-changed'));
      closeDialog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '認証に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const csrfToken = await getCsrfToken();
      if (csrfToken) {
        await fetch('/api/auth/signout?redirect=false', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ csrfToken, callbackUrl: '/' }),
        });
      }
      setStatus('guest');
      setUser(null);
      window.dispatchEvent(new Event('necro-auth-changed'));
    } catch {
      setStatus('guest');
      setUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
          padding: '4px 4px 4px 10px',
          borderRadius: 13,
          background: status === 'authenticated'
            ? 'linear-gradient(135deg, rgba(139,0,255,0.22), rgba(212,175,55,0.08))'
            : 'rgba(255,255,255,0.055)',
          border: status === 'authenticated'
            ? '1px solid rgba(139,0,255,0.42)'
            : '1px solid rgba(255,255,255,0.12)',
          boxShadow: status === 'authenticated' ? '0 0 18px rgba(139,0,255,0.2)' : 'none',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Cloud size={16} color={status === 'authenticated' ? '#D4AF37' : '#8b7da8'} />
        <button
          type="button"
          onClick={() => openDialog('login')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            minWidth: 0,
            maxWidth: 112,
            border: 0,
            background: 'transparent',
            padding: 0,
            color: '#F0EAFF',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: status === 'authenticated' ? '#D4AF37' : '#A5A9B4' }}>
            {label}
          </span>
          <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Noto Sans JP', sans-serif", fontSize: 10, fontWeight: 700, color: '#F0EAFF' }}>
            {helperText}
          </span>
        </button>

        {status === 'authenticated' ? (
          <button
            type="button"
            aria-label="ログアウト"
            onClick={handleSignOut}
            disabled={submitting}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(212,175,55,0.34)',
              background: 'rgba(212,175,55,0.08)',
              color: '#D4AF37',
              opacity: submitting ? 0.55 : 1,
            }}
          >
            <LogOut size={15} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="ログイン"
            onClick={() => openDialog('login')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid rgba(139,0,255,0.42)',
              background: 'rgba(139,0,255,0.12)',
              color: '#BC00FB',
            }}
          >
            <LogIn size={15} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {mode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10050,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(12px)',
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeDialog();
            }}
          >
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 31 }}
              style={{
                width: 'min(420px, 100%)',
                maxHeight: 'min(620px, calc(100dvh - 32px))',
                overflowY: 'auto',
                borderRadius: 18,
                background: 'linear-gradient(180deg, rgba(12,6,28,0.98), rgba(4,2,12,0.98))',
                border: '1px solid rgba(139,0,255,0.34)',
                boxShadow: '0 26px 70px rgba(0,0,0,0.72), 0 0 32px rgba(139,0,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
                padding: 18,
                color: '#F0EAFF',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {mode === 'login' ? <ShieldCheck size={18} color="#D4AF37" /> : <UserPlus size={18} color="#D4AF37" />}
                    <span style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 18, fontWeight: 800, letterSpacing: '0.04em', color: '#F0EAFF' }}>
                      {mode === 'login' ? 'ログイン' : '登録'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, lineHeight: 1.7, color: 'rgba(220,210,240,0.68)', fontFamily: "'Noto Sans JP', sans-serif" }}>
                    クラウドセーブ、ランキング、世界ログを有効化します。
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={closeDialog}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#A5A9B4',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={17} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {(['login', 'signup'] as const).map((tabMode) => (
                  <button
                    key={tabMode}
                    type="button"
                    onClick={() => {
                      setMode(tabMode);
                      setMessage(null);
                    }}
                    style={{
                      minHeight: 42,
                      borderRadius: 12,
                      border: mode === tabMode ? '1px solid rgba(139,0,255,0.56)' : '1px solid rgba(255,255,255,0.08)',
                      background: mode === tabMode ? 'rgba(139,0,255,0.18)' : 'rgba(255,255,255,0.035)',
                      color: mode === tabMode ? '#E9D5FF' : '#8b7da8',
                      fontFamily: "'Noto Sans JP', sans-serif",
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {tabMode === 'login' ? 'ログイン' : '新規登録'}
                  </button>
                ))}
              </div>

              <label style={{ display: 'grid', gap: 7, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#8b7da8', letterSpacing: '0.16em', fontFamily: "'Cinzel', serif" }}>EMAIL</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 7, marginBottom: mode === 'signup' ? 12 : 16 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#8b7da8', letterSpacing: '0.16em', fontFamily: "'Cinzel', serif" }}>PASSWORD</span>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  style={inputStyle}
                />
              </label>

              {mode === 'signup' && (
                <label style={{ display: 'grid', gap: 7, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#8b7da8', letterSpacing: '0.16em', fontFamily: "'Cinzel', serif" }}>PLAYER NAME</span>
                  <input
                    type="text"
                    autoComplete="nickname"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    minLength={2}
                    maxLength={16}
                    required
                    style={inputStyle}
                  />
                </label>
              )}

              {message && (
                <div style={{
                  marginBottom: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(139,0,0,0.34)',
                  background: 'rgba(139,0,0,0.14)',
                  color: '#FFB4B4',
                  padding: '10px 12px',
                  fontSize: 12,
                  lineHeight: 1.55,
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 14,
                  border: '1px solid rgba(139,0,255,0.58)',
                  background: submitting
                    ? 'rgba(139,0,255,0.1)'
                    : 'linear-gradient(135deg, rgba(139,0,255,0.38), rgba(188,0,251,0.18))',
                  color: '#F0EAFF',
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: '0.16em',
                  boxShadow: submitting ? 'none' : '0 0 18px rgba(139,0,255,0.28)',
                  opacity: submitting ? 0.65 : 1,
                }}
              >
                {submitting ? '通信中' : mode === 'login' ? 'ログイン' : '登録してログイン'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid rgba(139,0,255,0.2)',
  background: 'rgba(0,0,0,0.34)',
  color: '#F0EAFF',
  outline: 'none',
  padding: '0 13px',
  fontSize: 15,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};
