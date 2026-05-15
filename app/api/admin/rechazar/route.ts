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

  await sql`
    UPDATE edularp
    SET estado = 'rechazado', feedback_admin = ${motivo}
    WHERE id = ${edularp_id}
  `

  const [larp] = await sql`SELECT autor_id FROM edularp WHERE id = ${edularp_id}`
  if (larp?.autor_id) {
    await sql`
      INSERT INTO notificaciones (usuario_id, edularp_id, tipo, mensaje)
      VALUES (${larp.autor_id}, ${edularp_id}, 'rechazado', ${motivo})
    `
  }

  return NextResponse.json({ ok: true })
}
