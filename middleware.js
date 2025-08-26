import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { checkRateLimit } from './lib/rateLimiter';
import { validateCsrfToken } from './lib/csrf';
import logger from './lib/logger.server';

export async function middleware(req) {
  const res = NextResponse.next();
  let session = null;

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

  // In a test environment, we may bypass real authentication.
  if (process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'true') {
    const role = req.cookies.get('cypress-role')?.value;
    if (role) {
      // Create a mock session object that mimics a real Supabase session.
      session = {
        user: {
          id: `${role}-user-id`, // Stable ID for tests
          email: `${role}@example.com`,
          app_metadata: { role },
        },
        expires_in: 3600,
        access_token: 'mock-access-token',
      };
    }
  }

  if (!session) {
    // If not in a test with a role, or if the cookie is missing, perform real auth.
    const { data } = await supabase.auth.getSession();
    session = data.session;
  }

  // 4. Apply Rate Limiting to all API requests to prevent abuse
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const allowed = await checkRateLimit(req, { userId: session?.user?.id });
    if (!allowed) {
      logger.warn({ ip: req.ip, userId: session?.user?.id, pathname: req.nextUrl.pathname }, 'Rate limit exceeded');
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 5. Validate CSRF only for state-changing methods to allow simple GET/HEAD requests.
  // We exclude auth routes which have their own security mechanisms.
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (stateChangingMethods.includes(req.method) && !req.nextUrl.pathname.startsWith('/api/auth')) {
    const csrfError = validateCsrfToken(req);
    if (csrfError) {
      logger.error({ ip: req.ip, userId: session?.user?.id, pathname: req.nextUrl.pathname, error: csrfError }, 'CSRF validation failed');
      return new NextResponse(JSON.stringify({ error: `Security error. Please refresh the page. (${csrfError})` }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 6. Handle authentication and redirects
  const { pathname } = req.nextUrl;
  const publicUrls = ['/login', '/forgot-password', '/update-password', '/api/csrf', '/api/csp-report'];
  const isPublicRoute = publicUrls.includes(pathname) || pathname.startsWith('/api/auth');

  if (!session && !isPublicRoute) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    logger.info({ pathname }, 'Unauthenticated user redirected to login');
    return NextResponse.redirect(url);
  }

  if (session && publicUrls.includes(pathname) && pathname !== '/api/csrf' && pathname !== '/api/csp-report') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // 7. Apply robust Content Security Policy (CSP)
  const nonce = crypto.randomUUID();
  // Adjusted CSP: Allows Google Maps, unsafe-inline for MUI compatibility, and strict-dynamic for script loading.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://maps.gstatic.com https://maps.googleapis.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
    report-uri /api/csp-report;
  `.replace(/\s{2,}/g, ' ').trim();

  res.headers.set('x-nonce', nonce);
  res.headers.set('Content-Security-Policy', cspHeader);

  // 8. Return the final response object, which now contains updated cookies and security headers
  return res;
}

export const config = {
  // Exclude static assets, images, and the Supabase auth callback from the middleware.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)',
  ],
};
