import { auth } from '@/auth';

export default auth((req) => {
  if (req.nextUrl.pathname.startsWith('/api/game') && !req.auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
});

export const config = { matcher: ['/api/game/:path*'] };
