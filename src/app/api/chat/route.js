import { exigirSesion, err, UUID } from '@/lib/auth';
import { memoria } from '@/lib/memoria';
import { cfg, hoyISO } from '@/lib/config';
import { responder, ErrorIA } from '@/lib/ia';
import { responderDemo } from '@/lib/demo';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const no = await exigirSesion();
  if (no) return no;

  let body;
  try {
    body = await req.json();
  } catch {
    return err(400, 'Solicitud inválida.');
  }
  const texto = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!texto) return err(400, 'Escriba un mensaje.');
  if (texto.length > 4000) return err(400, 'El mensaje es muy largo (máximo 4000 caracteres).');
  const chatId = body.chatId ? String(body.chatId) : null;
  if (chatId && !UUID.test(chatId)) return err(400, 'Chat inválido.');

  const c = cfg();
  const dia = hoyISO();

  let turno;
  try {
    turno = await memoria.iniciarTurno({ chatId, texto, limite: c.limiteDiario, dia });
  } catch (e) {
    console.error('[chat:iniciar]', e?.code, String(e?.message).slice(0, 200));
    return err(503, 'No pude conectar con la memoria de la IA. Intente de nuevo en un momento.');
  }
  if (turno.limiteAlcanzado) return err(429, `Llegó al límite de ${c.limiteDiario} mensajes de hoy. Mañana se renueva.`);
  if (turno.noExiste) return err(404, 'Ese chat ya no existe.');

  const ctx = { chatId: turno.chatId, mensajeUsuarioId: turno.mensajeUsuarioId };
  let r;
  try {
    r = c.apiKey
      ? await responder({ historial: turno.historial, recuerdos: turno.recuerdos, ctx })
      : await responderDemo(texto, ctx);
  } catch (e) {
    console.error('[chat:ia]', e?.estado, String(e?.message).slice(0, 200));
    await memoria.revertirTurno({ chatId: turno.chatId, mensajeUsuarioId: turno.mensajeUsuarioId, esNuevo: turno.esNuevo }).catch(() => {});
    if (e instanceof ErrorIA) return err(e.estado || 502, e.message);
    return err(502, 'No pude responder en este momento. Intente de nuevo.');
  }

  try {
    const guardado = await memoria.cerrarTurno({ chatId: turno.chatId, texto: r.texto, tokensIn: r.tokensIn, tokensOut: r.tokensOut, dia });
    return Response.json({
      chatId: turno.chatId,
      titulo: turno.titulo,
      esNuevo: turno.esNuevo,
      usuarioId: turno.mensajeUsuarioId,
      mensaje: { id: guardado.id, rol: 'assistant', contenido: r.texto, creado_en: guardado.creado_en },
      restantesHoy: Math.max(0, c.limiteDiario - turno.mensajesHoy),
    });
  } catch (e) {
    console.error('[chat:cerrar]', e?.code, String(e?.message).slice(0, 200));
    return err(503, 'La respuesta estaba lista pero no pude guardarla. Intente de nuevo.');
  }
}
