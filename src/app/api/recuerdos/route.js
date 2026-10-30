import { exigirSesion, err } from '@/lib/auth';
import { memoria, CATEGORIAS } from '@/lib/memoria';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  try {
    return Response.json({ recuerdos: await memoria.listarRecuerdos(), categorias: CATEGORIAS });
  } catch (e) {
    console.error('[recuerdos]', e?.code, e?.message);
    return err(503, 'No pude leer la memoria.');
  }
}

// La dueña también puede enseñarle algo directamente desde la pantalla Memoria.
export async function POST(req) {
  const no = await exigirSesion();
  if (no) return no;
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim().slice(0, 500) : '';
  if (contenido.length < 4) return err(400, 'Escriba algo más completo para que lo recuerde.');
  try {
    const r = await memoria.guardarRecuerdo({ categoria: body.categoria, contenido });
    if (r.error === 'limite') return err(409, 'La memoria está llena. Borre algunos recuerdos primero.');
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error('[recuerdos:crear]', e?.code, e?.message);
    return err(503, 'No pude guardar el recuerdo.');
  }
}
