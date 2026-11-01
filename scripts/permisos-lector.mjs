// Deja un usuario de Aiven como SOLO LECTURA sobre la base de envíos (envios_ayora).
// Se corre UNA vez, con la cadena de conexión actual (la de administrador) en ADMIN_URL.
// El usuario debe existir antes (se crea en la consola de Aiven > Users).
//
// Uso:
//   ADMIN_URL='postgres://avnadmin:...@host:puerto/envios_ayora?sslmode=require' node scripts/permisos-lector.mjs lector_ia
import './cargar-env.mjs';
import pg from 'pg';

const usuario = process.argv[2] || 'lector_ia';
const url = process.env.ADMIN_URL || process.env.DATABASE_URL_LECTURA;
if (!url) {
  console.error('Falta ADMIN_URL (la cadena de conexión actual de envios_ayora).');
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]{2,40}$/.test(usuario)) {
  console.error('Nombre de usuario no válido. Use solo minúsculas, números y guion bajo (ej. lector_ia).');
  process.exit(1);
}

const u = new URL(url);
const base = decodeURIComponent(u.pathname.replace(/^\//, ''));
u.searchParams.delete('sslmode');
const ca = process.env.DATABASE_CA_CERT;
const ssl = process.env.DATABASE_SSL === 'off' ? false : ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: false };
const q = (s) => '"' + s.replace(/"/g, '""') + '"';

const c = new pg.Client({ connectionString: u.toString(), ssl, connectionTimeoutMillis: 15000 });
try {
  await c.connect();
  const existe = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [usuario]);
  if (!existe.rowCount) throw new Error(`El usuario "${usuario}" no existe todavía. Créelo primero en Aiven (Users > Add user).`);

  await c.query(`GRANT CONNECT ON DATABASE ${q(base)} TO ${q(usuario)}`);
  await c.query(`GRANT USAGE ON SCHEMA public TO ${q(usuario)}`);
  await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${q(usuario)}`);
  await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${q(usuario)}`);
  await c.query(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ${q(usuario)}`);
  await c.query(`REVOKE CREATE ON SCHEMA public FROM ${q(usuario)}`).catch(() => {});
  await c.query(`ALTER ROLE ${q(usuario)} SET default_transaction_read_only = on`);

  const r = await c.query(
    `SELECT count(*)::int AS tablas,
            count(*) FILTER (WHERE has_table_privilege($1, format('%I.%I', schemaname, tablename), 'SELECT'))::int AS puede_leer,
            count(*) FILTER (WHERE has_table_privilege($1, format('%I.%I', schemaname, tablename), 'INSERT,UPDATE,DELETE,TRUNCATE'))::int AS puede_escribir
       FROM pg_tables WHERE schemaname = 'public'`,
    [usuario]
  );
  const { tablas, puede_leer, puede_escribir } = r.rows[0];
  console.log(`Base: ${base} · Usuario: ${usuario}`);
  console.log(`Tablas: ${tablas} · puede leer: ${puede_leer} · puede escribir: ${puede_escribir}`);
  if (puede_leer !== tablas || puede_escribir !== 0) throw new Error('Los permisos no quedaron como se esperaba. No cambie nada en Vercel todavía.');
  console.log('✔ Listo: el usuario solo puede leer.');
} catch (e) {
  console.error('✘', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
