import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'
import { runChatEngine } from '@/lib/chat-engine'

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { mensaje, historial = [], locale = 'es', sessionId = null, contextLarps = [] } = await req.json()
  if (!mensaje?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  if (mensaje.length > 2000) return NextResponse.json({ error: 'Mensaje demasiado largo (máx. 2000 caracteres)' }, { status: 400 })
  if (!Array.isArray(historial) || historial.length > 20) return NextResponse.json({ error: 'Historial inválido o demasiado largo (máx. 20 turnos)' }, { status: 400 })
  if (!Array.isArray(contextLarps) || contextLarps.length > 10) return NextResponse.json({ error: 'contextLarps inválido o demasiado largo (máx. 10 actividades)' }, { status: 400 })

  // Determinar si necesitamos crear una nueva sesión
  let currentSessionId = sessionId
  let sessionTitle = ''

  // 2-8. Ejecutar motor de chat compartido
  let textoRespuesta = ''
  let larpsParaDescargaFinal: any[] = []
  let openPreview = false
  let matchedLarps: any[] = []
  let allLarps: any[] = []

  try {
    const result = await runChatEngine({ mensaje, historial, locale, contextLarps })
    textoRespuesta = result.textoRespuesta
    larpsParaDescargaFinal = result.larpsParaDescargaFinal
    openPreview = result.openPreview
    matchedLarps = result.matchedLarps
    allLarps = result.allLarps
  } catch (err: any) {
    console.error('[API /chat] Chat engine error:', err)
    console.error('[API /chat] Error details:', {
      message: err?.message,
      stack: err?.stack?.split('\n').slice(0, 3).join('\n'),
      status: err?.status,
      code: err?.code,
    })
    const isEN = locale === 'en'
    if (err?.isRateLimit || err?.message === 'RATE_LIMIT_EXHAUSTED') {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        respuesta: isEN
          ? '⏳ The assistant is receiving too many requests right now. Wait a few seconds and try again.'
          : '⏳ El asistente está recibiendo demasiadas consultas en este momento. Espera unos segundos e inténtalo de nuevo.',
      }, { status: 429 })
    }
    return NextResponse.json({
      error: 'Error al contactar el servicio de IA',
      respuesta: isEN
        ? '⚠️ Could not connect to the AI service. Please try again later.'
        : '⚠️ No se pudo conectar con el servicio de IA. Inténtalo de nuevo más tarde.',
    }, { status: 500 })
  }

  const larpsUsados = larpsParaDescargaFinal.map((l: any) => l.id)

  // Persistencia — sesión del usuario
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID()
    if (matchedLarps.length > 0) {
      sessionTitle = matchedLarps[0].nombre
    } else {
      const countResult = await sql`
        SELECT COUNT(DISTINCT session_id)::int AS total
        FROM chat_historial
        WHERE usuario_id = ${(session.user as any).id}
          AND session_title LIKE 'Búsqueda de actividad %'
      `
      const nextNum = (countResult[0]?.total ?? 0) + 1
      sessionTitle = `Búsqueda de actividad ${nextNum}`
    }
  } else {
    const existingSession = await sql`
      SELECT session_title FROM chat_historial 
      WHERE session_id = ${currentSessionId} AND usuario_id = ${(session.user as any).id}
      LIMIT 1
    `
    sessionTitle = existingSession.length > 0 ? existingSession[0].session_title : (matchedLarps.length > 0 ? matchedLarps[0].nombre : mensaje.substring(0, 60))
  }

  await sql`
    INSERT INTO chat_historial (
      usuario_id, session_id, session_title, mensaje_usuario, respuesta_bot, larps_usados, actualizado_en
    )
    VALUES (
      ${(session.user as any).id},
      ${currentSessionId},
      ${sessionTitle},
      ${mensaje},
      ${textoRespuesta},
      ${larpsUsados},
      now()
    )
  `

  return NextResponse.json({
    respuesta: textoRespuesta,
    sessionId: currentSessionId,
    sessionTitle: sessionTitle,
    larps_encontrados: larpsParaDescargaFinal.length,
    larps: larpsParaDescargaFinal.map((l: any) => ({ id: l.id, nombre: l.nombre, similitud: Number(l.similitud ?? 0) })),
    rag_activo: matchedLarps.length > 0,
    openPreview,
  })
}

// Obtener historial del docente actual
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const historial = await sql`
    SELECT id, mensaje_usuario, respuesta_bot, creado_en
    FROM chat_historial
    WHERE usuario_id = ${(session.user as any).id}
    ORDER BY creado_en DESC
    LIMIT 50
  `
  return NextResponse.json({ historial })
}
