// Configuración central. Todo lo que cambia entre clientes o ambientes vive aquí o en variables de entorno.

export const IDENTIDAD = {
  // Respuesta fija cuando preguntan quién hizo la IA. Cambie aquí si hace falta.
  creador: 'Faiiryz (Carlos Abrego Pavón), CEO de Teocalli Dev',
};

export function cfg() {
  const env = process.env;
  return {
    asistente: env.ASSISTANT_NAME || 'Fénix IA',
    negocio: env.BUSINESS_NAME || 'Fénix Recolección y Envíos',
    dueña: env.OWNER_NAME || '',
    tz: env.BUSINESS_TZ || 'America/Tijuana',
    modelo: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
    apiKey: env.ANTHROPIC_API_KEY || '',
    apiBase: (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
    pensar: (env.ANTHROPIC_THINKING || 'off').toLowerCase() === 'adaptive',
    limiteDiario: Math.max(1, parseInt(env.DAILY_MESSAGE_LIMIT || '250', 10) || 250),
  };
}

export function modos() {
  const c = cfg();
  return {
    ia: c.apiKey ? 'real' : 'demo',
    datos: process.env.DATABASE_URL_LECTURA ? 'real' : 'demo',
    memoria: process.env.DATABASE_URL_MEMORIA ? 'real' : 'local',
  };
}

// Fecha y hora actual en la zona del negocio, en texto legible.
export function ahoraTexto(d = new Date()) {
  const { tz } = cfg();
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d);
}

export function hoyISO(d = new Date()) {
  const { tz } = cfg();
  // en-CA entrega YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}
