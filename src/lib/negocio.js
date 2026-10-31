// Datos del negocio que viven en la base de memoria (fenix_ia): folios de PZ Express, pagos, plantillas
// y recolectores. Solo Postgres: sin la base de memoria configurada devuelven un error amable.
import { conBasePg, conTransaccionPg } from './memoria.js';
import { configurada } from './db.js';
import { hoyISO } from './config.js';

const SIN_BD = { error: 'La memoria permanente (base fenix_ia) no está configurada, así que esta función no está disponible en este momento.' };
export const hayBD = () => configurada('memoria');

/* ------------------------------ utilidades puras ------------------------------ */

export const normClave = (f) => String(f ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const ms = (iso) => Date.parse(iso + 'T00:00:00Z');
// Números de tarjeta (16) o CLABE (18): nunca se guardan en plantillas ni en la memoria de la IA.
export const tieneDatosBancarios = (txt) => /\d{16,18}/.test(String(txt ?? '').replace(/(?<=\d)[ -](?=\d)/g, ''));
export const diasEntre = (desde, hasta) => Math.round((ms(hasta) - ms(desde)) / 86400000);
export const sumarDias = (iso, n) => new Date(ms(iso) + n * 86400000).toISOString().slice(0, 10);

export const DIAS_AVISO = [10, 12, 13];
export const DIA_MULTA = 14;
export const DIA_DECOMISO = 60;

// Día 0 = fecha de recepción. Último día sin multa = recepción + 13. Desde el día 14 puede haber multa ($50).
export function situacion(fechaRecepcion, hoy = hoyISO()) {
  const dias = diasEntre(fechaRecepcion, hoy);
  const ultimo = sumarDias(fechaRecepcion, DIA_MULTA - 1);
  let nivel = 'ok';
  let texto = `lleva ${dias} día(s); último día sin multa: ${ultimo}`;
  if (dias >= DIA_DECOMISO) { nivel = 'decomiso'; texto = `lleva ${dias} días: ya pasó el límite de 60, la paquetería puede decomisarlo`; }
  else if (dias >= DIA_MULTA) { nivel = 'multa'; texto = `lleva ${dias} días: ya cumplió 14, probablemente ya tiene multa de $50 (por confirmar); decomiso a los 60 (faltan ${DIA_DECOMISO - dias})`; }
  else if (dias === 13) { nivel = 'hoy_ultimo_dia'; texto = 'HOY es el último día sin multa'; }
  else if (dias === 12) { nivel = 'manana_ultimo_dia'; texto = 'mañana es el último día sin multa'; }
  else if (dias >= 10) { nivel = 'atencion'; texto = `lleva ${dias} días; el último día sin multa es el ${ultimo} (faltan ${13 - dias})`; }
  else if (dias < 0) { nivel = 'fecha_futura'; texto = 'la fecha de recepción es futura: revisar'; }
  return { dias_transcurridos: dias, ultimo_dia_seguro: ultimo, nivel, resumen: texto };
}

// Etiqueta del paquete: "AYORA / Nombre / 3" => recolector foráneo número 3.
export function clasificar(...textos) {
  const t = textos.filter(Boolean).join(' | ');
  const m = t.match(/AYORA\s*[\/\\\-–]\s*([^\/\\|]+?)\s*[\/\\\-–]\s*(\d{1,2})\b/i);
  if (m) return { clasificacion: 'foraneo', recolector_numero: Number(m[2]), nombre_en_etiqueta: m[1].trim() };
  if (/AYORA/i.test(t)) return { clasificacion: 'ayora_sin_numero', recolector_numero: null };
  return { clasificacion: 'sin_clasificar', recolector_numero: null };
}

export function pesoVolumetrico({ largo_cm, ancho_cm, alto_cm, peso_real_kg, cajas = 1 }) {
  const [l, a, h] = [largo_cm, ancho_cm, alto_cm].map(Number);
  if (![l, a, h].every((x) => x > 0 && x < 1000)) return { error: 'Faltan medidas válidas (largo, ancho y alto en cm).' };
  const vol = (l * a * h) / 5000;
  const real = peso_real_kg === undefined || peso_real_kg === null || peso_real_kg === '' ? null : Number(peso_real_kg);
  const mayor = real !== null && Number.isFinite(real) ? Math.max(real, vol) : vol;
  return {
    cajas: Number(cajas) || 1,
    medidas: `${l}x${a}x${h} cm`,
    peso_volumetrico_kg: Math.round(vol * 10) / 10,
    peso_real_kg: real,
    peso_mayor_kg: Math.round(mayor * 10) / 10,
    formula: 'largo x ancho x alto / 5000',
    aviso: 'El peso facturable final lo redondea la dueña con su regla (en su ejemplo 27.4 kg se facturó como 30 kg). Esa regla de redondeo aún no está confirmada: no la inventes, pregúntale si no la sabes. Los precios salen de sus tarifas, nunca los inventes.',
  };
}

/* ------------------------------ folios ------------------------------ */

const COLS_FOLIO = `id::int AS id, folio, to_char(fecha_recepcion,'YYYY-MM-DD') AS fecha_recepcion, sucursal_origen, sucursal_destino,
  remitente, destinatario, tamano, precio::float AS precio, recolector_numero, clasificacion, estado,
  to_char(fecha_recogido,'YYYY-MM-DD') AS fecha_recogido, veces_enviado, notas`;

const t = (v, n = 120) => (typeof v === 'string' ? v.trim().slice(0, n) : v == null ? null : String(v).slice(0, n)) || null;

function limpiarFolio(x) {
  const folio = t(x?.folio, 40);
  const clave = normClave(folio);
  const e = [];
  if (!folio || clave.length < 6) e.push('folio inválido o muy corto');
  const fecha = t(x?.fecha_recepcion, 10);
  if (!esFecha(fecha)) e.push('falta la fecha de recepción (AAAA-MM-DD)');
  else if (diasEntre(hoyISO(), fecha) > 0) e.push('la fecha de recepción es futura');
  const precio = x?.precio === null || x?.precio === undefined || x?.precio === '' ? null : Number(x.precio);
  if (precio !== null && !(precio >= 0 && precio < 100000)) e.push('precio raro');
  const reg = {
    folio, clave, fecha_recepcion: fecha,
    sucursal_origen: t(x?.sucursal_origen), sucursal_destino: t(x?.sucursal_destino),
    remitente: t(x?.remitente, 200), destinatario: t(x?.destinatario, 200), tamano: t(x?.tamano, 40),
    precio: precio !== null && Number.isFinite(precio) ? precio : null, notas: t(x?.notas, 300),
  };
  Object.assign(reg, clasificar(reg.remitente, reg.destinatario, reg.notas));
  return { reg, errores: e };
}

export async function proponerFolios({ turno, folios }) {
  if (!hayBD()) return SIN_BD;
  const lista = (Array.isArray(folios) ? folios : []).slice(0, 60);
  if (!lista.length) return { error: 'No me pasaste ningún folio.' };
  return conBasePg(async (c) => {
    const hoy = hoyISO();
    const vistos = new Map();
    const nuevos = [], repetidos = [], invalidos = [];
    for (const x of lista) {
      const { reg, errores } = limpiarFolio(x);
      if (errores.length) { invalidos.push({ folio: reg.folio, problemas: errores }); continue; }
      if (vistos.has(reg.clave)) { repetidos.push({ folio: reg.folio, motivo: 'repetido dentro de esta misma lista' }); continue; }
      vistos.set(reg.clave, true);
      const ex = await c.query(
        `SELECT folio, estado, to_char(fecha_recepcion,'YYYY-MM-DD') AS fecha_recepcion, veces_enviado,
                to_char(fecha_recogido,'YYYY-MM-DD') AS fecha_recogido FROM folios WHERE clave = $1`, [reg.clave]);
      if (ex.rowCount) {
        const f = ex.rows[0];
        repetidos.push({ folio: reg.folio, motivo: 'ya estaba registrado', estado: f.estado, fecha_recepcion: f.fecha_recepcion, fecha_recogido: f.fecha_recogido, veces_enviado_antes: f.veces_enviado, clave: reg.clave });
        continue;
      }
      nuevos.push({ ...reg, ...situacion(reg.fecha_recepcion, hoy) });
    }
    await c.query('DELETE FROM propuestas_folios');
    if (nuevos.length || repetidos.some((r) => r.clave)) {
      await c.query('INSERT INTO propuestas_folios (turno, datos) VALUES ($1, $2)', [turno, JSON.stringify({ nuevos, repetidos: repetidos.filter((r) => r.clave).map((r) => r.clave) })]);
    }
    return {
      pendiente_de_confirmacion: true,
      nuevos, repetidos, invalidos,
      instruccion: 'NO se ha guardado nada todavía. Muéstrale a la dueña la lista (folio, fecha de recepción, días, último día sin multa, recolector si lo hay), marca los dudosos y los repetidos, y pídele que confirme. Solo si responde que sí en su SIGUIENTE mensaje, llama a confirmar_folios.',
    };
  });
}

export async function confirmarFolios({ turno }) {
  if (!hayBD()) return SIN_BD;
  return conTransaccionPg(async (c) => {
    const p = await c.query(`SELECT id, turno, datos FROM propuestas_folios WHERE creado_en > now() - interval '1 day' ORDER BY id DESC LIMIT 1`);
    if (!p.rowCount) return { error: 'no_hay_pendiente' };
    if (Number(p.rows[0].turno) >= turno) return { error: 'falta_confirmacion' };
    const { nuevos = [], repetidos = [] } = p.rows[0].datos || {};
    let guardados = 0, sumados = 0;
    for (const n of nuevos) {
      const r = await c.query(
        `INSERT INTO folios (clave, folio, fecha_recepcion, sucursal_origen, sucursal_destino, remitente, destinatario, tamano, precio, recolector_numero, clasificacion, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (clave) DO UPDATE SET veces_enviado = folios.veces_enviado + 1, actualizado_en = now()
         RETURNING (xmax = 0) AS nuevo`,
        [n.clave, n.folio, n.fecha_recepcion, n.sucursal_origen, n.sucursal_destino, n.remitente, n.destinatario, n.tamano, n.precio, n.recolector_numero, n.clasificacion, n.notas]);
      if (r.rows[0].nuevo) guardados++; else sumados++;
    }
    for (const clave of repetidos) {
      const r = await c.query('UPDATE folios SET veces_enviado = veces_enviado + 1, actualizado_en = now() WHERE clave = $1', [clave]);
      sumados += r.rowCount;
    }
    await c.query('DELETE FROM propuestas_folios');
    return { guardados, repetidos_contados: sumados };
  });
}

export async function cancelarFolios() {
  if (!hayBD()) return SIN_BD;
  await conBasePg((c) => c.query('DELETE FROM propuestas_folios'));
  return { cancelado: true };
}

async function buscarUno(c, ref) {
  const clave = normClave(ref);
  const r = await c.query(`SELECT ${COLS_FOLIO} FROM folios WHERE clave = $1 OR clave LIKE $2 ORDER BY (clave = $1) DESC LIMIT 2`, [clave, '%' + clave]);
  return r.rows;
}

export async function editarFolio({ folio, cambios }) {
  if (!hayBD()) return SIN_BD;
  const ref = normClave(folio);
  if (ref.length < 4) return { error: 'Indica el folio completo (o al menos sus últimos dígitos).' };
  return conBasePg(async (c) => {
    const f = await buscarUno(c, ref);
    if (!f.length) return { error: `No encontré el folio ${folio}.` };
    if (f.length > 1 && normClave(f[0].folio) !== ref) return { error: 'Hay más de un folio con esos dígitos; indica el folio completo.', coincidencias: f.map((x) => x.folio) };
    const permitidos = ['fecha_recepcion', 'sucursal_origen', 'sucursal_destino', 'remitente', 'destinatario', 'tamano', 'precio', 'recolector_numero', 'notas'];
    const sets = [], vals = [];
    for (const k of permitidos) {
      if (cambios && k in cambios) {
        let v = cambios[k];
        if (k === 'fecha_recepcion' && !esFecha(v)) return { error: 'La fecha debe ser AAAA-MM-DD.' };
        if (k === 'precio' || k === 'recolector_numero') v = v === null || v === '' ? null : Number(v);
        else v = t(v, k === 'remitente' || k === 'destinatario' ? 200 : 300);
        vals.push(v);
        sets.push(`${k} = $${vals.length}`);
      }
    }
    if (!sets.length) return { error: 'No indicaste qué cambiar.' };
    vals.push(f[0].id);
    await c.query(`UPDATE folios SET ${sets.join(', ')}, actualizado_en = now() WHERE id = $${vals.length}`, vals);
    const n = await c.query(`SELECT ${COLS_FOLIO} FROM folios WHERE id = $1`, [f[0].id]);
    return { actualizado: n.rows[0], ...situacion(n.rows[0].fecha_recepcion) };
  });
}

export async function marcarFolios({ folios, estado, fecha }) {
  if (!hayBD()) return SIN_BD;
  if (!['recogido', 'pendiente'].includes(estado)) return { error: 'El estado debe ser recogido o pendiente.' };
  const lista = (Array.isArray(folios) ? folios : []).slice(0, 80);
  if (!lista.length) return { error: 'No indicaste folios.' };
  const dia = esFecha(fecha) ? fecha : hoyISO();
  return conBasePg(async (c) => {
    const ok = [], noEncontrados = [], ambiguos = [];
    for (const ref of lista) {
      const clave = normClave(ref);
      if (clave.length < 4) { noEncontrados.push(ref); continue; }
      const f = await buscarUno(c, clave);
      if (!f.length) { noEncontrados.push(ref); continue; }
      if (f.length > 1 && normClave(f[0].folio) !== clave) { ambiguos.push(ref); continue; }
      await c.query(`UPDATE folios SET estado = $1, fecha_recogido = $2, actualizado_en = now() WHERE id = $3`, [estado, estado === 'recogido' ? dia : null, f[0].id]);
      ok.push(f[0].folio);
    }
    return { marcados: ok.length, folios_marcados: ok, no_encontrados: noEncontrados, ambiguos, estado, fecha: estado === 'recogido' ? dia : null };
  });
}

export async function quitarFolio({ id }) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const r = await c.query('DELETE FROM folios WHERE id = $1 RETURNING folio', [id]);
    return r.rowCount ? { quitado: r.rows[0].folio } : { error: 'No existe ese folio.' };
  });
}

