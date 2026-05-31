import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  SESSION_MAX_AGE_SECONDS,
  getUserSessionVersion,
  validateVersionedSessionToken,
} from '@/services/SessionSecurityService';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード',     type: 'password' },
      },
      authorize: async (credentials) => {
        const email    = credentials?.email    as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id:    user.id,
          name:  user.displayName ?? user.name ?? email,
          email: user.email ?? email,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        const sessionVersion = user.sessionVersion ?? await getUserSessionVersion(user.id);
        if (!sessionVersion) return null;
        token.id = user.id;
        token.sessionVersion = sessionVersion;
        return token;
      }

      const validated = await validateVersionedSessionToken(token);
      if (!validated.valid) return null;
      token.id = validated.userId;
      token.sessionVersion = validated.sessionVersion;
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id,
        sessionVersion: token.sessionVersion,
      },
    }),
  },
  // 将来 Google/Discord を追加する場合はここに providers を追記するだけでOK
});
