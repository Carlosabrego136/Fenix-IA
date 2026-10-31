// Herramientas que la IA puede usar: consultas de solo lectura al sistema de envíos y manejo de su memoria.
import * as L from './lectura.js';
import { memoria, CATEGORIAS } from './memoria.js';
import * as N from './negocio.js';

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
        paqueteria: { type: 'string', description: 'Nombre de la paquetería (FedEx, DHL, Estafeta, Paquete Expres, Bajapack, Volaris). La búsqueda ignora mayúsculas, acentos y letras dobles, así que "Express" y "Expres" dan lo mismo.' },
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
  {
    name: 'proponer_folios',
    description:
      'Primer paso para registrar folios (números de guía) de PZ Express leídos de tickets, fotos o una lista. NO guarda nada: valida, detecta duplicados (ya registrados o repetidos en la lista), calcula días transcurridos y el último día sin multa, y clasifica el recolector si la etiqueta dice AYORA / nombre / número. Después muéstrale a la dueña el resultado y pide confirmación. Fecha de recepción en formato AAAA-MM-DD. Si una cifra de la foto es dudosa, NO la adivines: pregúntale.',
    input_schema: {
      type: 'object',
      properties: {
        folios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              folio: { type: 'string', description: 'Número de guía / folio tal como aparece.' },
              fecha_recepcion: { type: 'string', description: 'Fecha de «Recepción» del ticket, AAAA-MM-DD.' },
              sucursal_origen: { type: 'string' }, sucursal_destino: { type: 'string' },
              remitente: { type: 'string' }, destinatario: { type: 'string' },
              tamano: { type: 'string' }, precio: { type: 'number' }, notas: { type: 'string', description: 'Ej.: formato (digital/manual) o lo escrito a mano como "Cajón 29 envíos Ayora".' },
              recolector_numero: { type: 'integer', description: 'SOLO si la etiqueta lo dice o la dueña lo confirmó (1 a 11).' },
            },
            required: ['folio', 'fecha_recepcion'],
          },
        },
      },
      required: ['folios'],
    },
  },
  {
    name: 'confirmar_folios',
    description: 'Segundo paso: guarda los folios propuestos. Solo funciona si la dueña confirmó en un mensaje NUEVO posterior a la propuesta. Nunca la llames en el mismo turno que proponer_folios.',
    input_schema: { type: 'object', properties: {} },
  },
  { name: 'cancelar_folios', description: 'Descarta la propuesta de folios cuando la dueña dice que no o quiere corregir.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'editar_folio',
    description: 'Corrige datos de un folio ya registrado (fecha de recepción, recolector, destinatario, notas…). Recibe el folio completo o sus últimos dígitos.',
    input_schema: {
      type: 'object',
      properties: {
        folio: { type: 'string' },
        cambios: { type: 'object', properties: {
          fecha_recepcion: { type: 'string' }, sucursal_origen: { type: 'string' }, sucursal_destino: { type: 'string' },
          remitente: { type: 'string' }, destinatario: { type: 'string' }, tamano: { type: 'string' },
          precio: { type: 'number' }, recolector_numero: { type: 'integer' }, notas: { type: 'string' } } },
      },
      required: ['folio', 'cambios'],
    },
  },
  {
    name: 'marcar_folios',
    description: 'Marca folios como recogidos (ya los recogió en la paquetería) o los regresa a pendientes. Avisa cuáles no encontró. Úsala cuando ella diga "ya recogí estos".',
    input_schema: {
      type: 'object',
      properties: {
        folios: { type: 'array', items: { type: 'string' } },
        estado: { type: 'string', enum: ['recogido', 'pendiente'] },
        fecha: { type: 'string', description: 'Fecha en que se recogieron (AAAA-MM-DD). Por defecto hoy.' },
      },
      required: ['folios', 'estado'],
    },
  },
  {
    name: 'resumen_folios',
    description: 'Estado de los folios pendientes: cuáles tienen hoy/mañana su último día sin multa, cuáles ya cumplieron 14 días, cuáles están a punto de decomiso (60) y cuáles están a 10-11 días; también los agrupa por recolector foráneo para avisarle a cada uno. Úsala para "qué folios están por vencer", "cómo van mis folios".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'buscar_folios',
    description: 'Busca folios registrados por número (o últimos dígitos), nombre de remitente/destinatario o notas; filtra por estado, recolector o mínimo de días. También sirve para ver si un folio ya estaba (duplicados).',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string' }, estado: { type: 'string', enum: ['pendiente', 'recogido'] },
        recolector_numero: { type: 'integer' }, min_dias: { type: 'integer' }, limite: { type: 'integer' },
      },
    },
  },
  {
    name: 'registrar_pago',
    description: 'Anota un pago semanal que se espera de un cliente (total, semana y fecha límite). No verifica depósitos ni ve Messenger: solo lleva el control que la dueña le dicta.',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string' }, total: { type: 'number' }, semana_de: { type: 'string', description: 'AAAA-MM-DD de la semana (por defecto hoy).' },
        fecha_limite: { type: 'string', description: 'AAAA-MM-DD' }, notas: { type: 'string' },
      },
      required: ['cliente'],
    },
  },
  {
    name: 'actualizar_pago',
    description: 'Cambia el estado de un pago: pendiente, comprobante_recibido (ella vio el comprobante) o pagado. Solo según lo que ella te diga.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' }, estado: { type: 'string', enum: ['pendiente', 'comprobante_recibido', 'pagado'] },
        notas: { type: 'string' }, total: { type: 'number' }, fecha_limite: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'listar_pagos',
    description: 'Lista pagos registrados. estado "abiertos" = los que no están pagados.',
    input_schema: {
      type: 'object',
      properties: { estado: { type: 'string', enum: ['abiertos', 'pendiente', 'comprobante_recibido', 'pagado'] }, cliente: { type: 'string' }, limite: { type: 'integer' } },
    },
  },
  {
    name: 'listar_plantillas',
    description: 'Lista las plantillas de texto guardadas (dinámica de recolección, cotización, mensajes de servicio, publicaciones…).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'obtener_plantilla',
    description: 'Trae el texto completo de una plantilla por su nombre (por ejemplo dinamica_recoleccion, cotizacion, pedir_comprobante). Úsalo siempre que haya que mandar un texto de la dueña, y respétalo fielmente.',
    input_schema: { type: 'object', properties: { nombre: { type: 'string' } }, required: ['nombre'] },
  },
  {
    name: 'guardar_plantilla',
    description: 'Crea o actualiza una plantilla con el texto EXACTO que la dueña te dio o aprobó. Se guarda la versión anterior. Nunca incluyas números de tarjeta, CLABE ni datos bancarios.',
    input_schema: {
      type: 'object',
      properties: { nombre: { type: 'string', description: 'Nombre corto sin espacios, p. ej. cotizacion.' }, descripcion: { type: 'string' }, contenido: { type: 'string' } },
      required: ['nombre', 'contenido'],
    },
  },
  {
    name: 'cotizar',
    description:
      'Cotiza con el tabulador 2026 de la dueña (1 a 60 kg, escalones de 5 kg): calcula peso volumétrico, peso facturable y precios aéreo/terrestre (y Baja Pack Express para clientes de zona fronteriza), y devuelve el mensaje listo con su formato. Úsala SIEMPRE para cotizar; nunca calcules ni inventes precios tú. Más de 60 kg = cotización especial a mano.',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nombre del cliente para el saludo (opcional).' },
        cajas: {
          type: 'array',
          items: { type: 'object', properties: { peso_real_kg: { type: 'number' }, largo_cm: { type: 'number' }, ancho_cm: { type: 'number' }, alto_cm: { type: 'number' } } },
        },
        zona_extendida: { type: 'boolean', description: 'true si el destino es zona extendida (+$280 una sola vez). Si no lo sabes, usa false y avísale al final.' },
        incluir_bajapack: { type: 'boolean', description: 'true solo si el cliente es de zona fronteriza (agrega la opción Baja Pack Express).' },
      },
      required: ['cajas'],
    },
  },
  {
    name: 'peso_volumetrico',
    description: 'Calcula el peso volumétrico (largo x ancho x alto / 5000) y el peso facturable por bloques de 5 kg para cotizar. No calcula precios.',
    input_schema: {
      type: 'object',
      properties: { largo_cm: { type: 'number' }, ancho_cm: { type: 'number' }, alto_cm: { type: 'number' }, peso_real_kg: { type: 'number' }, cajas: { type: 'integer' } },
      required: ['largo_cm', 'ancho_cm', 'alto_cm'],
    },
  },
  {
    name: 'buscar_recolectores',
    description: 'Busca recolectores foráneos por número, nombre o ciudad (el número es el que aparece en la etiqueta AYORA / nombre / número).',
    input_schema: { type: 'object', properties: { texto: { type: 'string' }, numero: { type: 'integer' } } },
  },
  {
    name: 'guardar_recolector',
    description: 'Agrega o corrige un recolector foráneo (número, nombre, ciudad).',
    input_schema: {
      type: 'object',
      properties: { numero: { type: 'integer' }, nombre: { type: 'string' }, ciudad: { type: 'string' }, tipo: { type: 'string', enum: ['directo', 'foraneo'] }, activo: { type: 'boolean' } },
      required: ['nombre'],
    },
  }
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
      if (N.tieneDatosBancarios(contenido)) return { error: 'No se guardan números de tarjeta ni cuentas bancarias en la memoria.' };
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
    case 'proponer_folios': {
      const r = await N.proponerFolios({ turno: ctx.mensajeUsuarioId, folios: Array.isArray(i.folios) ? i.folios : [] });
      return r;
    }
    case 'confirmar_folios': {
      const r = await N.confirmarFolios({ turno: ctx.mensajeUsuarioId });
      if (r.error === 'no_hay_pendiente') return { error: 'No hay folios propuestos (o ya pasó más de un día). Vuelve a proponerlos.' };
      if (r.error === 'falta_confirmacion') return { error: 'La dueña todavía no confirmó. Muéstrale la lista y espera su respuesta en un mensaje nuevo.' };
      return r;
    }
    case 'cancelar_folios':
      return N.cancelarFolios();
    case 'editar_folio':
      return N.editarFolio({ folio: str(i.folio, 40), cambios: i.cambios && typeof i.cambios === 'object' ? i.cambios : {} });
    case 'marcar_folios':
      return N.marcarFolios({ folios: Array.isArray(i.folios) ? i.folios.map((x) => String(x)) : [], estado: i.estado, fecha: str(i.fecha, 10) });
    case 'resumen_folios':
      return N.resumenFolios();
    case 'buscar_folios':
      return N.buscarFolios({ texto: str(i.texto, 60), estado: str(i.estado, 12), recolector_numero: Number.isInteger(i.recolector_numero) ? i.recolector_numero : undefined, min_dias: Number.isInteger(i.min_dias) ? i.min_dias : undefined, limite: num(i.limite) });
    case 'registrar_pago':
      return N.registrarPago({ cliente: i.cliente, total: i.total, semana_de: str(i.semana_de, 10), fecha_limite: str(i.fecha_limite, 10), notas: i.notas });
    case 'actualizar_pago':
      return N.actualizarPago({ id: Number.isInteger(num(i.id)) ? num(i.id) : undefined, estado: str(i.estado, 30), notas: i.notas, total: i.total, fecha_limite: str(i.fecha_limite, 10) });
    case 'listar_pagos':
      return N.listarPagos({ estado: str(i.estado, 30), cliente: str(i.cliente, 80), limite: num(i.limite) });
    case 'listar_plantillas':
      return N.listarPlantillas();
    case 'obtener_plantilla':
      return N.obtenerPlantilla({ nombre: str(i.nombre, 80) });
    case 'guardar_plantilla':
      return N.guardarPlantilla({ nombre: i.nombre, descripcion: i.descripcion, contenido: i.contenido });
    case 'cotizar':
      return N.cotizar({ cliente: str(i.cliente, 80), cajas: Array.isArray(i.cajas) ? i.cajas : [], zona_extendida: i.zona_extendida === true, incluir_bajapack: i.incluir_bajapack === true });
    case 'peso_volumetrico':
      return N.pesoVolumetrico({ largo_cm: i.largo_cm, ancho_cm: i.ancho_cm, alto_cm: i.alto_cm, peso_real_kg: i.peso_real_kg, cajas: i.cajas });
    case 'buscar_recolectores':
      return N.buscarRecolectores({ texto: str(i.texto, 60), numero: Number.isInteger(i.numero) ? i.numero : undefined });
    case 'guardar_recolector':
      return N.guardarRecolector({ numero: Number.isInteger(i.numero) ? i.numero : undefined, nombre: i.nombre, ciudad: i.ciudad, tipo: i.tipo, activo: bool(i.activo) });
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
