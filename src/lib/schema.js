// Esquema de la base de la IA (base NUEVA, separada de envios_ayora). Es idempotente.
export const ESQUEMA_SQL = `
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL DEFAULT 'Nuevo chat',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mensajes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('user','assistant')),
  contenido TEXT NOT NULL,
  tokens_in INT,
  tokens_out INT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mensajes_chat_idx ON mensajes (chat_id, id);
CREATE INDEX IF NOT EXISTS chats_actualizado_idx ON chats (actualizado_en DESC);
ALTER TABLE chats ADD COLUMN IF NOT EXISTS fijado BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS recuerdos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria TEXT NOT NULL DEFAULT 'dato',
  contenido TEXT NOT NULL,
  origen_chat UUID,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS olvidos_pendientes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recuerdo_ids BIGINT[] NOT NULL,
  turno BIGINT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS uso_diario (
  dia DATE PRIMARY KEY,
  mensajes INT NOT NULL DEFAULT 0,
  tokens_in BIGINT NOT NULL DEFAULT 0,
  tokens_out BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plantillas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  contenido TEXT NOT NULL,
  contenido_anterior TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recolectores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero INT UNIQUE,
  nombre TEXT NOT NULL,
  ciudad TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'foraneo' CHECK (tipo IN ('directo','foraneo')),
  activo BOOLEAN NOT NULL DEFAULT true,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS folios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  folio TEXT NOT NULL,
  fecha_recepcion DATE NOT NULL,
  sucursal_origen TEXT,
  sucursal_destino TEXT,
  remitente TEXT,
  destinatario TEXT,
  tamano TEXT,
  precio NUMERIC(10,2),
  recolector_numero INT,
  clasificacion TEXT NOT NULL DEFAULT 'sin_clasificar',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','recogido')),
  fecha_recogido DATE,
  veces_enviado INT NOT NULL DEFAULT 1,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS folios_estado_idx ON folios (estado, fecha_recepcion);
CREATE TABLE IF NOT EXISTS propuestas_folios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  turno BIGINT NOT NULL,
  datos JSONB NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pagos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente TEXT NOT NULL,
  total NUMERIC(10,2),
  semana_de DATE NOT NULL,
  fecha_limite DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','comprobante_recibido','pagado')),
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pagos_estado_idx ON pagos (estado, semana_de);
`;
