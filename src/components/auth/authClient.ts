'use client';

export async function signInWithCredentials(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !result?.success) {
    throw new Error(result?.error ?? 'メールアドレスまたはパスワードが違います');
  }
}

export async function signUpWithCredentials(email: string, password: string, displayName: string) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !result?.success) throw new Error(result?.error ?? '登録に失敗しました');
}

export function emitAuthChanged() {
  window.dispatchEvent(new Event('necro-auth-changed'));
}
