import { NextResponse } from 'next/server';
import { createCredentialsUser } from '@/services/AuthService';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await createCredentialsUser({
    email: typeof body?.email === 'string' ? body.email : '',
    password: typeof body?.password === 'string' ? body.password : '',
    displayName: typeof body?.displayName === 'string' ? body.displayName : '',
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
