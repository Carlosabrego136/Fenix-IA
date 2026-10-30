import { NextResponse } from 'next/server';
import { COOKIE, verificarToken } from '@/lib/token';

const PUBLICAS = ['/login', '/api/login', '/manifest.webmanifest', '/sw.js', '/offline.html', '/favicon.ico'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.includes(pathname) || pathname.startsWith('/icons/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }
  const ok = await verificarToken(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Su sesión venció. Vuelva a entrar.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
