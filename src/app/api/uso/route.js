import { exigirSesion, err } from '@/lib/auth';
import { memoria } from '@/lib/memoria';
import { cfg, hoyISO, modos } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const no = await exigirSesion();
  if (no) return no;
  const c = cfg();
  const dia = hoyISO();
  try {
    const u = await memoria.resumenUso({ dia, mesInicio: dia.slice(0, 8) + '01' });
    return Response.json({ ...u, limiteDiario: c.limiteDiario, modos: modos(), asistente: c.asistente, negocio: c.negocio, dueña: c.dueña });
  } catch (e) {
    console.error('[uso]', e?.code, e?.message);
    return Response.json({ modos: modos(), limiteDiario: c.limiteDiario, asistente: c.asistente, negocio: c.negocio, dueña: c.dueña, sinMemoria: true });
  }
}