export async function buscarFolios({ texto, estado, recolector_numero, min_dias, limite } = {}) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const w = [], v = [];
    const p = (x) => { v.push(x); return `$${v.length}`; };
    if (estado === 'pendiente' || estado === 'recogido') w.push(`estado = ${p(estado)}`);
    if (Number.isInteger(recolector_numero)) w.push(`recolector_numero = ${p(recolector_numero)}`);
    if (texto) {
      const q = '%' + String(texto).replace(/[\\%_]/g, (m) => '\\' + m) + '%';
      const k = '%' + normClave(texto) + '%';
      w.push(`(clave LIKE ${p(k)} OR remitente ILIKE ${p(q)} OR destinatario ILIKE ${p(q)} OR notas ILIKE ${p(q)})`);
    }
    if (Number.isInteger(min_dias)) w.push(`(${p(hoyISO())}::date - fecha_recepcion) >= ${p(min_dias)}`);
    const lim = Math.min(Math.max(Number(limite) || 30, 1), 80);
    const r = await c.query(`SELECT ${COLS_FOLIO} FROM folios ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY fecha_recepcion ASC, id ASC LIMIT ${lim}`, v);
    const hoy = hoyISO();
    return { total: r.rowCount, folios: r.rows.map((f) => ({ ...f, ...(f.estado === 'pendiente' ? situacion(f.fecha_recepcion, hoy) : {}) })) };
  });
}

