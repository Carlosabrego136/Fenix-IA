// Conexión con el API de Claude (mensajes + herramientas). Sin SDK: un fetch simple.
// Notas del modelo Haiku 5.5: no se envían temperature/top_p/top_k, no hay "prefill" (el último mensaje
// siempre es del usuario) y las respuestas se leen por tipo de bloque, no por posición.
import { cfg } from './config.js';
import { HERRAMIENTAS, ejecutarHerramienta } from './herramientas.js';
import { sistemaEstable, sistemaDinamico } from './prompt.js';

const MAX_ITERACIONES = 6;
const MAX_TOKENS_SALIDA = 2000;
const PRESUPUESTO_MS = 52000;
const VENTANA_CARACTERES = 90000; // ~30k tokens de historial como máximo

const ESCRIBEN_MEMORIA = new Set(['guardar_recuerdo', 'proponer_olvido', 'confirmar_olvido', 'cancelar_olvido']);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export class ErrorIA extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

function armarHistorial(historial) {
  let acumulado = 0;
  const recientes = [];
  for (let i = historial.length - 1; i >= 0; i--) {
    acumulado += historial[i].contenido.length;
    if (acumulado > VENTANA_CARACTERES && recientes.length) break;
    recientes.unshift(historial[i]);
  }
  while (recientes.length && recientes[0].rol !== 'user') recientes.shift();
  return recientes.map((m) => ({ role: m.rol, content: m.contenido }));
}

async function llamar(cuerpo, restante) {
  const c = cfg();
  for (let intento = 0; ; intento++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), Math.min(40000, Math.max(5000, restante())));
    let res;
    try {
      res = await fetch(`${c.apiBase}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(cuerpo),
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      if (intento < 2 && restante() > 8000) {
        await dormir(800 * (intento + 1));
        continue;
      }
      throw new ErrorIA('No pude comunicarme con el servicio de IA. Intente de nuevo en un momento.', 504);
    }
    clearTimeout(t);
    if (res.ok) return res.json();
    const txt = await res.text().catch(() => '');
    let detalle = '';
    try {
      detalle = JSON.parse(txt)?.error?.message || '';
    } catch {}
    console.error('[ia] HTTP', res.status, detalle.slice(0, 300));
    if ([429, 500, 502, 503, 529].includes(res.status) && intento < 2 && restante() > 8000) {
      await dormir(1000 * (intento + 1));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new ErrorIA('La clave del servicio de IA no es válida. Avise a soporte técnico.', 502);
    if (res.status === 402 || /credit balance|billing/i.test(detalle)) throw new ErrorIA('El servicio de IA no tiene saldo disponible. Avise a soporte técnico.', 502);
    if (res.status === 429) throw new ErrorIA('El servicio de IA está saturado. Intente de nuevo en un minuto.', 503);
    throw new ErrorIA('El servicio de IA no pudo responder. Intente de nuevo.', 502);
  }
}

// Devuelve { texto, tokensIn, tokensOut }.
export async function responder({ historial, recuerdos, ctx }) {
  const c = cfg();
  const inicio = Date.now();
  const restante = () => PRESUPUESTO_MS - (Date.now() - inicio);
  const mensajes = armarHistorial(historial);
  let tokensIn = 0;
  let tokensOut = 0;
  let textoParcial = '';

  const sistema = [
    { type: 'text', text: sistemaEstable(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: sistemaDinamico({ recuerdos }) },
  ];

  for (let vuelta = 0; vuelta < MAX_ITERACIONES; vuelta++) {
    const cuerpo = {
      model: c.modelo,
      max_tokens: MAX_TOKENS_SALIDA,
      system: sistema,
      tools: HERRAMIENTAS,
      messages: mensajes,
      thinking: c.pensar ? { type: 'adaptive' } : { type: 'disabled' },
    };
    const r = await llamar(cuerpo, restante);
    const u = r.usage || {};
    tokensIn += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    tokensOut += u.output_tokens || 0;

    const bloques = Array.isArray(r.content) ? r.content : [];
    const texto = bloques.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (texto) textoParcial = texto;

    if (r.stop_reason === 'tool_use') {
      const usos = bloques.filter((b) => b.type === 'tool_use');
      if (!usos.length) break;
      mensajes.push({ role: 'assistant', content: bloques }); // se devuelve tal cual, incluidos bloques de razonamiento
      const correr = async (u2) => {
        const { texto: salida, esError } = await ejecutarHerramienta(u2.name, u2.input, ctx);
        return { type: 'tool_result', tool_use_id: u2.id, content: salida, ...(esError ? { is_error: true } : {}) };
      };
      // Las consultas de lectura son independientes y van en paralelo. Si alguna herramienta toca la memoria
      // (guardar u olvidar), todas van una tras otra y en el orden pedido, para que "proponer" siempre
      // ocurra antes que "confirmar" y la confirmación de la dueña no pueda saltarse.
      const resultados = usos.some((x) => ESCRIBEN_MEMORIA.has(x.name))
        ? await usos.reduce(async (ac, x) => [...(await ac), await correr(x)], Promise.resolve([]))
        : await Promise.all(usos.map(correr));
      mensajes.push({ role: 'user', content: resultados });
      if (restante() < 6000) break;
      continue;
    }
    if (r.stop_reason === 'refusal') {
      return { texto: 'No puedo ayudarle con esa solicitud. Si cree que es un error, reformule su pregunta.', tokensIn, tokensOut };
    }
    if (r.stop_reason === 'model_context_window_exceeded') {
      throw new ErrorIA('Este chat ya es demasiado largo. Abra un chat nuevo para continuar.', 413);
    }
    if (r.stop_reason === 'max_tokens') {
      return { texto: (texto || 'La respuesta quedó incompleta.') + '\n\n(La respuesta se cortó por ser muy larga. Pídame que continúe o que la resuma.)', tokensIn, tokensOut };
    }
    return { texto: texto || 'No tengo una respuesta para eso. ¿Puede darme más detalles?', tokensIn, tokensOut };
  }
  return {
    texto: (textoParcial ? textoParcial + '\n\n' : '') + 'Me tardé demasiado consultando. Intente la pregunta de nuevo, quizá más específica.',
    tokensIn,
    tokensOut,
  };
}
