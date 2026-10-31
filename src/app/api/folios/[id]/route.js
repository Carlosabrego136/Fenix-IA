import { exigirSesion, err } from '@/lib/auth';
import { marcarFolios, quitarFolio } from '@/lib/negocio';
import { conBasePg } from '@/lib/memoria';

export const dynamic = 'force-dynamic';

// PATCH { estado: 'recogido' | 'pendiente' }   DELETE: quitar un folio registrado por error.
export async function PATCH(req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Folio inválido.');
  let body = {};
  try { body = await req.json(); } catch {}
  if (!['recogido', 'pendiente'].includes(body.estado)) return err(400, 'Estado inválido.');
  try {
    const f = await conBasePg((c) => c.query('SELECT folio FROM folios WHERE id = $1', [n]));
    if (!f.rowCount) return err(404, 'Ese folio ya no existe.');
    const r = await marcarFolios({ folios: [f.rows[0].folio], estado: body.estado });
    return r.error ? err(400, r.error) : Response.json({ ok: true });
  } catch (e) {
    console.error('[folios:marcar]', e?.code, e?.message);
    return err(503, 'No pude actualizar el folio.');
  }
}

export async function DELETE(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Folio inválido.');
  try {
    const r = await quitarFolio({ id: n });
    return r.error ? err(404, r.error) : Response.json({ ok: true });
  } catch (e) {
    console.error('[folios:quitar]', e?.code, e?.message);
    return err(503, 'No pude quitar el folio.');
  }
}
