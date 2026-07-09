import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string;
      sessionVersion?: number;
    };
  }

  interface User extends DefaultUser {
    sessionVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    sessionVersion?: number;
  }
}
