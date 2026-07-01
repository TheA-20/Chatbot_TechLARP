import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

/**
 * POST /api/admin/modificaciones
 * El admin solicita al autor que modifique la actividad antes de aceptarla.
 * Establece estado = 'modificaciones' y guarda el feedback en notificaciones.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { edularp_id, notas } = await req.json()
  if (!notas?.trim()) {
    return NextResponse.json({ error: 'Las notas de modificación son obligatorias' }, { status: 400 })
  }

  try {
    const result = await sql`
      UPDATE edularp
      SET estado = 'modificaciones', feedback_admin = ${notas}
      WHERE id = ${edularp_id}
        AND estado IN ('revision', 'pending_review', 'lm_analyzed', 'under_review')
      RETURNING id, autor_id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Actividad no encontrada o no está en estado revisable' }, { status: 409 })
    }

    const larp = result[0]
    if (larp?.autor_id) {
      await sql`
        INSERT INTO notificaciones (usuario_id, edularp_id, tipo, mensaje)
        VALUES (${larp.autor_id}, ${edularp_id}, 'feedback',
          ${'Se han solicitado modificaciones en tu actividad: ' + notas})
      `
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[modificaciones] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
