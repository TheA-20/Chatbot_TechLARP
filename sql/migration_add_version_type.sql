-- Migración: Añadir campo tipo_version a tabla edularp
-- Fecha: 2026-04-23

-- Verificar si la columna ya existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'edularp' AND column_name = 'tipo_version'
  ) THEN
    ALTER TABLE edularp 
    ADD COLUMN tipo_version TEXT NOT NULL DEFAULT 'original'
    CHECK (tipo_version IN ('original','traducida','modificada'));
  END IF;
END $$;
