-- Migración: idioma_original + veces_modificada en tabla edularp
-- Ejecutar una sola vez en producción

DO $$
BEGIN
  -- Idioma en que fue creada la actividad ('es' | 'en')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'edularp' AND column_name = 'idioma_original'
  ) THEN
    ALTER TABLE edularp
      ADD COLUMN idioma_original TEXT NOT NULL DEFAULT 'es'
        CHECK (idioma_original IN ('es','en'));
  END IF;

  -- Número de veces que la actividad ha sido editada tras publicarse
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'edularp' AND column_name = 'veces_modificada'
  ) THEN
    ALTER TABLE edularp
      ADD COLUMN veces_modificada INT NOT NULL DEFAULT 0;
  END IF;
END $$;