export async function resumenFolios() {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const hoy = hoyISO();
    const r = await c.query(`SELECT ${COLS_FOLIO} FROM folios WHERE estado = 'pendiente' ORDER BY fecha_recepcion ASC`);
    const grupos = { decomiso: [], multa: [], hoy_ultimo_dia: [], manana_ultimo_dia: [], atencion: [], ok: [], fecha_futura: [] };
    for (const f of r.rows) {
      const s = situacion(f.fecha_recepcion, hoy);
      (grupos[s.nivel] ||= []).push({ id: f.id, folio: f.folio, fecha_recepcion: f.fecha_recepcion, dias: s.dias_transcurridos, ultimo_dia_sin_multa: s.ultimo_dia_seguro, recolector: f.recolector_numero, destinatario: f.destinatario, veces_enviado: f.veces_enviado });
    }
    const rec = await c.query(`SELECT count(*)::int AS n FROM folios WHERE estado = 'recogido'`);
    return {
      hoy, pendientes: r.rowCount, recogidos: rec.rows[0].n,
      conteo: Object.fromEntries(Object.entries(grupos).map(([k, a]) => [k, a.length])),
      decomiso_60_dias: grupos.decomiso, ya_cumplieron_14_dias: grupos.multa,
      hoy_es_su_ultimo_dia: grupos.hoy_ultimo_dia, manana_es_su_ultimo_dia: grupos.manana_ultimo_dia,
      dias_10_a_11: grupos.atencion, fecha_futura: grupos.fecha_futura,
      con_tiempo: grupos.ok.length,
    };
  });
}

