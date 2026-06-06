import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { edularp_id, motivo } = await req.json()
  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo de rechazo es obligatorio' }, { status: 400 })
  }

  const result = await sql`
    UPDATE edularp
    SET estado = 'rechazado', feedback_admin = ${motivo}
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
      VALUES (${larp.autor_id}, ${edularp_id}, 'rechazado', ${motivo})
    `
  }

  return NextResponse.json({ ok: true })
}
