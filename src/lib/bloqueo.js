// Límite de intentos de contraseña por IP.
// Se guarda en la base de la IA (compartida entre todas las instancias de Vercel) y, además, en memoria.
// Si la base no responde, se usa solo la memoria: el acceso nunca se rompe por esto.
import { conBasePg } from './memoria.js';

export const MAX_INTENTOS = 6;
export const BLOQUEO_MIN = 15;
const BLOQUEO_MS = BLOQUEO_MIN * 60 * 1000;
const mem = globalThis.__fenixIntentos || (globalThis.__fenixIntentos = new Map());

function bloqueadoMem(ip) {
  const r = mem.get(ip);
  return Boolean(r && r.n >= MAX_INTENTOS && Date.now() - r.t < BLOQUEO_MS);
}

export async function estaBloqueado(ip) {
  if (bloqueadoMem(ip)) return true;
  try {
    const r = await conBasePg((c) =>
      c.query(
        `SELECT n FROM login_intentos WHERE ip = $1 AND ultimo > now() - interval '${BLOQUEO_MIN} minutes'`,
        [ip]
      )
    );
    return Boolean(r.rows[0] && r.rows[0].n >= MAX_INTENTOS);
  } catch {
    return false;
  }
}

export async function registrarFallo(ip) {
  const r = mem.get(ip);
  mem.set(ip, { n: (r && Date.now() - r.t < BLOQUEO_MS ? r.n : 0) + 1, t: Date.now() });
  try {
    await conBasePg(async (c) => {
      await c.query(
        `INSERT INTO login_intentos (ip, n, ultimo) VALUES ($1, 1, now())
         ON CONFLICT (ip) DO UPDATE SET
           n = CASE WHEN login_intentos.ultimo > now() - interval '${BLOQUEO_MIN} minutes' THEN login_intentos.n + 1 ELSE 1 END,
           ultimo = now()`,
        [ip]
      );
      await c.query(`DELETE FROM login_intentos WHERE ultimo < now() - interval '1 day'`);
    });
  } catch {}
}

export async function limpiarIntentos(ip) {
  mem.delete(ip);
  try {
    await conBasePg((c) => c.query('DELETE FROM login_intentos WHERE ip = $1', [ip]));
  } catch {}
}
