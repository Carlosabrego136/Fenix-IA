// Consultas de SOLO LECTURA a envios_ayora (la base del sistema QR). La IA no escribe SQL: solo puede
// usar estas consultas fijas. Cada una corre en una transacción READ ONLY que siempre se revierte.
// Nunca se leen las columnas de fotos (foto, ine_foto, foto_credencial) para no traer base64 pesado.
import { soloLectura, configurada } from './db.js';
import { demoDatos } from './demo-data.js';
import { cfg } from './config.js';

const clamp = (n, min, max, def) => {
  const v = Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : def;
  return Math.min(max, Math.max(min, v));
};
const esc = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);
// Búsqueda tolerante a mayúsculas, acentos y faltas comunes (b/v, s/z/c, y/i, h muda, qu/k, letras dobles).
// Ej.: "Express" = "Expres", "Aracely" = "Araceli", "Hernandes" = "Hernández".
// plano() (JS) y sqlPlano() (SQL) deben hacer exactamente la misma transformación.
const plano = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/qu/g, 'k').replace(/c(?=[ei])/g, 's')
  .replace(/[czvyh]/g, (m) => ({ c: 'k', z: 's', v: 'b', y: 'i', h: '' })[m])
  .replace(/(.)\1/g, '$1');
const sqlPlano = (col) => `regexp_replace(translate(regexp_replace(regexp_replace(translate(lower(${col}), 'áéíóúüñ', 'aeiouun'), 'qu', 'k', 'g'), 'c(?=[ei])', 's', 'g'), 'czvyh', 'ksbi'), '(.)\\1', '\\1', 'g')`;
const ESTADOS = ['recibido', 'en_transito', 'listo_entrega', 'entregado'];

function local(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg().tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(dt).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
const dias = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);
const soloFecha = (d) => (d ? local(d).slice(0, 10) : null);
const R = () => configurada('lectura');

/* ----------------------------- resumen ----------------------------- */
export async function resumenPaquetes() {
  if (!R()) {
    const { paquetes } = demoDatos();
    const por = {};
    for (const p of paquetes) {
      por[p.estado] ||= { estado: p.estado, paquetes: 0, sin_guia: 0 };
      por[p.estado].paquetes++;
      if (!p.guia) por[p.estado].sin_guia++;
    }
    const fechas = paquetes.map((p) => p.capturado_en.getTime());
    return {
      total: paquetes.length,
      por_estado: Object.values(por).sort((a, b) => b.paquetes - a.paquetes),
      mas_antiguo: local(new Date(Math.min(...fechas))),
      mas_reciente: local(new Date(Math.max(...fechas))),
    };
  }
  return soloLectura('lectura', async (c) => {
    const a = await c.query(
      `SELECT estado, count(*)::int AS paquetes,
              count(*) FILTER (WHERE numero_guia IS NULL OR btrim(numero_guia) = '')::int AS sin_guia
       FROM paquetes GROUP BY estado ORDER BY paquetes DESC`
    );
    const b = await c.query('SELECT count(*)::int AS total, min(capturado_en) AS mas_antiguo, max(capturado_en) AS mas_reciente FROM paquetes');
    return {
      total: b.rows[0].total,
      por_estado: a.rows,
      mas_antiguo: local(b.rows[0].mas_antiguo),
      mas_reciente: local(b.rows[0].mas_reciente),
    };
  });
}

