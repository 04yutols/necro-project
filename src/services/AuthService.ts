import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const MIXED_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

export function validatePassword(password: string): string | null {
  if (password.length >= 12) return null;
  if (MIXED_PATTERN.test(password)) return null;
  return 'パスワードは12文字以上、または英数字を含む8文字以上にしてください';
}

export interface CreateCredentialsUserInput {
  email: string;
  password: string;
  displayName: string;
}

export interface CreateCredentialsUserResult {
  success: boolean;
  error?: string;
}

export async function createCredentialsUser(
  input: CreateCredentialsUserInput,
): Promise<CreateCredentialsUserResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const displayName = input.displayName.trim();

  if (!email || !password || !displayName) {
    return { success: false, error: '全ての項目を入力してください' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'メールアドレスの形式を確認してください' };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }
  if (displayName.length < 2 || displayName.length > 16) {
    return { success: false, error: 'プレイヤー名は2〜16文字にしてください' };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { success: false, error: 'このメールアドレスは既に登録されています' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, displayName, name: displayName },
  });

  return { success: true };
}
