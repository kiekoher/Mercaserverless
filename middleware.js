import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  if (!session) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const path = req.nextUrl.pathname;
  if (path.startsWith('/puntos-de-venta') && !['supervisor', 'admin'].includes(profile?.role)) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  if (path.startsWith('/rutas') && !['supervisor', 'admin'].includes(profile?.role)) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/puntos-de-venta', '/rutas'],
};

