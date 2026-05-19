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

  // If a translated version exists for the requested locale, serve that instead
  const lang = req.nextUrl.searchParams.get('lang') ?? 'es'
  let resolvedId = params.id
  if (larp.idioma_original !== lang) {
    const [translated] = await sql`
      SELECT id FROM edularp
      WHERE traduccion_de = ${params.id}
        AND idioma_original = ${lang}
        AND estado = 'publicado'
      LIMIT 1
    `
    if (translated) resolvedId = translated.id
  }

  const [paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT * FROM paralelos_realidad   WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM misiones             WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM roles_participantes  WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM cartas_juego         WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM objetivos            WHERE edularp_id = ${resolvedId}`,
  ])

  let larpData = larp
  if (resolvedId !== params.id) {
    const [translatedLarp] = await sql`SELECT * FROM edularp WHERE id = ${resolvedId}`
    if (translatedLarp) larpData = { ...translatedLarp, _translated_from: params.id }
  }

  return NextResponse.json({ larp: larpData, paralelos, misiones, roles, cartas, objetivos })
}
