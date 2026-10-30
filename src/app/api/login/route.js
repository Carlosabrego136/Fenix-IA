import { NextResponse } from 'next/server';
import { passwordCorrecta, err } from '@/lib/auth';
import { COOKIE, DIAS_SESION, firmarSesion, sesionConfigurada } from '@/lib/token';

export const dynamic = 'force-dynamic';

// Límite de intentos por IP (en memoria de la instancia: frena el ensayo y error básico).
const intentos = globalThis.__fenixIntentos || (globalThis.__fenixIntentos = new Map());
const MAX = 6;
const BLOQUEO_MS = 15 * 60 * 1000;

export async function POST(req) {
  if (!sesionConfigurada()) {
    return err(500, 'La app aún no está configurada: faltan ACCESS_PASSWORD o SESSION_SECRET (24+ caracteres).');
  }
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const reg = intentos.get(ip);
  if (reg && reg.n >= MAX && Date.now() - reg.t < BLOQUEO_MS) {
    return err(429, 'Demasiados intentos. Espere unos minutos e intente de nuevo.');
  }
  let body = {};
  try {
    body = await req.json();
  } catch {}
  if (!passwordCorrecta(body.password)) {
    intentos.set(ip, { n: (reg && Date.now() - reg.t < BLOQUEO_MS ? reg.n : 0) + 1, t: Date.now() });
    await new Promise((r) => setTimeout(r, 600));
    return err(401, 'Contraseña incorrecta.');
  }
  intentos.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await firmarSesion(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DIAS_SESION * 86400,
  });
  return res;
}
