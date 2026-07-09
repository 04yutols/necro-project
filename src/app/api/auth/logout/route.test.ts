import { auth } from '@/auth';
import { invalidateAllUserSessions } from '@/services/SessionSecurityService';
import { POST } from './route';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/services/SessionSecurityService', () => ({
  invalidateAllUserSessions: jest.fn(),
}));

describe('POST /api/auth/logout', () => {
  const authMock = auth as jest.Mock;
  const invalidateMock = invalidateAllUserSessions as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('invalidates all sessions for the authenticated user', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    invalidateMock.mockResolvedValue(2);

    const response = await POST();
    const body = await response.json();

    expect(body).toEqual({ success: true, invalidated: true });
    expect(invalidateMock).toHaveBeenCalledWith('user-1');
    expect(response.headers.get('set-cookie')).toContain('authjs.session-token=');
  });

  test('clears cookies even when the current request is unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST();
    const body = await response.json();

    expect(body).toEqual({ success: true, invalidated: false });
    expect(invalidateMock).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toContain('authjs.session-token=');
  });
});