// Para la tarjeta de la pantalla principal.
export async function panel() {
  if (!hayBD()) return { disponible: false };
  const r = await resumenFolios();
  if (r.error) return { disponible: false };
  const pg = await conBasePg((c) => c.query(`SELECT count(*)::int AS n FROM pagos WHERE estado <> 'pagado'`));
  return {
    disponible: true, pendientes: r.pendientes, vencidos: r.conteo.multa + r.conteo.decomiso,
    hoy: r.conteo.hoy_ultimo_dia, manana: r.conteo.manana_ultimo_dia, atencion: r.conteo.atencion,
    pagos_abiertos: pg.rows[0].n,
  };
}

export async function listaFolios({ estado = 'pendiente' } = {}) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const e = estado === 'recogido' ? 'recogido' : 'pendiente';
    const r = await c.query(
      `SELECT ${COLS_FOLIO} FROM folios WHERE estado = $1 ORDER BY ${e === 'pendiente' ? 'fecha_recepcion ASC' : 'fecha_recogido DESC NULLS LAST'}, id DESC LIMIT 300`, [e]);
    const hoy = hoyISO();
    return { folios: r.rows.map((f) => ({ ...f, ...(f.estado === 'pendiente' ? situacion(f.fecha_recepcion, hoy) : {}) })) };
  });
}

