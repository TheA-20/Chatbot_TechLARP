import { NextRequest, NextResponse } from 'next/server'
import { runChatEngine } from '@/lib/chat-engine'

// Rate-limit simple por IP para el modo invitado (sin sesion persistida)
const guestRequests = new Map<string, { count: number; resetAt: number }>()
const GUEST_LIMIT = 30        // max requests por ventana
const GUEST_WINDOW_MS = 60_000 // 1 minuto

function checkGuestRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = guestRequests.get(ip)
  if (!entry || entry.resetAt < now) {
    guestRequests.set(ip, { count: 1, resetAt: now + GUEST_WINDOW_MS })
    return true
  }
  if (entry.count >= GUEST_LIMIT) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  // Rate limit por IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkGuestRateLimit(ip)) {
    return NextResponse.json({
      error: 'Rate limit',
      respuesta: 'Has enviado demasiados mensajes. Espera un momento e inténtalo de nuevo.',
    }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { mensaje, historial = [], locale = 'es', contextLarps = [] } = body

  if (!mensaje?.trim()) return NextResponse.json({ error: 'Mensaje vacio' }, { status: 400 })
  if (mensaje.length > 2000) return NextResponse.json({ error: 'Mensaje demasiado largo' }, { status: 400 })
  if (!Array.isArray(historial) || historial.length > 20) return NextResponse.json({ error: 'Historial invalido' }, { status: 400 })

  try {
    const result = await runChatEngine({ mensaje, historial, locale, contextLarps })

    return NextResponse.json({
      respuesta:   result.textoRespuesta,
      larps:       result.larpsParaDescargaFinal.map((l: any) => ({ id: l.id, nombre: l.nombre })),
      openPreview: result.openPreview,
    })
  } catch (err: any) {
    const isEN = locale === 'en'
    if (err?.isRateLimit || err?.message === 'RATE_LIMIT_EXHAUSTED') {
      return NextResponse.json({
        error: 'Rate limit',
        respuesta: isEN
          ? 'The assistant is too busy right now. Try again in a few seconds.'
          : 'El asistente esta recibiendo demasiadas consultas. Espera unos segundos.',
      }, { status: 429 })
    }
    console.error('[invitado/chat] Error:', err?.message)
    return NextResponse.json({
      error: 'Error interno',
      respuesta: isEN
        ? 'Could not connect to the AI service. Please try again.'
        : 'No se pudo conectar con el servicio de IA. Intentalo de nuevo.',
    }, { status: 500 })
  }
}
