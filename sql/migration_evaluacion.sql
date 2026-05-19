-- ═══════════════════════════════════════════════════════
-- Migración: Módulo de evaluación del agente conversacional
-- Tablas completamente aisladas — no modifica nada existente
-- ═══════════════════════════════════════════════════════

-- Sesiones de evaluación (autenticación ligera por ID de docente)
CREATE TABLE IF NOT EXISTS sesiones_evaluacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  docente_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en   TIMESTAMPTZ DEFAULT now(),
  expira_en   TIMESTAMPTZ DEFAULT now() + INTERVAL '48 hours'
);

CREATE INDEX IF NOT EXISTS idx_eval_token ON sesiones_evaluacion(token);

-- Historial de conversaciones de evaluación
CREATE TABLE IF NOT EXISTS chat_evaluacion_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id       UUID REFERENCES sesiones_evaluacion(id) ON DELETE CASCADE,
  escenario       INT CHECK (escenario BETWEEN 1 AND 5),
  mensaje_usuario TEXT NOT NULL,
  respuesta_bot   TEXT,
  larps_usados    UUID[],
  creado_en       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eval_historial_sesion ON chat_evaluacion_historial(sesion_id, creado_en);