/* ----------------------------- paquetes ----------------------------- */
export async function buscarPaquetes(f = {}) {
  const limite = clamp(f.limite, 1, 60, 25);
  const estados = (Array.isArray(f.estados) ? f.estados : []).filter((e) => ESTADOS.includes(e));
  if (!R()) return buscarPaquetesDemo({ ...f, estados, limite });
  const params = [];
  const p = (v) => (params.push(v), `$${params.length}`);
  const w = [];
  if (estados.length) w.push(`b.estado = ANY(${p(estados)}::text[])`);
  if (f.bloque) w.push(`b.bloque = ${p(String(f.bloque))}`);
  if (f.cliente) w.push(`${sqlPlano('b.cliente')} ILIKE ${p('%' + esc(plano(f.cliente)) + '%')}`);
  if (f.vendedor) {
    const v = p('%' + esc(plano(f.vendedor)) + '%');
    w.push(`(${sqlPlano('b.vendedor')} ILIKE ${v} OR ${sqlPlano('b.vendedor_alias')} ILIKE ${v})`);
  }
  if (f.guia) w.push(`b.guia ILIKE ${p('%' + esc(f.guia) + '%')}`);
  if (f.paqueteria) w.push(`${sqlPlano('b.paqueteria')} ILIKE ${p('%' + esc(plano(f.paqueteria)) + '%')}`);
  if (f.con_guia === true) w.push('b.guia IS NOT NULL');
  if (f.con_guia === false) w.push('b.guia IS NULL');
  if (f.desde) w.push(`b.capturado_en >= ${p(String(f.desde))}::date`);
  if (f.hasta) w.push(`b.capturado_en < (${p(String(f.hasta))}::date + 1)`);
  if (f.min_dias_en_estado != null) w.push(`b.en_estado_desde <= now() - (${p(clamp(f.min_dias_en_estado, 0, 3650, 0))}::int * interval '1 day')`);
  const orden = f.orden === 'mas_tiempo_en_estado' ? 'en_estado_desde ASC' : 'capturado_en DESC';
  const sql = `
    WITH b AS (
      SELECT p.id, p.estado, NULLIF(btrim(p.numero_guia), '') AS guia, pq.nombre AS paqueteria,
             c.nombre AS cliente, c.telefono AS tel_cliente, v.nombre AS vendedor, v.alias AS vendedor_alias,
             cat.clave AS bloque, left(p.notas, 200) AS notas, p.capturado_en,
             COALESCE((SELECT max(h.creado_en) FROM estado_historial h WHERE h.paquete_id = p.id AND h.estado = p.estado), p.capturado_en) AS en_estado_desde
      FROM paquetes p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN vendedores v ON v.id = p.vendedor_id
      LEFT JOIN paqueterias pq ON pq.id = p.paqueteria_id
      LEFT JOIN categorias cat ON cat.id = p.categoria_id
    )
    SELECT left(b.id::text, 8) AS id, b.estado, b.guia, b.paqueteria, b.cliente, b.tel_cliente, b.vendedor, b.vendedor_alias,
           b.bloque, b.notas, b.capturado_en, b.en_estado_desde,
           floor(extract(epoch FROM (now() - b.en_estado_desde)) / 86400)::int AS dias_en_estado,
           count(*) OVER ()::int AS total
    FROM b ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
    ORDER BY ${orden} LIMIT ${limite}`;
  return soloLectura('lectura', async (c) => {
    const r = await c.query(sql, params);
    return {
      total_encontrados: r.rows[0]?.total ?? 0,
      mostrando: r.rows.length,
      paquetes: r.rows.map(({ total, capturado_en, en_estado_desde, ...x }) => ({
        ...x,
        capturado_en: local(capturado_en),
        en_estado_desde: local(en_estado_desde),
      })),
    };
  });
}

function buscarPaquetesDemo(f) {
  const d = demoDatos();
  const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c]));
  const ven = Object.fromEntries(d.vendedores.map((v) => [v.id, v]));
  const inc = (a, b) => plano(a).includes(plano(b));
  let rows = d.paquetes.map((p) => ({
    id: p.id, estado: p.estado, guia: p.guia, paqueteria: p.paqueteria, cliente: cli[p.cliente]?.nombre ?? null,
    tel_cliente: cli[p.cliente]?.telefono || null, vendedor: ven[p.vendedor]?.nombre ?? null, vendedor_alias: ven[p.vendedor]?.alias ?? null,
    bloque: cli[p.cliente]?.bloque ?? null, notas: p.notas || null, _capt: p.capturado_en, _desde: p.en_estado_desde,
  }));
  if (f.estados.length) rows = rows.filter((r) => f.estados.includes(r.estado));
  if (f.bloque) rows = rows.filter((r) => r.bloque === String(f.bloque));
  if (f.cliente) rows = rows.filter((r) => inc(r.cliente, f.cliente));
  if (f.vendedor) rows = rows.filter((r) => inc(r.vendedor, f.vendedor) || inc(r.vendedor_alias, f.vendedor));
  if (f.guia) rows = rows.filter((r) => inc(r.guia, f.guia));
  if (f.paqueteria) rows = rows.filter((r) => inc(r.paqueteria, f.paqueteria));
  if (f.con_guia === true) rows = rows.filter((r) => r.guia);
  if (f.con_guia === false) rows = rows.filter((r) => !r.guia);
  if (f.min_dias_en_estado != null) rows = rows.filter((r) => dias(r._desde) >= f.min_dias_en_estado);
  rows.sort(f.orden === 'mas_tiempo_en_estado' ? (a, b) => a._desde - b._desde : (a, b) => b._capt - a._capt);
  return {
    total_encontrados: rows.length,
    mostrando: Math.min(rows.length, f.limite),
    paquetes: rows.slice(0, f.limite).map(({ _capt, _desde, ...x }) => ({ ...x, capturado_en: local(_capt), en_estado_desde: local(_desde), dias_en_estado: dias(_desde) })),
  };
}

