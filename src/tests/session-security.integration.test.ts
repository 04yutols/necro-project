import { prisma } from '@/lib/prisma';
import {
  invalidateAllUserSessions,
  isSessionVersionCurrent,
  normalizeSessionVersion,
  resolveTokenUserId,
  validateVersionedSessionToken,
} from '../services/SessionSecurityService';

jest.setTimeout(30000);

describe('SessionSecurityService', () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `codex-sec6-${suffix}@example.test`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  test('normalizes token user id and session version claims', () => {
    expect(resolveTokenUserId({ id: 'user-1' })).toBe('user-1');
    expect(resolveTokenUserId({ sub: 'user-2' })).toBe('user-2');
    expect(resolveTokenUserId({ id: '' })).toBeNull();
    expect(normalizeSessionVersion(1)).toBe(1);
    expect(normalizeSessionVersion(0)).toBeNull();
    expect(normalizeSessionVersion(1.5)).toBeNull();
    expect(normalizeSessionVersion('1')).toBeNull();
  });

  test('invalidating user sessions rejects older JWT session versions', async () => {
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'SEC6',
        name: 'SEC6',
        passwordHash: 'unused',
      },
      select: { id: true, sessionVersion: true },
    });

    expect(user.sessionVersion).toBe(1);
    await expect(isSessionVersionCurrent(user.id, user.sessionVersion)).resolves.toBe(true);
    await expect(validateVersionedSessionToken({
      id: user.id,
      sessionVersion: user.sessionVersion,
    })).resolves.toEqual({
      valid: true,
      userId: user.id,
      sessionVersion: user.sessionVersion,
    });

    const nextVersion = await invalidateAllUserSessions(user.id);

    expect(nextVersion).toBe(user.sessionVersion + 1);
    await expect(isSessionVersionCurrent(user.id, user.sessionVersion)).resolves.toBe(false);
    await expect(validateVersionedSessionToken({
      id: user.id,
      sessionVersion: user.sessionVersion,
    })).resolves.toEqual({ valid: false });
    await expect(validateVersionedSessionToken({
      id: user.id,
      sessionVersion: nextVersion,
    })).resolves.toEqual({
      valid: true,
      userId: user.id,
      sessionVersion: nextVersion,
    });
  });
});
