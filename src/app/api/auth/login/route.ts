import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { checkAuthRateLimit } from '@/services/RateLimitService';
import { SESSION_MAX_AGE_SECONDS } from '@/services/SessionSecurityService';

const isSecure = process.env.AUTH_URL?.startsWith('https://') ?? false;
const COOKIE_NAME = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
const RATE_LIMIT_ERROR = '試行回数が多すぎます。しばらく待ってから再試行してください';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }

    const rateLimit = await checkAuthRateLimit(req, 'login', email);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: RATE_LIMIT_ERROR },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSec) },
        },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }

    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email ?? email,
        name: user.displayName ?? user.name ?? email,
        sessionVersion: user.sessionVersion,
      },
      secret: process.env.AUTH_SECRET!,
      maxAge: SESSION_MAX_AGE_SECONDS,
      salt: COOKIE_NAME,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
      secure: isSecure,
    });

    return response;
  } catch (err) {
    console.error('[LOGIN] ERROR:', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