/* ------------------------------ pagos ------------------------------ */

const COLS_PAGO = `id::int AS id, cliente, total::float AS total, to_char(semana_de,'YYYY-MM-DD') AS semana_de, to_char(fecha_limite,'YYYY-MM-DD') AS fecha_limite, estado, notas`;

export async function registrarPago({ cliente, total, semana_de, fecha_limite, notas }) {
  if (!hayBD()) return SIN_BD;
  const nombre = t(cliente, 120);
  if (!nombre) return { error: 'Falta el nombre del cliente.' };
  const sem = esFecha(semana_de) ? semana_de : hoyISO();
  const lim = esFecha(fecha_limite) ? fecha_limite : null;
  const tot = total === undefined || total === null || total === '' ? null : Number(total);
  return conBasePg(async (c) => {
    const r = await c.query(
      `INSERT INTO pagos (cliente, total, semana_de, fecha_limite, notas) VALUES ($1,$2,$3,$4,$5) RETURNING ${COLS_PAGO}`,
      [nombre, Number.isFinite(tot) ? tot : null, sem, lim, t(notas, 300)]);
    return { registrado: r.rows[0] };
  });
}

export async function actualizarPago({ id, estado, notas, total, fecha_limite }) {
  if (!hayBD()) return SIN_BD;
  if (!Number.isInteger(id)) return { error: 'Falta el número del pago.' };
  const sets = [], v = [];
  if (estado) {
    if (!['pendiente', 'comprobante_recibido', 'pagado'].includes(estado)) return { error: 'Estado inválido.' };
    v.push(estado); sets.push(`estado = $${v.length}`);
  }
  if (notas !== undefined) { v.push(t(notas, 300)); sets.push(`notas = $${v.length}`); }
  if (total !== undefined && total !== null && Number.isFinite(Number(total))) { v.push(Number(total)); sets.push(`total = $${v.length}`); }
  if (esFecha(fecha_limite)) { v.push(fecha_limite); sets.push(`fecha_limite = $${v.length}`); }
  if (!sets.length) return { error: 'No indicaste qué cambiar.' };
  v.push(id);
  return conBasePg(async (c) => {
    const r = await c.query(`UPDATE pagos SET ${sets.join(', ')}, actualizado_en = now() WHERE id = $${v.length} RETURNING ${COLS_PAGO}`, v);
    return r.rowCount ? { actualizado: r.rows[0] } : { error: 'No existe ese pago.' };
  });
}

