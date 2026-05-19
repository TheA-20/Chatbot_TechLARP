-- Migración: añadir nombre_evaluador a sesiones_evaluacion
-- (el docente_id original era UUID de la tabla usuarios; ahora usamos nombre libre)
ALTER TABLE sesiones_evaluacion ADD COLUMN IF NOT EXISTS nombre_evaluador TEXT;
