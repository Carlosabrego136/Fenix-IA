import { exigirSesion, err, UUID } from '@/lib/auth';
import { memoria } from '@/lib/memoria';

export const dynamic = 'force-dynamic';

async function conId(params) {
  const { id } = await params;
  return UUID.test(id) ? id : null;
}

export async function GET(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const id = await conId(params);
  if (!id) return err(400, 'Chat inválido.');
  try {
    return Response.json({ mensajes: await memoria.obtenerMensajes(id) });
  } catch (e) {
    console.error('[chat:leer]', e?.code, e?.message);
    return err(503, 'No pude abrir ese chat.');
  }
}

export async function DELETE(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const id = await conId(params);
  if (!id) return err(400, 'Chat inválido.');
  try {
    const ok = await memoria.borrarChat(id);
    return ok ? Response.json({ ok: true }) : err(404, 'Ese chat ya no existe.');
  } catch (e) {
    console.error('[chat:borrar]', e?.code, e?.message);
    return err(503, 'No pude borrar el chat.');
  }
}

export async function PATCH(req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const id = await conId(params);
  if (!id) return err(400, 'Chat inválido.');
  let body = {};
  try {
    body = await req.json();
  } catch {}
  try {
    if (typeof body.fijado === 'boolean' && body.titulo === undefined) {
      const ok = await memoria.fijarChat(id, body.fijado);
      return ok ? Response.json({ ok: true, fijado: body.fijado }) : err(404, 'Ese chat ya no existe.');
    }
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim().slice(0, 80) : '';
    if (!titulo) return err(400, 'Escriba un nombre para el chat.');
    const ok = await memoria.renombrarChat(id, titulo);
    return ok ? Response.json({ ok: true, titulo }) : err(404, 'Ese chat ya no existe.');
  } catch (e) {
    console.error('[chat:editar]', e?.code, e?.message);
    return err(503, 'No pude actualizar el chat.');
  }
}
