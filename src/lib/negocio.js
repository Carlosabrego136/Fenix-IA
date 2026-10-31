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
  else if (dias >= DIA_MULTA) { nivel = 'multa'; texto = `lleva ${dias} días: ya le corresponde la multa fija de $50 (cubre el almacenamiento del día 14 al 59); decomiso a los 60 (faltan ${DIA_DECOMISO - dias})`; }
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
    peso_facturable_kg: Math.max(5, Math.ceil(Math.round(mayor * 100) / 100 / 5) * 5),
    formula: 'largo x ancho x alto / 5000; se factura el mayor entre peso real y volumétrico, por bloques de 5 kg',
    aviso: 'Los cobros son por bloques de 5 kg (27.4 kg se factura como 30 kg). Los precios salen de sus tarifas/tabulador: si no los tienes, no los inventes; déjalos en blanco o pídeselos.',
  };
}

/* ------------------------------ cotizador (tabulador 2026 de la dueña) ------------------------------ */

// Mismo tabulador que su cotizador (pages/admin/cotizador.js del sistema de Ensenada).
// Si ella cambia precios, se actualiza aquí.
export const TABULADOR = [
  { kg: 1, aereo: 950, terrestre: 875, bajapack: 600 },
  { kg: 5, aereo: 1000, terrestre: 900, bajapack: 650 },
  { kg: 10, aereo: 1400, terrestre: 1050, bajapack: 850 },
  { kg: 15, aereo: 1550, terrestre: 1250, bajapack: 1000 },
  { kg: 20, aereo: 1700, terrestre: 1450, bajapack: 1200 },
  { kg: 25, aereo: 2000, terrestre: 1650, bajapack: 1500 },
  { kg: 30, aereo: 2300, terrestre: 1850, bajapack: 1650 },
  { kg: 35, aereo: 2600, terrestre: 2000, bajapack: 1800 },
  { kg: 40, aereo: 2800, terrestre: 2150, bajapack: 2100 },
  { kg: 45, aereo: 3100, terrestre: 2300, bajapack: 2250 },
  { kg: 50, aereo: 3350, terrestre: 2450, bajapack: 2350 },
  { kg: 55, aereo: 3650, terrestre: 2700, bajapack: 2450 },
  { kg: 60, aereo: 3900, terrestre: 2900, bajapack: 2600 },
];
export const CARGO_ZONA_EXTENDIDA = 280;
const ORDINALES = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'];
const moneda = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };

