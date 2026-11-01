import { NextResponse } from 'next/server';
import { COOKIE, verificarToken } from '@/lib/token';

const PUBLICAS = ['/login', '/api/login', '/manifest.webmanifest', '/sw.js', '/offline.html', '/favicon.ico'];

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Defensa contra peticiones que otro sitio intente disparar con la sesión abierta:
// si la petición trae Origin y no es este mismo sitio, se rechaza.
function origenAjeno(req) {
  if (!ESCRITURA.has(req.method)) return false;
  const origen = req.headers.get('origin');
  if (!origen) return false;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    return new URL(origen).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/') && origenAjeno(req)) {
    return NextResponse.json({ error: 'Petición no permitida.' }, { status: 403 });
  }
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
