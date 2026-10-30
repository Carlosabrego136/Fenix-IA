import { exigirSesion, err } from '@/lib/auth';
import { memoria } from '@/lib/memoria';

export const dynamic = 'force-dynamic';

export async function DELETE(_req, { params }) {
  const no = await exigirSesion();
  if (no) return no;
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return err(400, 'Recuerdo inválido.');
  try {
    const ok = await memoria.borrarRecuerdo(n);
    return ok ? Response.json({ ok: true }) : err(404, 'Ese recuerdo ya no existe.');
  } catch (e) {
    console.error('[recuerdos:borrar]', e?.code, e?.message);
    return err(503, 'No pude borrar el recuerdo.');
  }
}
