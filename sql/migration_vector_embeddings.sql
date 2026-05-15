-- ═══════════════════════════════════════════════════════
-- Migración: columnas vectoriales bilingües + índices HNSW
-- Ejecutar UNA SOLA VEZ contra PostgreSQL Docker
-- Comando: docker exec -i edularp-postgres psql -U postgres -d edularp < sql/migration_vector_embeddings.sql
-- ═══════════════════════════════════════════════════════

-- Asegurar que pgvector esté activo (idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────
-- AÑADIR columnas vectoriales de 768 dims
-- (nomic-embed-text produce vectores de 768 dimensiones)
-- La columna embedding vector(1536) existente se conserva sin tocar
-- ─────────────────────────────────────────────
ALTER TABLE edularp
  ADD COLUMN IF NOT EXISTS embedding_es vector(768),
  ADD COLUMN IF NOT EXISTS embedding_en vector(768);

-- ─────────────────────────────────────────────
-- ÍNDICES HNSW para búsqueda por similitud coseno
-- hnsw es más rápido que ivfflat para conjuntos pequeños (<100k filas)
-- m=16 y ef_construction=64 son valores seguros para colecciones <10k actividades
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edularp_embedding_es
  ON edularp USING hnsw (embedding_es vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_edularp_embedding_en
  ON edularp USING hnsw (embedding_en vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────────
-- Verificar el resultado
-- ─────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'edularp'
  AND column_name IN ('embedding', 'embedding_es', 'embedding_en')
ORDER BY column_name;
