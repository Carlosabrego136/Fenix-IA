// Conexión a Aiven (Postgres) SIN pool.
// Aiven solo permite 20 conexiones para todas las bases del servidor, y en Vercel los pools dejan
// conexiones dormidas. Por eso: un Client por consulta (o por sesión corta), cerrado siempre en `finally`,
// máximo 2 conexiones simultáneas por instancia, y reintento SOLO si falla al conectar.
import pg from 'pg';

const { Client } = pg;

const MAX_SIMULTANEAS = 2;
const ESPERAS_MS = [300, 700, 1300];
const CODIGOS_REINTENTO = new Set(['53300', '57P03', 'ECONNRESET', 'ETIMEDOUT']);
const ENTORNOS = { memoria: 'DATABASE_URL_MEMORIA', lectura: 'DATABASE_URL_LECTURA' };

// Semáforo compartido por todas las bases de esta instancia.
const g = globalThis;
g.__fenixSem ||= { activas: 0, cola: [] };
const sem = g.__fenixSem;

function adquirir() {
  if (sem.activas < MAX_SIMULTANEAS) {
    sem.activas++;
    return Promise.resolve();
  }
  return new Promise((resolve) => sem.cola.push(resolve));
}
function liberar() {
  const siguiente = sem.cola.shift();
  if (siguiente) siguiente(); // el turno pasa directo al siguiente en la cola
  else sem.activas--;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function configurada(cual) {
  return Boolean(process.env[ENTORNOS[cual]]);
}

function configuracion(cual) {
  const nombre = ENTORNOS[cual];
  const url = process.env[nombre];
  if (!url) throw new Error(`Falta la variable ${nombre}`);
  const u = new URL(url);
  u.searchParams.delete('sslmode'); // el SSL se define explícitamente abajo
  const ca = process.env.DATABASE_CA_CERT;
  let ssl;
  if (process.env.DATABASE_SSL === 'off') ssl = false; // solo para pruebas locales
  else if (ca) ssl = { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  else ssl = { rejectUnauthorized: false };
  return {
    connectionString: u.toString(),
    ssl,
    connectionTimeoutMillis: 12000,
    statement_timeout: 15000,
    query_timeout: 15000,
  };
}

function esErrorDeConexion(e) {
  if (CODIGOS_REINTENTO.has(e?.code)) return true;
  const m = String(e?.message || '');
  return /connection timeout|terminated unexpectedly|too many clients/i.test(m);
}

async function conectar(config) {
  for (let intento = 0; ; intento++) {
    const client = new Client(config);
    client.on('error', () => {});
    try {
      await client.connect();
      return client;
    } catch (e) {
      try {
        await client.end();
      } catch {}
      if (intento < ESPERAS_MS.length && esErrorDeConexion(e)) {
        await dormir(ESPERAS_MS[intento] + Math.random() * 150);
        continue;
      }
      throw e;
    }
  }
}

// Una consulta suelta: abre, ejecuta, cierra.
export async function query(cual, texto, params) {
  return sesion(cual, (c) => c.query(texto, params));
}

// Varias sentencias en UNA sola conexión (cuenta como un solo cupo del semáforo).
export async function sesion(cual, fn) {
  const config = configuracion(cual);
  await adquirir();
  let client;
  try {
    client = await conectar(config);
    return await fn(client);
  } finally {
    if (client) {
      try {
        await client.end();
      } catch {}
    }
    liberar();
  }
}

// Transacción: todas las sentencias comparten el mismo cliente.
export async function transaccion(cual, fn) {
  return sesion(cual, async (c) => {
    await c.query('BEGIN');
    try {
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      try {
        await c.query('ROLLBACK');
      } catch {}
      throw e;
    }
  });
}

// Solo lectura garantizada: la transacción se abre READ ONLY y siempre se revierte.
export async function soloLectura(cual, fn) {
  return sesion(cual, async (c) => {
    await c.query('BEGIN READ ONLY');
    try {
      return await fn(c);
    } finally {
      try {
        await c.query('ROLLBACK');
      } catch {}
    }
  });
}
