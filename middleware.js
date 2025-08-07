import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
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