export async function listarPagos({ estado, cliente, limite } = {}) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const w = [], v = [];
    if (estado === 'abiertos') w.push(`estado <> 'pagado'`);
    else if (['pendiente', 'comprobante_recibido', 'pagado'].includes(estado)) { v.push(estado); w.push(`estado = $${v.length}`); }
    if (cliente) { v.push('%' + String(cliente).replace(/[\\%_]/g, (m) => '\\' + m) + '%'); w.push(`cliente ILIKE $${v.length}`); }
    const lim = Math.min(Math.max(Number(limite) || 50, 1), 150);
    const r = await c.query(`SELECT ${COLS_PAGO} FROM pagos ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY (estado='pagado'), semana_de DESC, id DESC LIMIT ${lim}`, v);
    return { total: r.rowCount, pagos: r.rows };
  });
}

export async function quitarPago({ id }) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const r = await c.query('DELETE FROM pagos WHERE id = $1 RETURNING cliente', [id]);
    return r.rowCount ? { quitado: r.rows[0].cliente } : { error: 'No existe ese pago.' };
  });
}

/* ------------------------------ plantillas ------------------------------ */

const slug = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

export async function listarPlantillas() {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const r = await c.query(`SELECT id::int AS id, nombre, descripcion, length(contenido)::int AS largo, to_char(actualizado_en AT TIME ZONE 'America/Tijuana','YYYY-MM-DD') AS actualizado FROM plantillas ORDER BY nombre`);
    return { plantillas: r.rows };
  });
}

export async function obtenerPlantilla({ nombre, id }) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    let r;
    if (Number.isInteger(id)) r = await c.query('SELECT id::int AS id, nombre, descripcion, contenido FROM plantillas WHERE id = $1', [id]);
    else {
      const s = slug(nombre);
      r = await c.query(`SELECT id::int AS id, nombre, descripcion, contenido FROM plantillas WHERE nombre = $1 OR nombre LIKE $2 OR descripcion ILIKE $3 ORDER BY (nombre = $1) DESC LIMIT 1`, [s, '%' + s + '%', '%' + String(nombre ?? '').replace(/[\\%_]/g, (m) => '\\' + m) + '%']);
    }
    if (!r.rowCount) {
      const todas = await c.query('SELECT nombre, descripcion FROM plantillas ORDER BY nombre');
      return { error: 'No encontré esa plantilla.', disponibles: todas.rows };
    }
    return r.rows[0];
  });
}

