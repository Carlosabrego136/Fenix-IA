import { NextResponse } from 'next/server';
import { passwordCorrecta, err } from '@/lib/auth';
import { COOKIE, DIAS_SESION, firmarSesion, sesionConfigurada } from '@/lib/token';
import { estaBloqueado, registrarFallo, limpiarIntentos } from '@/lib/bloqueo';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!sesionConfigurada()) {
    return err(500, 'La app aún no está configurada: faltan ACCESS_PASSWORD o SESSION_SECRET (24+ caracteres).');
  }
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  if (await estaBloqueado(ip)) {
    return err(429, 'Demasiados intentos. Espere unos minutos e intente de nuevo.');
  }
  let body = {};
  try {
    body = await req.json();
  } catch {}
  if (!passwordCorrecta(body.password)) {
    await registrarFallo(ip);
    await new Promise((r) => setTimeout(r, 600));
    return err(401, 'Contraseña incorrecta.');
  }
  await limpiarIntentos(ip);
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
