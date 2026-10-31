// Carga lo que la dueña ya explicó (reglas, plantillas, recolectores) en la memoria de la IA.
// Es seguro repetirlo: no duplica nada. Con --forzar vuelve a escribir las plantillas y los recolectores.
// Uso:  npm run db:seed        (o: npm run db:seed -- --forzar)
import './cargar-env.mjs';
import { conBasePg } from '../src/lib/memoria.js';
import { RECUERDOS, PLANTILLAS, RECOLECTORES } from '../src/lib/semilla.js';
import { MAX_RECUERDOS } from '../src/lib/memoria.js';

if (!process.env.DATABASE_URL_MEMORIA) {
  console.error('Falta DATABASE_URL_MEMORIA (en .env.local o en el ambiente).');
  process.exit(1);
}
const forzar = process.argv.includes('--forzar');
const PROHIBIDO = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|\b\d{3} ?\d{3} ?\d{11} ?\d\b/;

try {
  for (const [, c] of RECUERDOS) if (c.length > 500 || PROHIBIDO.test(c)) throw new Error('Recuerdo inválido: ' + c.slice(0, 60));
  for (const [, , c] of PLANTILLAS) if (PROHIBIDO.test(c)) throw new Error('Una plantilla trae datos bancarios.');

  const r = await conBasePg(async (c) => {
    const out = { recuerdos: 0, yaEstaban: 0, plantillas: 0, recolectores: 0, omitidosPorLimite: 0 };
    let total = (await c.query('SELECT count(*)::int AS n FROM recuerdos')).rows[0].n;
    for (const [cat, texto] of RECUERDOS) {
      const ya = await c.query('SELECT 1 FROM recuerdos WHERE contenido = $1', [texto]);
      if (ya.rowCount) { out.yaEstaban++; continue; }
      if (total >= MAX_RECUERDOS) { out.omitidosPorLimite++; continue; }
      await c.query('INSERT INTO recuerdos (categoria, contenido) VALUES ($1, $2)', [cat, texto]);
      total++; out.recuerdos++;
    }
    for (const [nombre, descripcion, contenido] of PLANTILLAS) {
      const q = forzar
        ? `INSERT INTO plantillas (nombre, descripcion, contenido) VALUES ($1,$2,$3)
           ON CONFLICT (nombre) DO UPDATE SET contenido_anterior = plantillas.contenido, contenido = EXCLUDED.contenido, descripcion = EXCLUDED.descripcion, actualizado_en = now()`
        : `INSERT INTO plantillas (nombre, descripcion, contenido) VALUES ($1,$2,$3) ON CONFLICT (nombre) DO NOTHING`;
      out.plantillas += (await c.query(q, [nombre, descripcion, contenido])).rowCount;
    }
    for (const [numero, nombre, ciudad, tipo] of RECOLECTORES) {
      if (numero === null) {
        const ya = await c.query(`SELECT 1 FROM recolectores WHERE tipo = 'directo'`);
        if (!ya.rowCount) out.recolectores += (await c.query('INSERT INTO recolectores (nombre, ciudad, tipo) VALUES ($1,$2,$3)', [nombre, ciudad, tipo])).rowCount;
        continue;
      }
      const q = forzar
        ? `INSERT INTO recolectores (numero, nombre, ciudad, tipo) VALUES ($1,$2,$3,$4)
           ON CONFLICT (numero) DO UPDATE SET nombre = EXCLUDED.nombre, ciudad = EXCLUDED.ciudad, actualizado_en = now()`
        : `INSERT INTO recolectores (numero, nombre, ciudad, tipo) VALUES ($1,$2,$3,$4) ON CONFLICT (numero) DO NOTHING`;
      out.recolectores += (await c.query(q, [numero, nombre, ciudad, tipo])).rowCount;
    }
    return out;
  });
  console.log(`✔ Listo. Recuerdos nuevos: ${r.recuerdos} (ya estaban ${r.yaEstaban}${r.omitidosPorLimite ? `, omitidos por límite ${r.omitidosPorLimite}` : ''}). Plantillas escritas: ${r.plantillas}. Recolectores escritos: ${r.recolectores}.`);
  process.exit(0);
} catch (e) {
  console.error('✘ No se pudo cargar:', e.code || '', e.message);
  process.exit(1);
}
