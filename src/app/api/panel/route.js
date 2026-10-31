import { exigirSesion } from '@/lib/auth';
import { panel } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  try {
    return Response.json(await panel());
  } catch (e) {
    console.error('[panel]', e?.code, e?.message);
    return Response.json({ disponible: false });
  }
}
