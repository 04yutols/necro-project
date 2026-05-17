import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = cookieStore.get('authjs.session-token');
  const secureSessionCookie = cookieStore.get('__Secure-authjs.session-token');

  const session = await auth().catch((e) => ({ error: String(e) }));

  return NextResponse.json({
    cookies: {
      all: allCookies.map(c => ({ name: c.name, valueLength: c.value.length })),
      'authjs.session-token': sessionCookie ? `present (${sessionCookie.value.length} chars)` : 'absent',
      '__Secure-authjs.session-token': secureSessionCookie ? `present (${secureSessionCookie.value.length} chars)` : 'absent',
    },
    session,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
  });
}
