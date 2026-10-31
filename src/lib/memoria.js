// Memoria de la IA: chats, mensajes, recuerdos de largo plazo y uso diario.
// Con DATABASE_URL_MEMORIA usa Aiven (permanente). Sin ella usa memoria local del proceso (solo para
// demostración o desarrollo: se pierde al reiniciar).
import { sesion, transaccion, configurada } from './db.js';
import { ESQUEMA_SQL } from './schema.js';

export const MAX_RECUERDOS = 300;
export const CATEGORIAS = ['definicion', 'regla', 'preferencia', 'persona', 'dato'];
const VENTANA_MENSAJES = 40;

export function tituloDe(texto) {
  const t = String(texto).split('\n')[0].replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 47).trimEnd() + '…' : t || 'Nuevo chat';
}
const normCategoria = (c) => (CATEGORIAS.includes(c) ? c : 'dato');
const escLike = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);

/* ========================= Backend Postgres (Aiven) ========================= */

let esquemaListo = false;
async function asegurarEsquema(c) {
  if (esquemaListo) return;
  await c.query('BEGIN');
  try {
    await c.query('SELECT pg_advisory_xact_lock(727401)');
    await c.query(ESQUEMA_SQL);
    await c.query('COMMIT');
    esquemaListo = true;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {}
    throw e;
  }
}
const M = (fn) =>
  sesion('memoria', async (c) => {
    await asegurarEsquema(c);
    return fn(c);
  });

// Para los módulos de negocio que viven en la misma base: ejecuta fn(cliente) con el esquema ya creado.
export const conBasePg = M;
// Igual pero dentro de una transacción (BEGIN/COMMIT); el esquema se asegura antes.
export async function conTransaccionPg(fn) {
  await M(async () => {});
  return transaccion('memoria', fn);
}

export async function prepararEsquema() {
  if (!configurada('memoria')) return false;
  await M(async () => {});
  return true;
}

