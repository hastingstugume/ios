import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_PAGES = new Set(['/', '/login', '/register']);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!AUTH_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get('session_token')?.value);
  if (!hasSessionCookie) {
    return NextResponse.next();
  }

  if (pathname === '/' || pathname === '/login' || pathname === '/register') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = pathname === '/register' ? search : '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register'],
};
