// Crea (si no existen) las tablas de la memoria de la IA en la base nueva de Aiven.
// Uso:  npm run db:setup   (lee DATABASE_URL_MEMORIA de .env.local o del ambiente)
import './cargar-env.mjs';
import { prepararEsquema } from '../src/lib/memoria.js';
import { query } from '../src/lib/db.js';

if (!process.env.DATABASE_URL_MEMORIA) {
  console.error('Falta DATABASE_URL_MEMORIA. Cópiela de Aiven a .env.local y vuelva a intentar.');
  process.exit(1);
}
try {
  await prepararEsquema();
  const r = await query('memoria', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
  console.log('✔ Base de memoria lista. Tablas:', r.rows.map((x) => x.table_name).join(', '));
  process.exit(0);
} catch (e) {
  console.error('✘ No se pudo preparar la base:', e.code || '', e.message);
  process.exit(1);
}