const pgB = {
  async iniciarTurno({ chatId, texto, limite, dia }) {
    return M(async (c) => {
      const uso = await c.query(
        `INSERT INTO uso_diario (dia, mensajes) VALUES ($1, 1)
         ON CONFLICT (dia) DO UPDATE SET mensajes = uso_diario.mensajes + 1
         RETURNING mensajes`,
        [dia]
      );
      const mensajesHoy = uso.rows[0].mensajes;
      if (mensajesHoy > limite) return { limiteAlcanzado: true, mensajesHoy };
      let esNuevo = false;
      let titulo;
      if (chatId) {
        const r = await c.query('UPDATE chats SET actualizado_en = now() WHERE id = $1 RETURNING titulo', [chatId]);
        if (!r.rowCount) return { noExiste: true };
        titulo = r.rows[0].titulo;
      } else {
        titulo = tituloDe(texto);
        const r = await c.query('INSERT INTO chats (titulo) VALUES ($1) RETURNING id', [titulo]);
        chatId = r.rows[0].id;
        esNuevo = true;
      }
      const m = await c.query(
        `INSERT INTO mensajes (chat_id, rol, contenido) VALUES ($1, 'user', $2) RETURNING id`,
        [chatId, texto]
      );
      const h = await c.query(
        `SELECT rol, contenido FROM (
           SELECT id, rol, contenido FROM mensajes WHERE chat_id = $1 ORDER BY id DESC LIMIT ${VENTANA_MENSAJES}
         ) t ORDER BY id`,
        [chatId]
      );
      const rc = await c.query('SELECT id, categoria, contenido FROM recuerdos ORDER BY id LIMIT 200');
      return {
        chatId,
        titulo,
        esNuevo,
        mensajeUsuarioId: Number(m.rows[0].id),
        historial: h.rows,
        recuerdos: rc.rows.map((r) => ({ ...r, id: Number(r.id) })),
        mensajesHoy,
      };
    });
  },

  async cerrarTurno({ chatId, texto, tokensIn, tokensOut, dia }) {
    return M(async (c) => {
      const r = await c.query(
        `INSERT INTO mensajes (chat_id, rol, contenido, tokens_in, tokens_out)
         VALUES ($1, 'assistant', $2, $3, $4) RETURNING id, creado_en`,
        [chatId, texto, tokensIn, tokensOut]
      );
      await c.query('UPDATE chats SET actualizado_en = now() WHERE id = $1', [chatId]);
      await c.query('UPDATE uso_diario SET tokens_in = tokens_in + $2, tokens_out = tokens_out + $3 WHERE dia = $1', [
        dia,
        tokensIn,
        tokensOut,
      ]);
      return { id: Number(r.rows[0].id), creado_en: r.rows[0].creado_en };
    });
  },

  async revertirTurno({ chatId, mensajeUsuarioId, esNuevo }) {
    return M(async (c) => {
      if (esNuevo) await c.query('DELETE FROM chats WHERE id = $1', [chatId]);
      else await c.query('DELETE FROM mensajes WHERE id = $1', [mensajeUsuarioId]);
    });
  },

  async listarChats() {
    const r = await M((c) => c.query('SELECT id, titulo, actualizado_en, fijado FROM chats ORDER BY fijado DESC, actualizado_en DESC LIMIT 100'));
    return r.rows;
  },
  async obtenerMensajes(chatId) {
    const r = await M((c) =>
      c.query('SELECT id, rol, contenido, creado_en FROM mensajes WHERE chat_id = $1 ORDER BY id LIMIT 500', [chatId])
    );
    return r.rows.map((m) => ({ ...m, id: Number(m.id) }));
  },
  async borrarChat(chatId) {
    const r = await M((c) => c.query('DELETE FROM chats WHERE id = $1', [chatId]));
    return r.rowCount > 0;
  },
  async borrarTodosLosChats() {
    const r = await M((c) => c.query('DELETE FROM chats'));
    return r.rowCount;
  },
  async renombrarChat(chatId, titulo) {
    const r = await M((c) => c.query('UPDATE chats SET titulo = $2 WHERE id = $1', [chatId, titulo]));
    return r.rowCount > 0;
  },
  async fijarChat(chatId, fijado) {
    const r = await M((c) => c.query('UPDATE chats SET fijado = $2 WHERE id = $1', [chatId, Boolean(fijado)]));
    return r.rowCount > 0;
  },

  async listarRecuerdos() {
    const r = await M((c) =>
      c.query('SELECT id, categoria, contenido, creado_en, actualizado_en FROM recuerdos ORDER BY id LIMIT 500')
    );
    return r.rows.map((x) => ({ ...x, id: Number(x.id) }));
  },
  async guardarRecuerdo({ categoria, contenido, origenChat, reemplazaId }) {
    categoria = normCategoria(categoria);
    return M(async (c) => {
      if (reemplazaId) {
        const r = await c.query(
          'UPDATE recuerdos SET contenido = $2, categoria = $3, actualizado_en = now() WHERE id = $1 RETURNING id',
          [reemplazaId, contenido, categoria]
        );
        if (r.rowCount) return { id: Number(r.rows[0].id), actualizado: true };
      }
      const dup = await c.query('SELECT id FROM recuerdos WHERE lower(contenido) = lower($1) LIMIT 1', [contenido]);
      if (dup.rowCount) {
        await c.query('UPDATE recuerdos SET actualizado_en = now() WHERE id = $1', [dup.rows[0].id]);
        return { id: Number(dup.rows[0].id), repetido: true };
      }
      const n = await c.query('SELECT count(*)::int AS n FROM recuerdos');
      if (n.rows[0].n >= MAX_RECUERDOS) return { error: 'limite' };
      const r = await c.query(
        'INSERT INTO recuerdos (categoria, contenido, origen_chat) VALUES ($1, $2, $3) RETURNING id',
        [categoria, contenido, origenChat || null]
      );
      return { id: Number(r.rows[0].id), nuevo: true };
    });
  },
  async buscarRecuerdos(texto) {
    const like = `%${escLike(texto)}%`;
    const r = await M((c) =>
      c.query(
        `SELECT id, categoria, contenido FROM recuerdos
         WHERE contenido ILIKE $1 OR categoria ILIKE $1 ORDER BY id LIMIT 30`,
        [like]
      )
    );
    return r.rows.map((x) => ({ ...x, id: Number(x.id) }));
  },
  async borrarRecuerdo(id) {
    const r = await M((c) => c.query('DELETE FROM recuerdos WHERE id = $1', [id]));
    return r.rowCount > 0;
  },

  async proponerOlvido({ ids, turno }) {
    return M(async (c) => {
      const r = await c.query('SELECT id, categoria, contenido FROM recuerdos WHERE id = ANY($1::bigint[]) ORDER BY id', [ids]);
      if (!r.rowCount) return { error: 'no_existen' };
      await c.query('DELETE FROM olvidos_pendientes');
      await c.query('INSERT INTO olvidos_pendientes (recuerdo_ids, turno) VALUES ($1::bigint[], $2)', [
        r.rows.map((x) => x.id),
        turno,
      ]);
      return { recuerdos: r.rows.map((x) => ({ ...x, id: Number(x.id) })) };
    });
  },
  async confirmarOlvido({ turno }) {
    return transaccion('memoria', async (c) => {
      await asegurarEsquema(c).catch(() => {});
      const p = await c.query(
        `SELECT id, recuerdo_ids, turno FROM olvidos_pendientes
         WHERE creado_en > now() - interval '1 day' ORDER BY id DESC LIMIT 1`
      );
      if (!p.rowCount) return { error: 'no_hay_pendiente' };
      if (Number(p.rows[0].turno) >= turno) return { error: 'falta_confirmacion' };
      const cont = await c.query('SELECT id, contenido FROM recuerdos WHERE id = ANY($1::bigint[])', [p.rows[0].recuerdo_ids]);
      await c.query('DELETE FROM recuerdos WHERE id = ANY($1::bigint[])', [p.rows[0].recuerdo_ids]);
      await c.query('DELETE FROM olvidos_pendientes');
      return { borrados: cont.rowCount, contenidos: cont.rows.map((x) => x.contenido) };
    });
  },
  async cancelarOlvido() {
    await M((c) => c.query('DELETE FROM olvidos_pendientes'));
    return { cancelado: true };
  },

  async resumenUso({ dia, mesInicio }) {
    return M(async (c) => {
      const h = await c.query('SELECT mensajes, tokens_in, tokens_out FROM uso_diario WHERE dia = $1', [dia]);
      const m = await c.query(
        `SELECT COALESCE(sum(mensajes),0)::int AS mensajes, COALESCE(sum(tokens_in),0)::bigint AS tin,
                COALESCE(sum(tokens_out),0)::bigint AS tout FROM uso_diario WHERE dia >= $1`,
        [mesInicio]
      );
      const n = await c.query('SELECT (SELECT count(*) FROM chats)::int AS chats, (SELECT count(*) FROM recuerdos)::int AS recuerdos');
      return {
        hoy: { mensajes: h.rows[0]?.mensajes ?? 0, tokens_in: Number(h.rows[0]?.tokens_in ?? 0), tokens_out: Number(h.rows[0]?.tokens_out ?? 0) },
        mes: { mensajes: m.rows[0].mensajes, tokens_in: Number(m.rows[0].tin), tokens_out: Number(m.rows[0].tout) },
        chats: n.rows[0].chats,
        recuerdos: n.rows[0].recuerdos,
      };
    });
  },
};

