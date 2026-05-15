import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const usuarioId = (session.user as any).id

  // Obtener sesiones agrupadas (la más reciente de cada session_id)
  const sesiones = await sql`
    SELECT DISTINCT ON (session_id)
      session_id,
      session_title,
      respuesta_bot,
      actualizado_en,
      (
        SELECT COUNT(*)::int 
        FROM chat_historial ch2 
        WHERE ch2.session_id = chat_historial.session_id 
          AND ch2.usuario_id = ${usuarioId}
      ) as mensaje_count
    FROM chat_historial
    WHERE usuario_id = ${usuarioId}
    ORDER BY session_id, actualizado_en DESC
  `

  // Ordenar por actualizado_en más reciente
  const sesionesOrdenadas = sesiones.sort((a: any, b: any) => 
    new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime()
  ).slice(0, 40)

  return NextResponse.json({
    historial: sesionesOrdenadas.map((s: any) => ({
      sessionId: s.session_id,
      titulo: s.session_title || 'Conversación',
      preview: (s.respuesta_bot ?? '').slice(0, 80),
      actualizado: s.actualizado_en,
      mensajeCount: s.mensaje_count,
    })),
  })
}
