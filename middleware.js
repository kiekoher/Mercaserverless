import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function setSecurityHeaders(res) {
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
}

export async function middleware(req) {
  const requestHeaders = new Headers(req.headers);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'true';

  if (!bypassAuth) {
    // Create the Supabase client for production logic
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => res.cookies.set({ name, value, ...options }),
          remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
        },
      }
    );

    // Securely get the session from cookies
    const { data: { session } } = await supabase.auth.getSession();
    const { pathname } = req.nextUrl;

    // Redirect unauthenticated users from protected pages to login.
    if (!session && pathname !== '/login' && !pathname.startsWith('/api')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      const redirectRes = NextResponse.redirect(url);
      setSecurityHeaders(redirectRes);
      return redirectRes;
    }

    // Redirect authenticated users from the login page to the dashboard.
    if (session && pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      const redirectRes = NextResponse.redirect(url);
      setSecurityHeaders(redirectRes);
      return redirectRes;
    }
  }

  // --- Security Headers ---
  const nonceArray = new Uint8Array(16);
  crypto.getRandomValues(nonceArray);
  const nonce = btoa(String.fromCharCode(...nonceArray));
  requestHeaders.set('x-nonce', nonce);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';

  // Hardened CSP with specific Supabase host instead of wildcard
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://maps.gstatic.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org;
    media-src 'none';
    frame-src 'none';
    object-src 'none';
    base-uri 'none';
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' wss://${supabaseHost} https://${supabaseHost} https://*.googleapis.com;
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  res.headers.set('Content-Security-Policy', cspHeader);
  setSecurityHeaders(res);

  // Return the response object, which now has the cookies and headers set.
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * The /login page is now processed by the middleware.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
