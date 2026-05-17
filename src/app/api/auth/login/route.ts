import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

const isSecure = process.env.AUTH_URL?.startsWith('https://') ?? false;
const COOKIE_NAME = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
const MAX_AGE = 60 * 60 * 24;

export async function POST(req: NextRequest) {
  console.log('[LOGIN] POST /api/auth/login called');
  console.log('[LOGIN] AUTH_URL:', process.env.AUTH_URL);
  console.log('[LOGIN] isSecure:', isSecure);
  console.log('[LOGIN] COOKIE_NAME:', COOKIE_NAME);

  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    console.log('[LOGIN] email:', email, '| password length:', password.length);

    if (!email || !password) {
      console.log('[LOGIN] FAIL: missing email or password');
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    console.log('[LOGIN] user found:', !!user, '| has passwordHash:', !!user?.passwordHash);

    if (!user?.passwordHash) {
      console.log('[LOGIN] FAIL: user not found or no passwordHash');
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log('[LOGIN] bcrypt valid:', valid);

    if (!valid) {
      console.log('[LOGIN] FAIL: wrong password');
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }

    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email ?? email,
        name: user.displayName ?? user.name ?? email,
      },
      secret: process.env.AUTH_SECRET!,
      maxAge: MAX_AGE,
      salt: COOKIE_NAME,
    });

    console.log('[LOGIN] JWT encoded, length:', token.length);

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
      secure: isSecure,
    });

    console.log('[LOGIN] SUCCESS: cookie set, returning');
    return response;
  } catch (err) {
    console.error('[LOGIN] ERROR:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