/* ========================= Backend local (demo / desarrollo) ========================= */

function L() {
  globalThis.__fenixLocal ||= { chats: [], mensajes: [], recuerdos: [], pendientes: [], uso: {}, seq: 0 };
  return globalThis.__fenixLocal;
}
const ahora = () => new Date().toISOString();

const localB = {
  async iniciarTurno({ chatId, texto, limite, dia }) {
    const s = L();
    s.uso[dia] ||= { mensajes: 0, tokens_in: 0, tokens_out: 0 };
    s.uso[dia].mensajes++;
    const mensajesHoy = s.uso[dia].mensajes;
    if (mensajesHoy > limite) return { limiteAlcanzado: true, mensajesHoy };
    let esNuevo = false;
    let chat;
    if (chatId) {
      chat = s.chats.find((c) => c.id === chatId);
      if (!chat) return { noExiste: true };
      chat.actualizado_en = ahora();
    } else {
      chat = { id: crypto.randomUUID(), titulo: tituloDe(texto), creado_en: ahora(), actualizado_en: ahora() };
      s.chats.push(chat);
      esNuevo = true;
    }
    const m = { id: ++s.seq, chat_id: chat.id, rol: 'user', contenido: texto, creado_en: ahora() };
    s.mensajes.push(m);
    const historial = s.mensajes.filter((x) => x.chat_id === chat.id).slice(-VENTANA_MENSAJES).map((x) => ({ rol: x.rol, contenido: x.contenido }));
    return {
      chatId: chat.id,
      titulo: chat.titulo,
      esNuevo,
      mensajeUsuarioId: m.id,
      historial,
      recuerdos: s.recuerdos.slice(0, 200).map(({ id, categoria, contenido }) => ({ id, categoria, contenido })),
      mensajesHoy,
    };
  },
  async cerrarTurno({ chatId, texto, tokensIn, tokensOut, dia }) {
    const s = L();
    const m = { id: ++s.seq, chat_id: chatId, rol: 'assistant', contenido: texto, creado_en: ahora() };
    s.mensajes.push(m);
    const chat = s.chats.find((c) => c.id === chatId);
    if (chat) chat.actualizado_en = ahora();
    s.uso[dia] ||= { mensajes: 0, tokens_in: 0, tokens_out: 0 };
    s.uso[dia].tokens_in += tokensIn || 0;
    s.uso[dia].tokens_out += tokensOut || 0;
    return { id: m.id, creado_en: m.creado_en };
  },
  async revertirTurno({ chatId, mensajeUsuarioId, esNuevo }) {
    const s = L();
    if (esNuevo) {
      s.chats = s.chats.filter((c) => c.id !== chatId);
      s.mensajes = s.mensajes.filter((m) => m.chat_id !== chatId);
    } else s.mensajes = s.mensajes.filter((m) => m.id !== mensajeUsuarioId);
  },
  async listarChats() {
    return [...L().chats].sort((a, b) => Number(Boolean(b.fijado)) - Number(Boolean(a.fijado)) || b.actualizado_en.localeCompare(a.actualizado_en)).slice(0, 100).map(({ id, titulo, actualizado_en, fijado }) => ({ id, titulo, actualizado_en, fijado: Boolean(fijado) }));
  },
  async obtenerMensajes(chatId) {
    return L().mensajes.filter((m) => m.chat_id === chatId).map(({ id, rol, contenido, creado_en }) => ({ id, rol, contenido, creado_en }));
  },
  async borrarChat(chatId) {
    const s = L();
    const antes = s.chats.length;
    s.chats = s.chats.filter((c) => c.id !== chatId);
    s.mensajes = s.mensajes.filter((m) => m.chat_id !== chatId);
    return s.chats.length < antes;
  },
  async borrarTodosLosChats() {
    const s = L();
    const n = s.chats.length;
    s.chats = [];
    s.mensajes = [];
    return n;
  },
  async renombrarChat(chatId, titulo) {
    const c = L().chats.find((x) => x.id === chatId);
    if (c) c.titulo = titulo;
    return Boolean(c);
  },
  async fijarChat(chatId, fijado) {
    const c = L().chats.find((x) => x.id === chatId);
    if (c) c.fijado = Boolean(fijado);
    return Boolean(c);
  },
  async listarRecuerdos() {
    return L().recuerdos.map((r) => ({ ...r }));
  },
  async guardarRecuerdo({ categoria, contenido, origenChat, reemplazaId }) {
    const s = L();
    categoria = normCategoria(categoria);
    if (reemplazaId) {
      const r = s.recuerdos.find((x) => x.id === reemplazaId);
      if (r) {
        Object.assign(r, { contenido, categoria, actualizado_en: ahora() });
        return { id: r.id, actualizado: true };
      }
    }
    const dup = s.recuerdos.find((x) => x.contenido.toLowerCase() === contenido.toLowerCase());
    if (dup) {
      dup.actualizado_en = ahora();
      return { id: dup.id, repetido: true };
    }
    if (s.recuerdos.length >= MAX_RECUERDOS) return { error: 'limite' };
    const r = { id: ++s.seq, categoria, contenido, origen_chat: origenChat || null, creado_en: ahora(), actualizado_en: ahora() };
    s.recuerdos.push(r);
    return { id: r.id, nuevo: true };
  },
  async buscarRecuerdos(texto) {
    const t = texto.toLowerCase();
    return L().recuerdos.filter((r) => r.contenido.toLowerCase().includes(t) || r.categoria.includes(t)).slice(0, 30).map(({ id, categoria, contenido }) => ({ id, categoria, contenido }));
  },
  async borrarRecuerdo(id) {
    const s = L();
    const antes = s.recuerdos.length;
    s.recuerdos = s.recuerdos.filter((r) => r.id !== id);
    return s.recuerdos.length < antes;
  },
  async proponerOlvido({ ids, turno }) {
    const s = L();
    const rs = s.recuerdos.filter((r) => ids.includes(r.id));
    if (!rs.length) return { error: 'no_existen' };
    s.pendientes = [{ ids: rs.map((r) => r.id), turno, creado: Date.now() }];
    return { recuerdos: rs.map(({ id, categoria, contenido }) => ({ id, categoria, contenido })) };
  },
  async confirmarOlvido({ turno }) {
    const s = L();
    const p = s.pendientes[s.pendientes.length - 1];
    if (!p || Date.now() - p.creado > 86400000) return { error: 'no_hay_pendiente' };
    if (p.turno >= turno) return { error: 'falta_confirmacion' };
    const cont = s.recuerdos.filter((r) => p.ids.includes(r.id)).map((r) => r.contenido);
    s.recuerdos = s.recuerdos.filter((r) => !p.ids.includes(r.id));
    s.pendientes = [];
    return { borrados: cont.length, contenidos: cont };
  },
  async cancelarOlvido() {
    L().pendientes = [];
    return { cancelado: true };
  },
  async resumenUso({ dia, mesInicio }) {
    const s = L();
    const mes = Object.entries(s.uso).filter(([d]) => d >= mesInicio).reduce((a, [, u]) => ({ mensajes: a.mensajes + u.mensajes, tokens_in: a.tokens_in + u.tokens_in, tokens_out: a.tokens_out + u.tokens_out }), { mensajes: 0, tokens_in: 0, tokens_out: 0 });
    return { hoy: s.uso[dia] || { mensajes: 0, tokens_in: 0, tokens_out: 0 }, mes, chats: s.chats.length, recuerdos: s.recuerdos.length };
  },
};

const be = () => (configurada('memoria') ? pgB : localB);

export const memoria = new Proxy(
  {},
  {
    get: (_, nombre) => (...args) => be()[nombre](...args),
  }
);
