-- Migration: Add inclusion_index column and expand estado values
-- Run this once against the production DB

-- 1. Add inclusion_index JSONB column to edularp (stores designer + llm_proposal + final)
ALTER TABLE edularp
  ADD COLUMN IF NOT EXISTS inclusion_index JSONB;

-- 2. Expand estado CHECK constraint to include new workflow states
--    Legacy: borrador | revision | publicado | rechazado
--    New:    + pending_review | lm_analyzed | under_review
ALTER TABLE edularp
  DROP CONSTRAINT IF EXISTS edularp_estado_check;

ALTER TABLE edularp
  ADD CONSTRAINT edularp_estado_check
    CHECK (estado IN (
      'borrador',
      'revision',
      'pending_review',
      'lm_analyzed',
      'under_review',
      'publicado',
      'rechazado'
    ));

-- 3. Index for efficient admin queries on estado
CREATE INDEX IF NOT EXISTS idx_edularp_estado ON edularp(estado);

-- NOTE: misiones.inclusion column is kept for backward compatibility
--       but is no longer populated by the new form.
