import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

// GET /api/evaluacion/historial
// Devuelve todos los mensajes de la sesión activa del evaluador (via cookie)
export async function GET(req: NextRequest) {
  const token = req.cookies.get('eval_token')?.value
  if (!token) return NextResponse.json({ mensajes: [] })

  const [sesion] = await sql`
    SELECT id FROM sesiones_evaluacion
    WHERE token = ${token}
      AND expira_en > now()
  `
  if (!sesion) return NextResponse.json({ mensajes: [] })

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
}