/* ----------------------------- guías repetidas ----------------------------- */
export async function guiasRepetidas() {
  if (!R()) {
    const d = demoDatos();
    const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c.nombre]));
    const por = {};
    for (const p of d.paquetes.filter((x) => x.guia)) (por[p.guia] ||= []).push(p);
    return {
      guias: Object.entries(por).filter(([, v]) => v.length > 1).map(([guia, v]) => ({
        guia, veces: v.length, clientes_distintos: new Set(v.map((x) => x.cliente)).size,
        paqueterias_distintas: new Set(v.map((x) => x.paqueteria)).size, clientes: [...new Set(v.map((x) => cli[x.cliente]))],
      })),
    };
  }
  return soloLectura('lectura', async (c) => {
    const r = await c.query(
      `SELECT btrim(p.numero_guia) AS guia, count(*)::int AS veces,
              count(DISTINCT p.cliente_id)::int AS clientes_distintos,
              count(DISTINCT p.paqueteria_id)::int AS paqueterias_distintas,
              (array_agg(DISTINCT c.nombre))[1:8] AS clientes
       FROM paquetes p LEFT JOIN clientes c ON c.id = p.cliente_id
       WHERE p.numero_guia IS NOT NULL AND btrim(p.numero_guia) <> ''
       GROUP BY btrim(p.numero_guia) HAVING count(*) > 1
       ORDER BY veces DESC, guia LIMIT 40`
    );
    return { guias: r.rows };
  });
}

/* ----------------------------- clientes ----------------------------- */
export async function buscarClientes(f = {}) {
  const limite = clamp(f.limite, 1, 50, 20);
  if (!R()) {
    const d = demoDatos();
    const inc = (a, b) => String(a || '').toLowerCase().includes(String(b).toLowerCase());
    let rows = d.clientes.map((c) => {
      const mios = d.paquetes.filter((p) => p.cliente === c.id);
      const por = {};
      for (const p of mios) por[p.estado] = (por[p.estado] || 0) + 1;
      return { id: c.id, nombre: c.nombre, telefono: c.telefono || null, bloque: c.bloque, activo: c.activo, paquetes_por_estado: por, _activos: mios.filter((p) => p.estado !== 'entregado').length };
    });
    if (f.texto) rows = rows.filter((r) => inc(r.nombre, f.texto) || String(r.telefono || '').includes(String(f.texto)));
    if (f.sin_telefono) rows = rows.filter((r) => !r.telefono);
    if (f.con_paquetes_activos) rows = rows.filter((r) => r._activos > 0);
    return { total_encontrados: rows.length, clientes: rows.slice(0, limite).map(({ _activos, ...x }) => x) };
  }
  const params = [];
  const p = (v) => (params.push(v), `$${params.length}`);
  const w = [];
  if (f.texto) {
    const t = p('%' + esc(f.texto) + '%');
    const tn = p('%' + esc(plano(f.texto)) + '%');
    w.push(`(${sqlPlano('c.nombre')} ILIKE ${tn} OR c.telefono ILIKE ${t})`);
  }
  if (f.sin_telefono) w.push("(c.telefono IS NULL OR btrim(c.telefono) = '')");
  if (f.con_paquetes_activos) w.push("EXISTS (SELECT 1 FROM paquetes q WHERE q.cliente_id = c.id AND q.estado <> 'entregado')");
  const sql = `
    SELECT left(c.id::text, 8) AS id, c.nombre, NULLIF(btrim(c.telefono), '') AS telefono, cat.clave AS bloque, c.activo,
           COALESCE((SELECT json_object_agg(e.estado, e.n) FROM (SELECT estado, count(*)::int AS n FROM paquetes WHERE cliente_id = c.id GROUP BY estado) e), '{}'::json) AS paquetes_por_estado,
           count(*) OVER ()::int AS total
    FROM clientes c LEFT JOIN categorias cat ON cat.id = c.categoria_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
    ORDER BY c.nombre LIMIT ${limite}`;
  return soloLectura('lectura', async (c) => {
    const r = await c.query(sql, params);
    return { total_encontrados: r.rows[0]?.total ?? 0, clientes: r.rows.map(({ total, ...x }) => x) };
  });
}

