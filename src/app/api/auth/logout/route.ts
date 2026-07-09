import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { invalidateAllUserSessions } from '@/services/SessionSecurityService';

const isSecure = process.env.AUTH_URL?.startsWith('https://') ?? false;
const COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
];

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    await invalidateAllUserSessions(userId);
  }

  const response = NextResponse.json({ success: true, invalidated: Boolean(userId) });
  for (const name of COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      secure: isSecure || name.startsWith('__Secure-'),
    });
  }
  return response;
}
