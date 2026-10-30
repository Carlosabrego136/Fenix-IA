// Prueba cada consulta de solo lectura contra la base real de envíos (envios_ayora) y dice cuál falla.
// Uso:  npm run db:check   (lee DATABASE_URL_LECTURA de .env.local o del ambiente)
import './cargar-env.mjs';
import { verificarLectura } from '../src/lib/lectura.js';

if (!process.env.DATABASE_URL_LECTURA) {
  console.error('Falta DATABASE_URL_LECTURA. Cópiela de Aiven a .env.local y vuelva a intentar.');
  process.exit(1);
}
const resultados = await verificarLectura();
let fallas = 0;
for (const r of resultados) {
  if (r.ok) console.log('✔', r.nombre);
  else {
    fallas++;
    console.log('✘', r.nombre, '→', r.error);
  }
}
console.log(fallas ? `\n${fallas} consulta(s) fallaron. Mándeme este resultado para ajustarlas.` : '\nTodo bien: la IA puede leer su base de envíos.');
process.exit(fallas ? 1 : 0);
