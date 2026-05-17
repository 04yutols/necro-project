'use client';

export async function readJson<T>(url: string, init?: RequestInit): Promise<T | null> {
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

export async function getCsrfToken() {
  const data = await readJson<{ csrfToken?: string }>('/api/auth/csrf', { cache: 'no-store' });
  return data?.csrfToken ?? null;
}

export async function signInWithCredentials(email: string, password: string) {
  const csrfToken = await getCsrfToken();
  if (!csrfToken) throw new Error('認証APIに接続できません');

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
  const result = await response.json().catch(() => null) as { error?: string | null } | null;
  if (!response.ok || result?.error) {
    throw new Error('メールアドレスまたはパスワードが違います');
  }
}

export async function signUpWithCredentials(email: string, password: string, displayName: string) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password, displayName }),
  });
  const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !result?.success) throw new Error(result?.error ?? '登録に失敗しました');
}

export function emitAuthChanged() {
  window.dispatchEvent(new Event('necro-auth-changed'));
}
