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
`;
