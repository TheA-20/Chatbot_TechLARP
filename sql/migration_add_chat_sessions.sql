-- Migración: Añadir sistema de sesiones al chat
-- Fecha: 2026-04-23

-- Agregar campos de sesión a chat_historial
DO $$
BEGIN
  -- Agregar session_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_historial' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE chat_historial ADD COLUMN session_id UUID;
  END IF;

  -- Agregar session_title si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_historial' AND column_name = 'session_title'
  ) THEN
    ALTER TABLE chat_historial ADD COLUMN session_title TEXT;
  END IF;

  -- Agregar actualizado_en si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_historial' AND column_name = 'actualizado_en'
  ) THEN
    ALTER TABLE chat_historial ADD COLUMN actualizado_en TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Crear índice para búsquedas por sesión
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_historial(usuario_id, session_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_updated ON chat_historial(session_id, actualizado_en DESC);

-- Generar session_id para registros existentes (cada registro es su propia sesión)
UPDATE chat_historial 
SET session_id = id, 
    session_title = substring(mensaje_usuario, 1, 60)
WHERE session_id IS NULL;
