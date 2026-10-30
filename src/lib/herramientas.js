// Herramientas que la IA puede usar: consultas de solo lectura al sistema de envíos y manejo de su memoria.
import * as L from './lectura.js';
import { memoria, CATEGORIAS } from './memoria.js';

const ESTADOS = ['recibido', 'en_transito', 'listo_entrega', 'entregado'];
const MAX_SALIDA = 14000;

export const HERRAMIENTAS = [
  {
    name: 'resumen_paquetes',
    description:
      'Cuenta los paquetes del sistema por estado (recibido, en_transito, listo_entrega, entregado) y cuántos no tienen guía. Úsala para preguntas generales como "cómo vamos" o "cuántos paquetes hay".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'buscar_paquetes',
    description:
      'Lista paquetes con filtros. Devuelve id corto, estado, guía, paquetería, cliente, teléfono del cliente, vendedor, bloque, notas, fecha de captura, desde cuándo está en su estado actual y cuántos días lleva ahí. Úsala para "qué paquetes tengo pendientes", "qué lleva mucho tiempo en listo para entrega", "paquetes de tal cliente o vendedor", "paquetes sin guía".',
    input_schema: {
      type: 'object',
      properties: {
        estados: { type: 'array', items: { type: 'string', enum: ESTADOS }, description: 'Filtrar por uno o varios estados.' },
        cliente: { type: 'string', description: 'Parte del nombre del cliente.' },
        vendedor: { type: 'string', description: 'Parte del nombre o alias del vendedor.' },
        bloque: { type: 'string', description: 'Bloque o categoría del cliente, por ejemplo "24.4" o "general".' },
        guia: { type: 'string', description: 'Parte del número de guía.' },
        paqueteria: { type: 'string', description: 'Nombre de la paquetería (FedEx, DHL, Estafeta, Paquete Express, Bajapack, Volaris).' },
        con_guia: { type: 'boolean', description: 'true = solo con guía; false = solo sin guía.' },
        desde: { type: 'string', description: 'Fecha mínima de captura, formato AAAA-MM-DD.' },
        hasta: { type: 'string', description: 'Fecha máxima de captura, formato AAAA-MM-DD.' },
        min_dias_en_estado: { type: 'integer', description: 'Solo paquetes que llevan al menos N días en su estado actual.' },
        orden: { type: 'string', enum: ['recientes', 'mas_tiempo_en_estado'], description: 'Por defecto los más recientes primero.' },
        limite: { type: 'integer', description: 'Máximo de filas (1 a 60, por defecto 25).' },
      },
    },
  },
  {
    name: 'guias_repetidas',
    description:
      'Encuentra números de guía usados en más de un paquete, con cuántos clientes y cuántas paqueterías distintas. Ojo: muchas guías son colectivas (una caja con varios paquetes), así que repetir una guía puede ser normal; lo sospechoso es la misma guía con paqueterías distintas.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'buscar_clientes',
    description:
      'Busca clientes por nombre o teléfono y muestra cuántos paquetes tiene cada uno por estado. También sirve para encontrar clientes sin teléfono (a quienes no les llegan avisos de WhatsApp) o con paquetes sin entregar.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte del nombre o teléfono.' },
        sin_telefono: { type: 'boolean' },
        con_paquetes_activos: { type: 'boolean', description: 'Solo clientes con al menos un paquete que no esté entregado.' },
        limite: { type: 'integer', description: 'Máximo de filas (1 a 50, por defecto 20).' },
      },
    },
  },
  {
    name: 'buscar_vendedores',
    description:
      'Busca vendedores y muestra su estatus (activo, inactivo, alerta_riesgo, vetado), fecha de vencimiento y cuántos días faltan, y si les falta la foto de credencial. No incluye datos personales sensibles.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte del nombre o alias.' },
        estatus: { type: 'string', enum: ['activo', 'inactivo', 'alerta_riesgo', 'vetado'] },
        vence_en_dias: { type: 'integer', description: 'Vendedores que vencen en N días o menos (los ya vencidos salen con días negativos).' },
        sin_foto_credencial: { type: 'boolean' },
        limite: { type: 'integer', description: 'Máximo de filas (1 a 60, por defecto 25).' },
      },
    },
  },
  {
    name: 'historial_paquete',
    description:
      'Muestra el historial de estados de un paquete y los avisos de WhatsApp que se le mandaron al cliente. Recibe el id corto que devolvió buscar_paquetes.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'notificaciones_whatsapp',
    description:
      'Lista los avisos automáticos de WhatsApp y si salieron bien (enviado), siguen pendientes o fallaron (error), con el motivo del error.',
    input_schema: {
      type: 'object',
      properties: {
        estado_envio: { type: 'string', enum: ['pendiente', 'enviado', 'error'] },
        limite: { type: 'integer', description: 'Máximo de filas (1 a 50, por defecto 20).' },
      },
    },
  },
  {
    name: 'guardar_recuerdo',
    description:
      'Guarda en tu memoria de largo plazo algo que la dueña te dijo o confirmó y que conviene recordar siempre: una definición del negocio, una regla, una preferencia de cómo responderle, o un dato de una persona. Para corregir uno existente usa reemplaza_id con su número. NO guardes datos de paquetes o clientes que ya están en el sistema, ni cosas que ella no dijo.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', enum: CATEGORIAS },
        contenido: { type: 'string', description: 'Una frase clara y completa, en tercera persona o neutra. Máximo 500 caracteres.' },
        reemplaza_id: { type: 'integer', description: 'Número de un recuerdo existente que este reemplaza.' },
      },
      required: ['categoria', 'contenido'],
    },
  },
  {
    name: 'buscar_recuerdos',
    description: 'Busca en tu memoria de largo plazo por palabra clave. Úsala cuando necesites algo que no aparece en la lista de recuerdos del contexto.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
  },
  {
    name: 'proponer_olvido',
    description:
      'Primer paso para borrar recuerdos cuando la dueña pide olvidar algo. NO borra nada: prepara la lista. Después muéstrale exactamente qué se va a olvidar y pídele que confirme.',
    input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer' } } }, required: ['ids'] },
  },
  {
    name: 'confirmar_olvido',
    description:
      'Segundo paso: borra definitivamente lo que se propuso. Solo funciona si la dueña confirmó en un mensaje NUEVO posterior a la propuesta. Nunca la llames en el mismo turno que proponer_olvido.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cancelar_olvido',
    description: 'Cancela un borrado propuesto cuando la dueña dice que no.',
    input_schema: { type: 'object', properties: {} },
  },
];

