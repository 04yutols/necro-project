'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { LoadCharacterResult, ServerGameUser } from '../types/serverGame';

type AuthFlowStatus =
  | 'checking'
  | 'authRequired'
  | 'loadingCharacter'
  | 'characterRequired'
  | 'ready'
  | 'sessionExpired'
  | 'guest'
  | 'error';

interface AuthSessionResponse {
  user?: ServerGameUser;
}

export interface AuthFlowState {
  status: AuthFlowStatus;
  user: ServerGameUser | null;
  error: string | null;
  reload: () => void;
  retry: () => void;
  markSessionExpired: () => void;
}

async function fetchAuthSession(): Promise<{ available: boolean; session: AuthSessionResponse }> {
  const response = await fetch('/api/auth/session', {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return { available: false, session: {} };
  const session = await response.json().catch(() => null) as AuthSessionResponse | null;
  return { available: true, session: session ?? {} };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadCharacterWithRetry(maxAttempts = 3): Promise<LoadCharacterResult> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { loadCharacterAction } = await import('../app/actions');
      const result = await loadCharacterAction();
      if (result.success || result.status === 'UNAUTHENTICATED' || attempt === maxAttempts) {
        return result;
      }
      lastError = result.error;
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) throw err;
    }
    await delay(1000);
  }

  return {
    success: false,
    status: 'ERROR',
    error: lastError instanceof Error ? lastError.message : '起動データの取得に失敗しました',
  };
}

export function useAuthFlow(): AuthFlowState {
  const initialize = useGameStore((state) => state.initialize);
  const loadFromServer = useGameStore((state) => state.loadFromServer);
  const clearServerData = useGameStore((state) => state.clearServerData);
  const [status, setStatus] = useState<AuthFlowStatus>('checking');
  const [user, setUser] = useState<ServerGameUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const bootedGuestRef = useRef(false);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const markSessionExpired = useCallback(() => {
    setError('セッションの有効期限が切れました');
    setStatus('sessionExpired');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setStatus('checking');
      setError(null);

      try {
        const authSession = await fetchAuthSession();
        if (!authSession.available) {
          if (!bootedGuestRef.current && !useGameStore.getState().player) {
            initialize();
            bootedGuestRef.current = true;
          }
          if (!cancelled) {
            setUser(null);
            setStatus('guest');
          }
          return;
        }

        const session = authSession.session;
        if (!session.user?.id) {
          clearServerData();
          if (!cancelled) {
            setUser(null);
            setStatus('authRequired');
          }
          return;
        }

        setUser(session.user);
        setStatus('loadingCharacter');

        const result = await loadCharacterWithRetry();
        if (cancelled) return;

        if (!result.success) {
          clearServerData();
          setUser(null);
          setStatus(result.status === 'UNAUTHENTICATED' ? 'authRequired' : 'error');
          setError(result.error);
          return;
        }

        setUser(result.user);
        if (result.status === 'NO_CHARACTER') {
          clearServerData();
          setStatus('characterRequired');
          return;
        }

        loadFromServer(result.data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '起動データの取得に失敗しました');
        setStatus('error');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [clearServerData, initialize, loadFromServer, version]);

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('necro-auth-changed', handler);
    return () => window.removeEventListener('necro-auth-changed', handler);
  }, [reload]);

  useEffect(() => {
    window.addEventListener('necro-session-expired', markSessionExpired);
    return () => window.removeEventListener('necro-session-expired', markSessionExpired);
  }, [markSessionExpired]);

  return {
    status,
    user,
    error,
    reload,
    retry: reload,
    markSessionExpired,
  };
}
