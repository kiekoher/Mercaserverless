import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
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

  // Si no hay sesión y la ruta no es /login, redirigir a /login
  if (!session && pathname !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Si hay sesión y el usuario está en /login, redirigir al dashboard
  if (session && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Si hay sesión, verificar roles para rutas protegidas
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const userRole = profile?.role;
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard'; // URL de fallback si no tiene permiso

    // Rutas de Admin
    if (pathname.startsWith('/admin') && userRole !== 'admin') {
      return NextResponse.redirect(url);
    }

    // Rutas de Supervisor
    if ((pathname.startsWith('/rutas') || pathname.startsWith('/puntos-de-venta')) && !['supervisor', 'admin'].includes(userRole)) {
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas de solicitud excepto las siguientes:
     * - api (rutas de API)
     * - _next/static (archivos estáticos)
     * - _next/image (archivos de optimización de imágenes)
     * - favicon.ico (archivo de favicon)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