const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined) || undefined;
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const bool = (v) => (typeof v === 'boolean' ? v : undefined);

async function correr(nombre, i, ctx) {
  switch (nombre) {
    case 'resumen_paquetes':
      return L.resumenPaquetes();
    case 'buscar_paquetes':
      return L.buscarPaquetes({
        estados: Array.isArray(i.estados) ? i.estados : [], cliente: str(i.cliente), vendedor: str(i.vendedor), bloque: str(i.bloque),
        guia: str(i.guia), paqueteria: str(i.paqueteria), con_guia: bool(i.con_guia), desde: /^\d{4}-\d{2}-\d{2}$/.test(i.desde || '') ? i.desde : undefined,
        hasta: /^\d{4}-\d{2}-\d{2}$/.test(i.hasta || '') ? i.hasta : undefined, min_dias_en_estado: num(i.min_dias_en_estado),
        orden: i.orden, limite: num(i.limite),
      });
    case 'guias_repetidas':
      return L.guiasRepetidas();
    case 'buscar_clientes':
      return L.buscarClientes({ texto: str(i.texto), sin_telefono: bool(i.sin_telefono), con_paquetes_activos: bool(i.con_paquetes_activos), limite: num(i.limite) });
    case 'buscar_vendedores':
      return L.buscarVendedores({ texto: str(i.texto), estatus: str(i.estatus, 20), vence_en_dias: num(i.vence_en_dias), sin_foto_credencial: bool(i.sin_foto_credencial), limite: num(i.limite) });
    case 'historial_paquete':
      return L.historialPaquete({ id: str(i.id, 40) });
    case 'notificaciones_whatsapp':
      return L.notificacionesWhatsapp({ estado_envio: str(i.estado_envio, 20), limite: num(i.limite) });

    case 'guardar_recuerdo': {
      const contenido = str(i.contenido, 500);
      if (!contenido || contenido.length < 4) return { error: 'El recuerdo está vacío o es muy corto.' };
      const r = await memoria.guardarRecuerdo({ categoria: i.categoria, contenido, origenChat: ctx.chatId, reemplazaId: num(i.reemplaza_id) });
      if (r.error === 'limite') return { error: 'La memoria está llena (300 recuerdos). Pídele a la dueña que borre algunos en la pantalla Memoria.' };
      return { guardado: true, ...r };
    }
    case 'buscar_recuerdos': {
      const t = str(i.texto, 80);
      if (!t) return { error: 'Falta el texto a buscar.' };
      return { recuerdos: await memoria.buscarRecuerdos(t) };
    }
    case 'proponer_olvido': {
      const ids = (Array.isArray(i.ids) ? i.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
      if (!ids.length) return { error: 'No indicaste qué recuerdos olvidar.' };
      const r = await memoria.proponerOlvido({ ids, turno: ctx.mensajeUsuarioId });
      if (r.error) return { error: 'Esos recuerdos no existen.' };
      return {
        pendiente_de_confirmacion: true,
        se_olvidaria: r.recuerdos,
        instruccion: 'NO se ha borrado nada. Muéstrale a la dueña esta lista y pregúntale si confirma. Solo si ella responde que sí en su siguiente mensaje, llama a confirmar_olvido.',
      };
    }
    case 'confirmar_olvido': {
      const r = await memoria.confirmarOlvido({ turno: ctx.mensajeUsuarioId });
      if (r.error === 'no_hay_pendiente') return { error: 'No hay ningún borrado propuesto (o ya pasó más de un día). Propón de nuevo qué olvidar.' };
      if (r.error === 'falta_confirmacion') return { error: 'La dueña todavía no confirmó. Pregúntale y espera su respuesta en un mensaje nuevo.' };
      return { olvidado: true, ...r };
    }
    case 'cancelar_olvido':
      return memoria.cancelarOlvido();
    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}

// Devuelve siempre texto para el modelo. Nunca lanza.
export async function ejecutarHerramienta(nombre, input, ctx) {
  let datos;
  let esError = false;
  try {
    datos = await correr(nombre, input && typeof input === 'object' ? input : {}, ctx);
    if (datos && datos.error) esError = true;
  } catch (e) {
    console.error(`[herramienta:${nombre}]`, e?.code || '', String(e?.message || e).slice(0, 300));
    esError = true;
    datos = {
      error: `No pude consultar el sistema en este momento (${e?.code || 'error'}). Avísale a la dueña que contacte a su soporte técnico si sigue pasando.`,
    };
  }
  let texto = JSON.stringify(datos);
  if (texto.length > MAX_SALIDA) texto = texto.slice(0, MAX_SALIDA) + '…[resultado recortado: pide un filtro más específico]';
  return { texto, esError };
}
