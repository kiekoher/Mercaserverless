import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import logger from './lib/logger.server';
import { crypto } from 'crypto';

// Forzar el middleware a ejecutarse en el entorno de Node.js
export const runtime = 'nodejs';

// Inicializa el rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
});

export async function middleware(req) {
  const res = NextResponse.next();
  const ip = req.ip ?? '127.0.0.1';

  // Lógica de Rate Limiting
  try {
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      logger.warn({ ip }, 'Rate limit exceeded');
      return new Response('Too many requests', { status: 429 });
    }
  } catch (error) {
    logger.error({ error }, 'Error with rate limiter');
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
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
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
  
  // Clonar las cabeceras de la respuesta para poder modificarlas
  const responseHeaders = new Headers(res.headers);
  responseHeaders.set('x-nonce', nonce);
  responseHeaders.set('Content-Security-Policy', contentSecurityPolicyHeaderValue);

  // Crear una nueva respuesta con las cabeceras actualizadas
  const newResponse = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });

  // Copiar las cookies de la respuesta original a la nueva
  res.cookies.getAll().forEach(cookie => {
    newResponse.cookies.set(cookie);
  });

  // Pasa las cabeceras a la respuesta
  return newResponse;
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
