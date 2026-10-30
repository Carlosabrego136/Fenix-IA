// Firma y verificación de la sesión (solo "jose", compatible con el middleware de Next).
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'fenix_ia';
export const DIAS_SESION = 30;

function clave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) return null;
  return new TextEncoder().encode(s);
}

export function sesionConfigurada() {
  return Boolean(clave() && process.env.ACCESS_PASSWORD);
}

export async function firmarSesion() {
  const k = clave();
  if (!k) throw new Error('Falta SESSION_SECRET (mínimo 24 caracteres)');
  return new SignJWT({ r: 'duena' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS_SESION}d`)
    .sign(k);
}

export async function verificarToken(token) {
  const k = clave();
  if (!k || !token) return false;
  try {
    await jwtVerify(token, k, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}
