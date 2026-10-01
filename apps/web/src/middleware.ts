import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/verify-email', '/api/public'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal next requests -> bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check session cookie or auth header indicator
  const hasSession = request.cookies.has('hrms_session') || request.cookies.has('next-auth.session-token');

  // If visiting root path '/'
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