/* ----------------------------- vendedores ----------------------------- */
export async function buscarVendedores(f = {}) {
  const limite = clamp(f.limite, 1, 60, 25);
  if (!R()) {
    const d = demoDatos();
    const hoy = new Date();
    const inc = (a, b) => String(a || '').toLowerCase().includes(String(b).toLowerCase());
    let rows = d.vendedores.map((v) => ({
      id: v.id, registro: v.registro, nombre: v.nombre, alias: v.alias, bloque: v.bloque, estatus: v.estatus, activo: v.activo,
      telefono: v.telefono || null, ingreso: v.ingreso, vence: v.vence,
      dias_para_vencer: Math.ceil((new Date(v.vence + 'T00:00:00') - hoy) / 86400000), sin_foto_credencial: v.sin_foto_credencial,
    }));
    if (f.texto) rows = rows.filter((r) => inc(r.nombre, f.texto) || inc(r.alias, f.texto));
    if (f.estatus) rows = rows.filter((r) => r.estatus === f.estatus);
    if (f.vence_en_dias != null) rows = rows.filter((r) => r.dias_para_vencer <= f.vence_en_dias);
    if (f.sin_foto_credencial) rows = rows.filter((r) => r.sin_foto_credencial);
    return { total_encontrados: rows.length, vendedores: rows.slice(0, limite) };
  }
  const params = [cfg().tz];
  const p = (v) => (params.push(v), `$${params.length}`);
  const w = [];
  if (f.texto) {
    const t = p('%' + esc(plano(f.texto)) + '%');
    w.push(`(${sqlPlano('v.nombre')} ILIKE ${t} OR ${sqlPlano('v.alias')} ILIKE ${t})`);
  }
  if (f.estatus) w.push(`v.estatus = ${p(String(f.estatus))}`);
  if (f.vence_en_dias != null) w.push(`(v.fecha_vencimiento::date - (now() AT TIME ZONE $1)::date) <= ${p(clamp(f.vence_en_dias, -3650, 3650, 30))}::int`);
  if (f.sin_foto_credencial) w.push("length(COALESCE(v.foto_credencial, '')) = 0");
  const sql = `
    SELECT left(v.id::text, 8) AS id, v.numero_registro AS registro, v.nombre, v.alias, cat.clave AS bloque, v.estatus, v.activo,
           NULLIF(btrim(v.telefono), '') AS telefono, to_char(v.fecha_ingreso::date, 'YYYY-MM-DD') AS ingreso,
           to_char(v.fecha_vencimiento::date, 'YYYY-MM-DD') AS vence,
           (v.fecha_vencimiento::date - (now() AT TIME ZONE $1)::date)::int AS dias_para_vencer,
           (length(COALESCE(v.foto_credencial, '')) = 0) AS sin_foto_credencial,
           count(*) OVER ()::int AS total
    FROM vendedores v LEFT JOIN categorias cat ON cat.id = v.categoria_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
    ORDER BY v.numero_registro LIMIT ${limite}`;
  return soloLectura('lectura', async (c) => {
    const r = await c.query(sql, params);
    return { total_encontrados: r.rows[0]?.total ?? 0, vendedores: r.rows.map(({ total, ...x }) => x) };
  });
}

/* ----------------------------- historial de un paquete ----------------------------- */
export async function historialPaquete({ id }) {
  const pref = String(id || '').trim().toLowerCase();
  if (!/^[0-9a-z-]{4,36}$/.test(pref)) return { error: 'Identificador inválido. Use el id que devolvió buscar_paquetes.' };
  if (!R()) {
    const d = demoDatos();
    const p = d.paquetes.find((x) => x.id.startsWith(pref));
    if (!p) return { error: 'No encontré ese paquete.' };
    return {
      paquete: { id: p.id, estado: p.estado, guia: p.guia, paqueteria: p.paqueteria, capturado_en: local(p.capturado_en) },
      historial: d.historial[p.id].map((h) => ({ estado: h.estado, fecha: local(h.creado_en) })),
      notificaciones: d.notificaciones.filter((n) => n.paquete === p.id).map((n) => ({ estado_envio: n.estado_envio, error: n.error, enviado_en: local(n.enviado_en) })),
    };
  }
  return soloLectura('lectura', async (c) => {
    const f = await c.query(
      `SELECT p.id, left(p.id::text, 8) AS corto, p.estado, NULLIF(btrim(p.numero_guia), '') AS guia, pq.nombre AS paqueteria,
              cl.nombre AS cliente, v.nombre AS vendedor, left(p.notas, 200) AS notas, p.capturado_en
       FROM paquetes p LEFT JOIN paqueterias pq ON pq.id = p.paqueteria_id LEFT JOIN clientes cl ON cl.id = p.cliente_id
       LEFT JOIN vendedores v ON v.id = p.vendedor_id
       WHERE p.id::text LIKE $1 LIMIT 2`,
      [esc(pref) + '%']
    );
    if (!f.rowCount) return { error: 'No encontré ese paquete.' };
    if (f.rowCount > 1) return { error: 'Ese identificador coincide con más de un paquete; use más caracteres.' };
    const { id: full, corto, capturado_en, ...resto } = f.rows[0];
    const h = await c.query('SELECT estado, creado_en FROM estado_historial WHERE paquete_id = $1 ORDER BY creado_en', [full]);
    const n = await c.query(
      `SELECT estado_envio, left(error_detalle, 160) AS error, enviado_en FROM notificaciones
       WHERE paquete_id = $1 ORDER BY enviado_en DESC NULLS FIRST LIMIT 10`,
      [full]
    );
    return {
      paquete: { id: corto, ...resto, capturado_en: local(capturado_en) },
      historial: h.rows.map((x) => ({ estado: x.estado, fecha: local(x.creado_en) })),
      notificaciones: n.rows.map((x) => ({ ...x, enviado_en: local(x.enviado_en) })),
    };
  });
}

