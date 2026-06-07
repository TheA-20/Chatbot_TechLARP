import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

async function getSesion(req: NextRequest) {
  const token = req.cookies.get('eval_token')?.value
  if (!token) return null
  try {
    const [sesion] = await sql`
      SELECT id FROM sesiones_evaluacion
      WHERE token = ${token} AND expira_en > now()
    `
    return sesion ?? null
  } catch (err) {
    console.error('[getSesion] DB error:', err)
    return null
  }
}

// GET /api/evaluacion/historial
// Devuelve todos los mensajes de la sesión, agrupables por escenario en cliente
export async function GET(req: NextRequest) {
  const sesion = await getSesion(req)
  if (!sesion) return NextResponse.json({ mensajes: [] })

  try {
    const mensajes = await sql`
      SELECT
        h.mensaje_usuario,
        h.respuesta_bot,
        h.escenario,
        h.larps_usados,
        h.creado_en,
        COALESCE(
          (
            SELECT json_agg(json_build_object('id', e.id, 'nombre', e.nombre) ORDER BY e.nombre)
            FROM edularp e
            WHERE e.id = ANY(h.larps_usados)
          ),
          '[]'::json
        ) AS larps
      FROM chat_evaluacion_historial h
      WHERE h.sesion_id = ${sesion.id}
      ORDER BY h.creado_en ASC
    `
    return NextResponse.json({ mensajes })
  } catch (err) {
    console.error('[historial GET] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/evaluacion/historial?escenario=1   → borra mensajes de ese escenario
// DELETE /api/evaluacion/historial?escenario=libre → borra mensajes sin escenario (null)
export async function DELETE(req: NextRequest) {
  const sesion = await getSesion(req)
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const param = new URL(req.url).searchParams.get('escenario')

  try {
    if (param === 'libre') {
      await sql`
        DELETE FROM chat_evaluacion_historial
        WHERE sesion_id = ${sesion.id} AND escenario IS NULL
      `
    } else if (param !== null) {
      const num = parseInt(param)
      if (isNaN(num) || num < 1 || num > 5) {
        return NextResponse.json({ error: 'Escenario no válido' }, { status: 400 })
      }
      await sql`
        DELETE FROM chat_evaluacion_historial
        WHERE sesion_id = ${sesion.id} AND escenario = ${num}
      `
    } else {
      await sql`DELETE FROM chat_evaluacion_historial WHERE sesion_id = ${sesion.id}`
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[historial DELETE] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
