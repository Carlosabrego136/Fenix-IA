import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { COOKIE, verificarToken } from './token.js';

export function passwordCorrecta(intento) {
  const real = process.env.ACCESS_PASSWORD || '';
  if (!real || typeof intento !== 'string') return false;
  const a = crypto.createHash('sha256').update(intento).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function haySesion() {
  const jar = await cookies();
  return verificarToken(jar.get(COOKIE)?.value);
}

export const err = (estado, mensaje) => Response.json({ error: mensaje }, { status: estado });

// Devuelve una Response de error si no hay sesión; null si todo bien.
export async function exigirSesion() {
  return (await haySesion()) ? null : err(401, 'Su sesión venció. Vuelva a entrar.');
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
