import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('eval_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Sesión de evaluación no encontrada' }, { status: 401 })
  }

  const [sesion] = await sql`
    SELECT id FROM sesiones_evaluacion
    WHERE token = ${token}
      AND expira_en > now()
  `
  if (!sesion) {
    return NextResponse.json({ error: 'Sesión expirada o no válida' }, { status: 401 })
  }

  const [larp] = await sql`
    SELECT * FROM edularp
    WHERE id = ${params.id}
      AND estado = 'publicado'
  `
  if (!larp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const [paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT * FROM paralelos_realidad   WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM misiones             WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM roles_participantes  WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM cartas_juego         WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM objetivos            WHERE edularp_id = ${params.id}`,
  ])

  return NextResponse.json({ larp, paralelos, misiones, roles, cartas, objetivos })
}
