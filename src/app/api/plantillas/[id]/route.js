import { exigirSesion, err } from '@/lib/auth';
import { guardarPlantilla, borrarPlantilla } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function PUT(req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Plantilla inválida.');
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const r = await guardarPlantilla({ id: n, descripcion: b.descripcion, contenido: b.contenido });
    return r.error ? err(400, r.error) : Response.json(r);
  } catch (e) {
    console.error('[plantillas:editar]', e?.code, e?.message);
    return err(503, 'No pude guardar la plantilla.');
  }
}

export async function DELETE(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Plantilla inválida.');
  try {
    const r = await borrarPlantilla({ id: n });
    return r.error ? err(404, r.error) : Response.json({ ok: true });
  } catch (e) {
    console.error('[plantillas:borrar]', e?.code, e?.message);
    return err(503, 'No pude borrar la plantilla.');
  }
}
