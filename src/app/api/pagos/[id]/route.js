import { exigirSesion, err } from '@/lib/auth';
import { actualizarPago, quitarPago } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Pago inválido.');
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const r = await actualizarPago({ id: n, estado: b.estado, notas: b.notas, total: b.total, fecha_limite: b.fecha_limite });
    return r.error ? err(400, r.error) : Response.json(r);
  } catch (e) {
    console.error('[pagos:editar]', e?.code, e?.message);
    return err(503, 'No pude actualizar el pago.');
  }
}

export async function DELETE(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const n = Number((await params).id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Pago inválido.');
  try {
    const r = await quitarPago({ id: n });
    return r.error ? err(404, r.error) : Response.json({ ok: true });
  } catch (e) {
    console.error('[pagos:quitar]', e?.code, e?.message);
    return err(503, 'No pude quitar el pago.');
  }
}