export function cotizar({ cliente, cajas, zona_extendida = false, incluir_bajapack = false }) {
  const lista = (Array.isArray(cajas) ? cajas : []).slice(0, 8);
  if (!lista.length) return { error: 'Faltan las cajas (peso real y/o medidas).' };
  const detalle = [];
  for (const [i, c] of lista.entries()) {
    const real = num(c?.peso_real_kg), l = num(c?.largo_cm), a = num(c?.ancho_cm), h = num(c?.alto_cm);
    const medidas = l && a && h;
    if (!real && !medidas) return { error: `La caja ${i + 1} necesita peso real o las tres medidas.` };
    if (l > 1000 || a > 1000 || h > 1000 || real > 5000) return { error: `Las medidas de la caja ${i + 1} no parecen correctas.` };
    const vol = medidas ? (l * a * h) / 5000 : 0;
    const facturable = Math.max(real, vol);
    const tier = TABULADOR.find((t) => facturable <= t.kg + 1e-9) || null;
    detalle.push({ indice: i, real, vol, facturable, tier, l, a, h, medidas });
  }
  const ok = detalle.filter((d) => d.tier);
  const extra = zona_extendida ? CARGO_ZONA_EXTENDIDA : 0;
  const total = (k) => ok.reduce((n, d) => n + d.tier[k], 0) + extra;
  const totales = { aereo: total('aereo'), terrestre: total('terrestre'), bajapack: total('bajapack') };
  const multi = detalle.length > 1;

  let t = `Hola${cliente ? ' ' + cliente : ''}, que tal.. te dejo cotización de envío.\n\n`;
  for (const d of detalle) {
    t += `${multi ? `${ORDINALES[d.indice]}. caja` : '1 caja'} · Peso real ${d.real || 0} kg\n`;
    if (d.medidas) t += `Medidas: ${d.l}x${d.a}x${d.h} cm · Vol. ${d.vol.toFixed(1)} kg\n`;
    t += `Peso facturable: ${d.tier ? d.tier.kg : d.facturable.toFixed(1)} kg\n`;
    if (!d.tier) t += '⚠️ Esta caja supera los 60 kg del tabulador, necesita cotización especial.\n';
    else if (multi) {
      t += `Aéreo: ${moneda(d.tier.aereo)}  ·  Terrestre: ${moneda(d.tier.terrestre)}`;
      if (incluir_bajapack) t += `  ·  Baja Pack Express: ${moneda(d.tier.bajapack)}`;
      t += '\n';
    }
    t += '\n';
  }
  t += multi ? `Total aéreo: ${moneda(totales.aereo)}\nTotal terrestre: ${moneda(totales.terrestre)}\n` : `Aéreo: ${moneda(totales.aereo)}\nTerrestre: ${moneda(totales.terrestre)}\n`;
  if (incluir_bajapack) t += multi ? `Total Baja Pack Express: ${moneda(totales.bajapack)}\n` : `Baja Pack Express: ${moneda(totales.bajapack)}\n`;
  if (zona_extendida) t += `\n(Incluye cargo de zona extendida de ${moneda(CARGO_ZONA_EXTENDIDA)})\n`;
  t += '\nEl pago debe quedar a más tardar el día miércoles para que tu envío salga en la misma semana.\n\nPago:\nDomingo sale lunes\nLunes sale martes\nMartes sale miércoles\nMiércoles sale jueves\n\n' +
    'Tu cotización ya incluye la boleta mínima de aduana para que tu caja pueda salir a destino. Sin embargo, todos los envíos terrestres son susceptibles de ser revisados en la aduana y que el agente aduanal determine pagos de impuestos adicionales; estos corren totalmente por tu cuenta y se deben pagar de manera inmediata para que tu caja siga su curso.\n\nAdjunto la imagen de la cuenta y política de envío.';

  return {
    cajas: detalle.map((d) => ({ caja: d.indice + 1, peso_real_kg: d.real, peso_volumetrico_kg: Math.round(d.vol * 10) / 10, peso_mayor_kg: Math.round(d.facturable * 10) / 10, escalon_kg: d.tier?.kg ?? null, aereo: d.tier?.aereo ?? null, terrestre: d.tier?.terrestre ?? null, baja_pack: d.tier?.bajapack ?? null, ...(d.tier ? {} : { nota: 'Supera 60 kg: cotización especial a mano.' }) })),
    totales: { aereo: totales.aereo, terrestre: totales.terrestre, ...(incluir_bajapack ? { baja_pack: totales.bajapack } : {}) },
    zona_extendida: Boolean(zona_extendida), incluye_baja_pack: Boolean(incluir_bajapack),
    ...(detalle.some((d) => !d.tier) ? { aviso: 'Alguna caja supera 60 kg: el total no la incluye y debe cotizarla ella a mano.' } : {}),
    mensaje: t,
    instruccion: 'Entrega el campo "mensaje" tal cual en un bloque para copiar. Recuérdale adjuntar ella misma la imagen de datos de pago y la de políticas de almacenaje.',
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
  const rec = x?.recolector_numero === null || x?.recolector_numero === undefined || x?.recolector_numero === '' ? null : Number(x.recolector_numero);
  if (rec !== null && !(Number.isInteger(rec) && rec >= 1 && rec <= 99)) e.push('número de recolector inválido');
  const reg = {
    folio, clave, fecha_recepcion: fecha,
    sucursal_origen: t(x?.sucursal_origen), sucursal_destino: t(x?.sucursal_destino),
    remitente: t(x?.remitente, 200), destinatario: t(x?.destinatario, 200), tamano: t(x?.tamano, 40),
    precio: precio !== null && Number.isFinite(precio) ? precio : null, notas: t(x?.notas, 300),
  };
  Object.assign(reg, clasificar(reg.remitente, reg.destinatario, reg.notas));
  if (rec !== null && Number.isInteger(rec) && reg.clasificacion !== 'foraneo') { reg.recolector_numero = rec; reg.clasificacion = 'foraneo'; }
  return { reg, errores: e };
}

const plano = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Si la etiqueta no vino, busca el nombre de un recolector en remitente/destinatario/notas. Solo SUGIERE.
export function sugerirRecolectores(reg, recolectores) {
  if (reg.recolector_numero) return [];
  const t = ` ${plano([reg.remitente, reg.destinatario, reg.notas].filter(Boolean).join(' | ')).replace(/[^a-z0-9]+/g, ' ')} `;
  return recolectores
    .filter((r) => r.tipo === 'foraneo' && r.numero)
    .filter((r) => plano(r.nombre).split(/\s+/).filter((w) => w.length >= 4).some((w) => t.includes(` ${w} `)))
    .map((r) => ({ numero: r.numero, nombre: r.nombre, ciudad: r.ciudad }));
}

export async function proponerFolios({ turno, folios }) {
  if (!hayBD()) return SIN_BD;
  const lista = (Array.isArray(folios) ? folios : []).slice(0, 60);
  if (!lista.length) return { error: 'No me pasaste ningún folio.' };
  return conBasePg(async (c) => {
    const hoy = hoyISO();
    const vistos = new Map();
    const recs = (await c.query(`SELECT numero, nombre, ciudad, tipo FROM recolectores WHERE activo`)).rows;
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
      const posibles = sugerirRecolectores(reg, recs);
      nuevos.push({ ...reg, ...situacion(reg.fecha_recepcion, hoy), ...(posibles.length ? { posible_recolector: posibles, aviso_recolector: 'Sugerencia por nombre, NO confirmada: pregúntale a la dueña antes de asignarlo.' } : {}) });
    }
    await c.query('DELETE FROM propuestas_folios');
    if (nuevos.length || repetidos.some((r) => r.clave)) {
      await c.query('INSERT INTO propuestas_folios (turno, datos) VALUES ($1, $2)', [turno, JSON.stringify({ nuevos, repetidos: repetidos.filter((r) => r.clave).map((r) => r.clave) })]);
    }
    return {
      pendiente_de_confirmacion: true,
      nuevos, repetidos, invalidos,
      instruccion: 'NO se ha guardado nada todavía. Si algún folio trae posible_recolector, es solo una sugerencia: pregúntale si es ese; si lo confirma, vuelve a proponer con recolector_numero. Muéstrale a la dueña la lista (folio, fecha de recepción, días, último día sin multa, recolector si lo hay), marca los dudosos y los repetidos, y pídele que confirme. Solo si responde que sí en su SIGUIENTE mensaje, llama a confirmar_folios.',
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
    const nombres = new Map((await c.query('SELECT numero, nombre, ciudad FROM recolectores WHERE numero IS NOT NULL')).rows.map((x) => [x.numero, x]));
    const porRec = new Map();
    for (const f of r.rows) {
      const s2 = situacion(f.fecha_recepcion, hoy);
      if (s2.dias_transcurridos < 10) continue;
      const k = f.recolector_numero ?? 0;
      if (!porRec.has(k)) porRec.set(k, { numero: k || null, recolector: k ? `${nombres.get(k)?.nombre ?? '?'} (${nombres.get(k)?.ciudad ?? ''})` : 'Sin recolector asignado / cliente directo', folios: [] });
      porRec.get(k).folios.push({ folio: f.folio, dias: s2.dias_transcurridos, nivel: s2.nivel, ultimo_dia_sin_multa: s2.ultimo_dia_seguro });
    }
    return {
      hoy, pendientes: r.rowCount, recogidos: rec.rows[0].n,
      conteo: Object.fromEntries(Object.entries(grupos).map(([k, a]) => [k, a.length])),
      decomiso_60_dias: grupos.decomiso, ya_cumplieron_14_dias: grupos.multa,
      hoy_es_su_ultimo_dia: grupos.hoy_ultimo_dia, manana_es_su_ultimo_dia: grupos.manana_ultimo_dia,
      dias_10_a_11: grupos.atencion, fecha_futura: grupos.fecha_futura,
      con_tiempo: grupos.ok.length,
      por_recolector_con_10_dias_o_mas: [...porRec.values()],
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
