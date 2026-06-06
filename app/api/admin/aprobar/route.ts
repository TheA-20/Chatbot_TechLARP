import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

// SSRF guard: OLLAMA_URL must point to localhost only
function validateOllamaUrl(raw: string): string {
  let parsed: URL
  try { parsed = new URL(raw) } catch {
    throw new Error(`[aprobar] OLLAMA_URL is not a valid URL: "${raw}"`)
  }
  const allowed = ['localhost', '127.0.0.1', '::1']
  if (!allowed.includes(parsed.hostname)) {
    throw new Error(`[aprobar] OLLAMA_URL hostname "${parsed.hostname}" is not allowed.`)
  }
  return raw
}

const OLLAMA_URL = validateOllamaUrl(process.env.OLLAMA_URL ?? 'http://localhost:11434')

// Genera el embedding de una actividad recién aprobada y lo persiste en la BD.
// Fire-and-forget: los errores se loguean pero no bloquean la respuesta al admin.
async function generarEmbeddingTrasAprobacion(edularpId: string): Promise<void> {
  try {
    const [larp] = await sql`
      SELECT nombre, descripcion, storyboard, asignaturas, nivel_educativo, materiales
      FROM edularp WHERE id = ${edularpId}
    `
    if (!larp) return

    const textES = [larp.nombre, larp.descripcion, larp.storyboard, larp.asignaturas, larp.nivel_educativo, larp.materiales ?? '']
      .filter(Boolean).join(' | ').slice(0, 2000)

    const textEN = [larp.nombre, larp.descripcion, larp.asignaturas, larp.nivel_educativo]
      .filter(Boolean).join(' | ').slice(0, 2000)

    const [resES, resEN] = await Promise.all([
      fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: textES }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: textEN }),
        signal: AbortSignal.timeout(10000),
      }),
    ])

    if (!resES.ok || !resEN.ok) {
      console.warn('[RAG] Ollama no disponible al aprobar actividad — embedding pendiente para:', edularpId)
      return
    }

    const { embedding: embES } = await resES.json() as { embedding: number[] }
    const { embedding: embEN } = await resEN.json() as { embedding: number[] }

    if (embES?.length === 768 && embEN?.length === 768) {
      await sql`
        UPDATE edularp
        SET embedding_es = ${`[${embES.join(',')}]`}::vector,
            embedding_en = ${`[${embEN.join(',')}]`}::vector
        WHERE id = ${edularpId}
      `
      console.log('[RAG] Embedding generado para actividad aprobada:', edularpId)
    }
  } catch (err: any) {
    console.error('[RAG] Error generando embedding en aprobación:', err.message)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { edularp_id, feedback } = await req.json()

  const result = await sql`
    UPDATE edularp
    SET estado = 'publicado', feedback_admin = ${feedback ?? null}
    WHERE id = ${edularp_id}
      AND estado IN ('revision', 'lm_analyzed')
    RETURNING id, autor_id
  `
  if (result.length === 0) {
    return NextResponse.json({ error: 'Actividad no encontrada o no está en estado revisable' }, { status: 409 })
  }

  // Notificar al autor
  const larp = result[0]
  if (larp?.autor_id) {
    await sql`
      INSERT INTO notificaciones (usuario_id, edularp_id, tipo, mensaje)
      VALUES (${larp.autor_id}, ${edularp_id}, 'aprobado', ${feedback ?? 'Tu actividad ha sido publicada.'})
    `
  }

  // Generar embedding para que la actividad sea recuperable por RAG inmediatamente
  // No awaited: la respuesta al admin no espera a Ollama
  generarEmbeddingTrasAprobacion(edularp_id)

  return NextResponse.json({ ok: true })
}
