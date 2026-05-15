-- Migration: Add traduccion_de column to track translated LARP origin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'edularp' AND column_name = 'traduccion_de'
  ) THEN
    ALTER TABLE edularp
      ADD COLUMN traduccion_de UUID REFERENCES edularp(id) ON DELETE SET NULL;
    RAISE NOTICE 'Column traduccion_de added.';
  ELSE
    RAISE NOTICE 'Column traduccion_de already exists, skipping.';
  END IF;
END $$;
