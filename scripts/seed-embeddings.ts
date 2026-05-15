/**
 * scripts/seed-embeddings.ts
 * Genera y persiste embeddings vectoriales para todas las actividades
 * publicadas que aún no los tengan.
 *
 * Prerequisitos:
 *   1. Ollama corriendo en localhost:11434
 *   2. Modelo descargado: ollama pull nomic-embed-text
 *   3. Migración SQL ejecutada: sql/migration_vector_embeddings.sql
 *
 * Uso:
 *   npx tsx scripts/seed-embeddings.ts
 */

import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Cargar variables de entorno desde .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const EMBED_MODEL = 'nomic-embed-text'
const SIMILARITY_THRESHOLD = 0.4

const db = postgres(process.env.DATABASE_URL!, {
  max: 1,
  idle_timeout: 30,
})

// ─── Llamada a Ollama para obtener embedding ───────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama ${res.status}: ${body}`)
  }

  const data = await res.json() as { embedding: number[] }

  if (!Array.isArray(data.embedding) || data.embedding.length !== 768) {
    throw new Error(
      `Embedding inesperado: longitud ${data.embedding?.length} (esperado 768)`
    )
  }

  return data.embedding
}

// ─── Texto representativo en español para el embedding ────────────────────
function buildTextES(larp: Record<string, any>): string {
  return [
    larp.nombre,
    larp.descripcion,
    larp.storyboard,
    larp.asignaturas,
    larp.nivel_educativo,
    larp.materiales ?? '',
  ]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 2000) // Truncar para no exceder el límite del modelo
}

// ─── Texto representativo en inglés para el embedding ─────────────────────
// nomic-embed-text es multilingüe: indexar el mismo texto en inglés captura
// consultas en EN que busquen el mismo concepto en una actividad en ES
function buildTextEN(larp: Record<string, any>): string {
  return [
    larp.nombre,          // Los nombres TechLARP suelen ser en inglés
    larp.descripcion,
    larp.asignaturas,
    larp.nivel_educativo,
  ]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 2000)
}

// ─── Verificar que Ollama esté disponible ─────────────────────────────────
async function checkOllama(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { models: Array<{ name: string }> }
    const hasModel = data.models.some(m => m.name.startsWith('nomic-embed-text'))
    if (!hasModel) {
      console.error('❌ El modelo nomic-embed-text no está descargado.')
      console.error('   Ejecuta: ollama pull nomic-embed-text')
      process.exit(1)
    }
    console.log('✓ Ollama disponible con nomic-embed-text')
  } catch {
    console.error('❌ No se puede conectar a Ollama en', OLLAMA_URL)
    console.error('   Asegúrate de que Ollama esté corriendo: ollama serve')
    process.exit(1)
  }
}

// ─── Programa principal ────────────────────────────────────────────────────
async function main() {
  console.log('=== Seed de embeddings TechLARP ===\n')

  await checkOllama()

  // Obtener actividades sin embedding (o con embedding incompleto)
  const larps = await db`
    SELECT id, nombre, descripcion, storyboard, asignaturas,
           nivel_educativo, materiales
    FROM edularp
    WHERE embedding_es IS NULL OR embedding_en IS NULL
    ORDER BY creado_en ASC
  `

  if (larps.length === 0) {
    console.log('✓ Todas las actividades ya tienen embeddings. Nada que hacer.')
    await db.end()
    return
  }

  console.log(`Procesando ${larps.length} actividad(es) sin embedding...\n`)

  let ok = 0
  let fail = 0

  for (const larp of larps) {
    try {
      const textES = buildTextES(larp)
      const textEN = buildTextEN(larp)

      // Generar ambos embeddings en paralelo
      const [embES, embEN] = await Promise.all([
        getEmbedding(textES),
        getEmbedding(textEN),
      ])

      // pgvector espera el formato '[n1,n2,...,n768]'
      const vecES = `[${embES.join(',')}]`
      const vecEN = `[${embEN.join(',')}]`

      await db`
        UPDATE edularp
        SET
          embedding_es = ${vecES}::vector,
          embedding_en = ${vecEN}::vector
        WHERE id = ${larp.id}
      `

      console.log(`  ✓  ${larp.nombre}`)
      ok++
    } catch (err: any) {
      console.error(`  ✗  ${larp.nombre}: ${err.message}`)
      fail++
    }
  }

  console.log(`\n=== Resultado: ${ok} OK, ${fail} errores ===`)

  if (fail > 0) {
    console.log('   Vuelve a ejecutar el script para reintentar los errores.')
  }

  await db.end()
}

main()

// ─── Export para uso programático (ej. desde el endpoint de aprobación) ───
export { getEmbedding, buildTextES, buildTextEN, SIMILARITY_THRESHOLD }