/* ----------------------------- avisos de WhatsApp ----------------------------- */
export async function notificacionesWhatsapp(f = {}) {
  const limite = clamp(f.limite, 1, 50, 20);
  const estado = ['pendiente', 'enviado', 'error'].includes(f.estado_envio) ? f.estado_envio : null;
  if (!R()) {
    const d = demoDatos();
    const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c]));
    let rows = d.notificaciones.map((n) => {
      const p = d.paquetes.find((x) => x.id === n.paquete);
      return { paquete: n.paquete, cliente: cli[p.cliente]?.nombre, telefono: cli[p.cliente]?.telefono || null, estado_envio: n.estado_envio, error: n.error, enviado_en: local(n.enviado_en) };
    });
    if (estado) rows = rows.filter((r) => r.estado_envio === estado);
    return { total_encontrados: rows.length, notificaciones: rows.slice(0, limite) };
  }
  return soloLectura('lectura', async (c) => {
    const r = await c.query(
      `SELECT left(n.paquete_id::text, 8) AS paquete, cl.nombre AS cliente, NULLIF(btrim(n.telefono_destino), '') AS telefono,
              n.estado_envio, left(n.error_detalle, 160) AS error, n.enviado_en, count(*) OVER ()::int AS total
       FROM notificaciones n LEFT JOIN paquetes p ON p.id = n.paquete_id LEFT JOIN clientes cl ON cl.id = p.cliente_id
       WHERE ($1::text IS NULL OR n.estado_envio = $1)
       ORDER BY n.enviado_en DESC NULLS FIRST LIMIT ${limite}`,
      [estado]
    );
    return {
      total_encontrados: r.rows[0]?.total ?? 0,
      notificaciones: r.rows.map(({ total, enviado_en, ...x }) => ({ ...x, enviado_en: local(enviado_en) })),
    };
  });
}

/* ----------------------------- verificación (para scripts) ----------------------------- */
export async function verificarLectura() {
  const pruebas = [
    ['resumen_paquetes', () => resumenPaquetes()],
    ['buscar_paquetes', () => buscarPaquetes({ limite: 3 })],
    ['buscar_paquetes (filtros)', () => buscarPaquetes({ estados: ['listo_entrega'], min_dias_en_estado: 1, con_guia: true, desde: '2020-01-01', limite: 3 })],
    ['guias_repetidas', () => guiasRepetidas()],
    ['buscar_clientes', () => buscarClientes({ limite: 3 })],
    ['buscar_clientes (filtros)', () => buscarClientes({ sin_telefono: true, con_paquetes_activos: true, limite: 3 })],
    ['buscar_vendedores', () => buscarVendedores({ limite: 3 })],
    ['buscar_vendedores (filtros)', () => buscarVendedores({ vence_en_dias: 30, sin_foto_credencial: true, limite: 3 })],
    ['notificaciones_whatsapp', () => notificacionesWhatsapp({ limite: 3 })],
  ];
  const salida = [];
  let primerPaquete = null;
  for (const [nombre, fn] of pruebas) {
    try {
      const r = await fn();
      if (nombre === 'buscar_paquetes') primerPaquete = r.paquetes?.[0]?.id;
      salida.push({ nombre, ok: true });
    } catch (e) {
      salida.push({ nombre, ok: false, error: `${e.code || ''} ${e.message}`.trim() });
    }
  }
  if (primerPaquete) {
    try {
      await historialPaquete({ id: primerPaquete });
      salida.push({ nombre: 'historial_paquete', ok: true });
    } catch (e) {
      salida.push({ nombre: 'historial_paquete', ok: false, error: `${e.code || ''} ${e.message}`.trim() });
    }
  }
  return salida;
}
