import { NextRequest, NextResponse } from 'next/server';
import { createCredentialsUser } from '@/services/AuthService';
import { checkAuthRateLimit } from '@/services/RateLimitService';

const RATE_LIMIT_ERROR = '試行回数が多すぎます。しばらく待ってから再試行してください';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';

  const rateLimit = await checkAuthRateLimit(request, 'signup', email);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: RATE_LIMIT_ERROR },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSec) },
      },
    );
  }

  const result = await createCredentialsUser({
    email,
    password: typeof body?.password === 'string' ? body.password : '',
    displayName: typeof body?.displayName === 'string' ? body.displayName : '',
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