export async function guardarPlantilla({ id, nombre, descripcion, contenido }) {
  if (!hayBD()) return SIN_BD;
  const texto = typeof contenido === 'string' ? contenido.replace(/\r\n/g, '\n').trim().slice(0, 8000) : '';
  if (texto.length < 3) return { error: 'La plantilla está vacía.' };
  if (tieneDatosBancarios(texto)) return { error: 'La plantilla parece traer un número de tarjeta o cuenta. Por seguridad no se guardan datos bancarios: quítelos y adjunte la imagen de pago aparte.' };
  return conBasePg(async (c) => {
    if (Number.isInteger(id)) {
      const r = await c.query(
        `UPDATE plantillas SET contenido_anterior = contenido, contenido = $2, descripcion = COALESCE($3, descripcion), nombre = COALESCE($4, nombre), actualizado_en = now() WHERE id = $1 RETURNING id::int AS id, nombre`,
        [id, texto, t(descripcion, 200), nombre ? slug(nombre) || null : null]);
      return r.rowCount ? { guardada: r.rows[0] } : { error: 'No existe esa plantilla.' };
    }
    const n = slug(nombre);
    if (!n) return { error: 'Falta el nombre de la plantilla.' };
    const r = await c.query(
      `INSERT INTO plantillas (nombre, descripcion, contenido) VALUES ($1,$2,$3)
       ON CONFLICT (nombre) DO UPDATE SET contenido_anterior = plantillas.contenido, contenido = EXCLUDED.contenido,
         descripcion = CASE WHEN EXCLUDED.descripcion = '' THEN plantillas.descripcion ELSE EXCLUDED.descripcion END, actualizado_en = now()
       RETURNING id::int AS id, nombre`, [n, t(descripcion, 200) || '', texto]);
    return { guardada: r.rows[0] };
  });
}

export async function borrarPlantilla({ id }) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const r = await c.query('DELETE FROM plantillas WHERE id = $1 RETURNING nombre', [id]);
    return r.rowCount ? { borrada: r.rows[0].nombre } : { error: 'No existe esa plantilla.' };
  });
}

export async function plantillasCompletas() {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => ({ plantillas: (await c.query(`SELECT id::int AS id, nombre, descripcion, contenido, (contenido_anterior IS NOT NULL) AS tiene_anterior FROM plantillas ORDER BY nombre`)).rows }));
}

/* ------------------------------ recolectores ------------------------------ */

export async function buscarRecolectores({ texto, numero } = {}) {
  if (!hayBD()) return SIN_BD;
  return conBasePg(async (c) => {
    const w = [], v = [];
    if (Number.isInteger(numero)) { v.push(numero); w.push(`numero = $${v.length}`); }
    if (texto) { v.push('%' + String(texto).replace(/[\\%_]/g, (m) => '\\' + m) + '%'); w.push(`(nombre ILIKE $${v.length} OR ciudad ILIKE $${v.length})`); }
    const r = await c.query(`SELECT numero, nombre, ciudad, tipo, activo FROM recolectores ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY tipo, numero NULLS FIRST`, v);
    return { recolectores: r.rows };
  });
}

export async function guardarRecolector({ numero, nombre, ciudad, tipo, activo }) {
  if (!hayBD()) return SIN_BD;
  const n = t(nombre, 100);
  if (!n) return { error: 'Falta el nombre.' };
  const num = Number.isInteger(numero) ? numero : null;
  const tp = tipo === 'directo' ? 'directo' : 'foraneo';
  return conBasePg(async (c) => {
    const r = num === null
      ? await c.query(`INSERT INTO recolectores (nombre, ciudad, tipo) VALUES ($1,$2,$3) RETURNING numero, nombre, ciudad, tipo, activo`, [n, t(ciudad, 100) || '', tp])
      : await c.query(
          `INSERT INTO recolectores (numero, nombre, ciudad, tipo, activo) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (numero) DO UPDATE SET nombre = EXCLUDED.nombre, ciudad = CASE WHEN EXCLUDED.ciudad = '' THEN recolectores.ciudad ELSE EXCLUDED.ciudad END,
             tipo = EXCLUDED.tipo, activo = EXCLUDED.activo, actualizado_en = now() RETURNING numero, nombre, ciudad, tipo, activo`,
          [num, n, t(ciudad, 100) || '', tp, activo === false ? false : true]);
    return { guardado: r.rows[0] };
  });
}
