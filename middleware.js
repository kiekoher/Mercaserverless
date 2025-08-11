import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { randomBytes } from 'crypto';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  const supabaseHost = new URL(supabaseUrl).host;
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set(name, value, options);
        },
        remove(name, options) {
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        }
      }
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = req.nextUrl;

  // Redirect to login if no session and not on the login page
  if (!session && pathname !== '/login' && !pathname.startsWith('/api')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to dashboard if session exists and user is on the login page
  if (session && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Generate and add nonce to headers for CSP
  const nonce = Buffer.from(randomBytes(16)).toString('base64');
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // Set CSP header using the nonce
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://maps.gstatic.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org;
    media-src 'none';
    frame-src 'none';
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' wss://${supabaseHost} https://*.supabase.co https://*.googleapis.com;
  `.replace(/\s{2,}/g, ' ').trim();

  // Set all security headers
  res.headers.set('Content-Security-Policy', cspHeader);
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /login (the login page)
     */
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
