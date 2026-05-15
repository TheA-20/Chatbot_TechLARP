import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const usuarioId = (session.user as any).id
  const { sessionId } = params

  // Obtener todos los mensajes de esta sesión
  const mensajes = await sql`
    SELECT
      id,
      mensaje_usuario,
      respuesta_bot,
      creado_en
    FROM chat_historial
    WHERE usuario_id = ${usuarioId} AND session_id = ${sessionId}
    ORDER BY creado_en ASC
  `

  if (mensajes.length === 0) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    sessionId: sessionId,
    mensajes: mensajes.map((m: any) => ({
      id: m.id,
      usuario: m.mensaje_usuario,
      bot: m.respuesta_bot,
      creado: m.creado_en,
    })),
  })
}
