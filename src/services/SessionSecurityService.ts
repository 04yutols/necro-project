import { prisma } from '@/lib/prisma';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface VersionedSessionToken {
  id?: unknown;
  sub?: unknown;
  sessionVersion?: unknown;
}

export function resolveTokenUserId(token: VersionedSessionToken): string | null {
  if (typeof token.id === 'string' && token.id.length > 0) return token.id;
  if (typeof token.sub === 'string' && token.sub.length > 0) return token.sub;
  return null;
}

export function normalizeSessionVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return value;
}

export async function getUserSessionVersion(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return user?.sessionVersion ?? null;
}

export async function isSessionVersionCurrent(userId: string, sessionVersion: unknown): Promise<boolean> {
  const tokenVersion = normalizeSessionVersion(sessionVersion);
  if (!tokenVersion) return false;

  const currentVersion = await getUserSessionVersion(userId);
  return currentVersion === tokenVersion;
}

export async function invalidateAllUserSessions(userId: string): Promise<number | null> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  }).catch(() => null);

  return user?.sessionVersion ?? null;
}

export async function validateVersionedSessionToken(
  token: VersionedSessionToken,
): Promise<{ valid: true; userId: string; sessionVersion: number } | { valid: false }> {
  const userId = resolveTokenUserId(token);
  if (!userId) return { valid: false };

  const tokenVersion = normalizeSessionVersion(token.sessionVersion);
  if (!tokenVersion) return { valid: false };

  const valid = await isSessionVersionCurrent(userId, tokenVersion);
  if (!valid) return { valid: false };

  return { valid: true, userId, sessionVersion: tokenVersion };
}
