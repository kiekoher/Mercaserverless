import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { checkRateLimit } from './lib/rateLimiter';
// import logger from './lib/logger.server'; // Se ha eliminado el logger

// No es necesario forzar el runtime a 'nodejs' si usamos APIs compatibles
// export const runtime = 'nodejs';


export async function applyRateLimit(req) {
  const ip = req.ip ?? '127.0.0.1';
  try {
    const headersObject = req.headers && typeof req.headers.entries === 'function'
      ? Object.fromEntries(req.headers)
      : req.headers || {};
    const allowed = await checkRateLimit(
      { headers: headersObject, socket: { remoteAddress: ip } },
      { limit: 10 }
    );
    if (!allowed) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return false;
    }
  } catch (error) {
    console.error('Error with rate limiter:', error);
    if (process.env.RATE_LIMIT_FAIL_OPEN !== 'true') {
      return false;
    }
  }
  return true;
}

export async function middleware(req) {
  const res = NextResponse.next();
  const allowed = await applyRateLimit(req);
  if (!allowed) {
    return new Response('Too many requests', { status: 429 });
  }

  // Crea el cliente de Supabase para el middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options });
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          req.cookies.set({ name, value: '', ...options });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresca la sesión
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
  const publicUrls = ['/login', '/forgot-password', '/update-password'];

  // Redirección para usuarios no autenticados
  if (!session && !publicUrls.includes(pathname) && !pathname.startsWith('/api/auth')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirección para usuarios autenticados en páginas públicas
  if (session && publicUrls.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Lógica de cabeceras de seguridad (CSP)
  const nonce = crypto.randomUUID();
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', contentSecurityPolicyHeaderValue);

  res.cookies.getAll().forEach(cookie => {
    response.cookies.set(cookie);
  });
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
