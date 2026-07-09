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

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
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

export async function changePasswordForUser(
  input: ChangePasswordInput,
): Promise<CreateCredentialsUserResult> {
  const userId = input.userId.trim();
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;

  if (!userId || !currentPassword || !newPassword) {
    return { success: false, error: '全ての項目を入力してください' };
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { success: false, error: 'パスワード変更できるアカウントが見つかりません' };
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    return { success: false, error: '現在のパスワードが違います' };
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsCurrent) {
    return { success: false, error: '現在とは異なるパスワードを指定してください' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });
  });

  return { success: true };
}
