import { exigirSesion, err } from '@/lib/auth';
import { listaFolios, resumenFolios } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const no = await exigirSesion();
  if (no) return no;
  const estado = new URL(req.url).searchParams.get('estado') === 'recogido' ? 'recogido' : 'pendiente';
  try {
    const [l, r] = await Promise.all([listaFolios({ estado }), resumenFolios()]);
    if (l.error) return err(503, l.error);
    return Response.json({ folios: l.folios, resumen: r.error ? null : { pendientes: r.pendientes, recogidos: r.recogidos, conteo: r.conteo } });
  } catch (e) {
    console.error('[folios]', e?.code, e?.message);
    return err(503, 'No pude leer los folios.');
  }
}
