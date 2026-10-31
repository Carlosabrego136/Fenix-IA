import { exigirSesion, err } from '@/lib/auth';
import { plantillasCompletas, guardarPlantilla } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  try {
    const r = await plantillasCompletas();
    return r.error ? err(503, r.error) : Response.json(r);
  } catch (e) {
    console.error('[plantillas]', e?.code, e?.message);
    return err(503, 'No pude leer las plantillas.');
  }
}

export async function POST(req) {
  const no = await exigirSesion();
  if (no) return no;
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    const r = await guardarPlantilla({ nombre: b.nombre, descripcion: b.descripcion, contenido: b.contenido });
    return r.error ? err(400, r.error) : Response.json(r);
  } catch (e) {
    console.error('[plantillas:crear]', e?.code, e?.message);
    return err(503, 'No pude guardar la plantilla.');
  }
}
