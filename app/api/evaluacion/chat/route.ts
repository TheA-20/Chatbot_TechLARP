import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { runChatEngine } from '@/lib/chat-engine'

export async function POST(req: NextRequest) {
  // 1. Leer y validar token de evaluación desde cookie
  const token = req.cookies.get('eval_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Sesión de evaluación no encontrada' }, { status: 401 })
  }

  // Verificar token en BD y que no haya expirado
  const [sesion] = await sql`
    SELECT id, docente_id FROM sesiones_evaluacion
    WHERE token = ${token}
      AND expira_en > now()
  `
  if (!sesion) {
    return NextResponse.json({ error: 'Sesión expirada o no válida' }, { status: 401 })
  }

  const { mensaje, historial = [], locale = 'es', contextLarps = [], escenario = null } = await req.json()
  if (!mensaje?.trim()) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  }

  // 2. Ejecutar motor de chat compartido (misma lógica que /api/chat)
  let textoRespuesta = ''
  let larpsParaDescargaFinal: any[] = []
  let openPreview = false
  let matchedLarps: any[] = []

  try {
    const result = await runChatEngine({ mensaje, historial, locale, contextLarps })
    textoRespuesta = result.textoRespuesta
    larpsParaDescargaFinal = result.larpsParaDescargaFinal
    openPreview = result.openPreview
    matchedLarps = result.matchedLarps
  } catch (err: any) {
    console.error('[Evaluación] Chat engine error:', err)
    const isEN = locale === 'en'
    return NextResponse.json({
      error: 'Error al contactar el servicio de IA',
      respuesta: isEN
        ? '⚠️ Could not connect to the AI service. Please try again later.'
        : '⚠️ No se pudo conectar con el servicio de IA. Inténtalo de nuevo más tarde.',
    }, { status: 500 })
  }

  // 3. Persistir en tabla propia de evaluación (no mezcla con chat_historial)
  const larpsUsados = larpsParaDescargaFinal.map((l: any) => l.id)
  await sql`
    INSERT INTO chat_evaluacion_historial (
      sesion_id, escenario, mensaje_usuario, respuesta_bot, larps_usados
    ) VALUES (
      ${sesion.id},
      ${escenario},
      ${mensaje},
      ${textoRespuesta},
      ${larpsUsados}
    )
  `

  return NextResponse.json({
    respuesta: textoRespuesta,
    larps: larpsParaDescargaFinal.map((l: any) => ({ id: l.id, nombre: l.nombre, similitud: Number(l.similitud ?? 0) })),
    larps_encontrados: larpsParaDescargaFinal.length,
    rag_activo: matchedLarps.length > 0,
    openPreview,
  })
}
