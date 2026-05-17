import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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
  if (password.length < 8) {
    return { success: false, error: 'パスワードは8文字以上にしてください' };
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
