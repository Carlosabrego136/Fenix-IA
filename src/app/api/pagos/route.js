import { exigirSesion, err } from '@/lib/auth';
import { listarPagos, registrarPago } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  try {
    const r = await listarPagos({ limite: 150 });
    return r.error ? err(503, r.error) : Response.json(r);
  } catch (e) {
    console.error('[pagos]', e?.code, e?.message);
    return err(503, 'No pude leer los pagos.');
  }
}

export async function POST(req) {
  const no = await exigirSesion();
  if (no) return no;
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const r = await registrarPago({ cliente: b.cliente, total: b.total, semana_de: b.semana_de, fecha_limite: b.fecha_limite, notas: b.notas });
    return r.error ? err(400, r.error) : Response.json(r);
  } catch (e) {
    console.error('[pagos:crear]', e?.code, e?.message);
    return err(503, 'No pude guardar el pago.');
  }
}
