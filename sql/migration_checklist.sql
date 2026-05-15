-- ═══════════════════════════════════════════════════════
-- Migración: campos del checklist TechLARP
-- ═══════════════════════════════════════════════════════

-- 1. Ampliar el enum de tipo en cartas_juego para incluir figura_historica
ALTER TABLE cartas_juego DROP CONSTRAINT IF EXISTS cartas_juego_tipo_check;
ALTER TABLE cartas_juego ADD CONSTRAINT cartas_juego_tipo_check
  CHECK (tipo IN ('personaje','habilidad','objeto','evento','figura_historica','otro'));

-- 2. Añadir campo descripcion a cartas_juego
ALTER TABLE cartas_juego ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 3. Añadir recursos globales (JSONB) a edularp
ALTER TABLE edularp ADD COLUMN IF NOT EXISTS recursos_globales JSONB;

-- 4. Añadir array de URLs de imágenes a edularp
ALTER TABLE edularp ADD COLUMN IF NOT EXISTS imagenes_urls TEXT[] DEFAULT '{}';
