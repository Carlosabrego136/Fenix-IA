// Respuestas de demostración cuando todavía no hay ANTHROPIC_API_KEY. No es IA: solo reconoce palabras
// clave y arma la respuesta con las mismas consultas de la IA real, para poder enseñar la app.
import { ejecutarHerramienta } from './herramientas.js';

const quitarAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const E = { recibido: 'recibido', en_transito: 'en tránsito', listo_entrega: 'listo para entrega', entregado: 'entregado' };
const get = async (n, i, ctx) => JSON.parse((await ejecutarHerramienta(n, i, ctx)).texto);

function lineaPaquete(p) {
  const guia = p.guia ? `guía ${p.guia}${p.paqueteria ? ' (' + p.paqueteria + ')' : ''}` : 'sin guía';
  return `- ${p.cliente || 'Cliente sin nombre'}: ${E[p.estado] || p.estado}, ${p.dias_en_estado} día(s) en ese estado, ${guia}`;
}

export async function responderDemo(texto, ctx) {
  const t = quitarAcentos(texto);
  const aviso = '🔧 Modo demostración: todavía no hay IA conectada, así que respondo con reglas simples y datos de ejemplo.\n\n';
  let cuerpo;

  if (/multa|folio/.test(t)) {
    const r = await get('buscar_paquetes', { estados: ['listo_entrega'], min_dias_en_estado: 3, orden: 'mas_tiempo_en_estado' }, ctx);
    cuerpo =
      'Hoy el sistema no guarda folios ni reglas de multas, así que no puedo decirle cuáles causarían una multa. ' +
      'Dígame qué provoca una multa en su paquetería (por ejemplo, días sin entregar) y lo recordaré.\n\n' +
      `Lo que sí puedo mostrarle: paquetes "listo para entrega" con 3 días o más (${r.total_encontrados}):\n` +
      (r.paquetes.map(lineaPaquete).join('\n') || '- Ninguno');
  } else if (/pago|cobr|deb|dinero/.test(t)) {
    cuerpo = 'Todavía no hay pagos ni cobros registrados en el sistema, así que no puedo decirle cuáles están pendientes. Podemos agregarlos para que la IA los revise.';
  } else if (/repetid|duplic/.test(t)) {
    const r = await get('guias_repetidas', {}, ctx);
    cuerpo = r.guias.length
      ? 'Guías usadas en más de un paquete:\n' + r.guias.map((g) => `- ${g.guia}: ${g.veces} paquetes, ${g.clientes_distintos} cliente(s), ${g.paqueterias_distintas} paquetería(s)${g.paqueterias_distintas > 1 ? ' ⚠️ revisar' : ''}`).join('\n')
      : 'No hay guías repetidas.';
  } else if (/whatsapp|aviso|notific/.test(t)) {
    const r = await get('notificaciones_whatsapp', { estado_envio: 'error' }, ctx);
    cuerpo = r.notificaciones.length
      ? 'Avisos de WhatsApp que fallaron:\n' + r.notificaciones.map((n) => `- ${n.cliente || 'Cliente'}: ${n.error}`).join('\n')
      : 'No hay avisos con error.';
  } else if (/vendedor|credencial|vence|vencim/.test(t)) {
    const r = await get('buscar_vendedores', { vence_en_dias: 30 }, ctx);
    cuerpo = 'Vendedores que vencen en 30 días o menos:\n' + (r.vendedores.map((v) => `- ${v.nombre}: vence ${v.vence} (${v.dias_para_vencer} días)`).join('\n') || '- Ninguno');
  } else if (/cliente|telefono/.test(t)) {
    const r = await get('buscar_clientes', { sin_telefono: true }, ctx);
    cuerpo = 'Clientes sin teléfono (no les llegan avisos):\n' + (r.clientes.map((c) => `- ${c.nombre}`).join('\n') || '- Ninguno');
  } else if (/recog|pendient|entrega|paquete|cuanto|resumen|vamos/.test(t)) {
    const r = await get('resumen_paquetes', {}, ctx);
    const p = await get('buscar_paquetes', { estados: ['recibido', 'en_transito', 'listo_entrega'], orden: 'mas_tiempo_en_estado', limite: 8 }, ctx);
    cuerpo =
      `Hay ${r.total} paquetes en el sistema:\n` + r.por_estado.map((e) => `- ${E[e.estado] || e.estado}: ${e.paquetes} (${e.sin_guia} sin guía)`).join('\n') +
      `\n\nLos que llevan más tiempo sin entregarse:\n` + p.paquetes.map(lineaPaquete).join('\n');
  } else {
    cuerpo =
      'Puedo ayudarle con cosas como:\n- "¿Cómo vamos con los paquetes?"\n- "¿Qué paquetes llevan mucho tiempo sin entregarse?"\n- "¿Hay guías repetidas?"\n- "¿Qué avisos de WhatsApp fallaron?"\n- "¿Qué vendedores vencen pronto?"\n- "¿Qué clientes no tienen teléfono?"';
  }
  return { texto: aviso + cuerpo, tokensIn: 0, tokensOut: 0 };
}
