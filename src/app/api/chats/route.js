import { exigirSesion, err } from '@/lib/auth';
import { memoria } from '@/lib/memoria';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  try {
    return Response.json({ chats: await memoria.listarChats() });
  } catch (e) {
    console.error('[chats]', e?.code, e?.message);
    return err(503, 'No pude leer los chats. Revise la conexión de la memoria.');
  }
}

// Borra TODOS los chats (no borra lo que la IA aprendió). Exige confirmación explícita en el cuerpo.
export async function DELETE(req) {
  const no = await exigirSesion();
  if (no) return no;
  let body = {};
  try {
    body = await req.json();
  } catch {}
  if (body.confirmar !== true) return err(400, 'Falta confirmar el borrado.');
  try {
    return Response.json({ borrados: await memoria.borrarTodosLosChats() });
  } catch (e) {
    console.error('[chats:borrar]', e?.code, e?.message);
    return err(503, 'No pude borrar los chats.');
  }
}
