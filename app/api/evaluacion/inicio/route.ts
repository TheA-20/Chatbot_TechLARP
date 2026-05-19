import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

// POST /api/evaluacion/inicio
// Body: { docente_id: string }
// Valida que el docente existe, crea sesión de evaluación y devuelve cookie httpOnly
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const docenteId = body?.docente_id?.trim()

  // Validar formato UUID básico antes de ir a la DB
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!docenteId || !uuidRe.test(docenteId)) {
    return NextResponse.json({ error: 'ID de docente no válido' }, { status: 400 })
  }

  // Buscar el docente — error genérico tanto si no existe como si está suspendido
  const [docente] = await sql`
    SELECT id, nombre FROM usuarios
    WHERE id = ${docenteId}
      AND estado = 'activo'
  `

  if (!docente) {
    // Mismo mensaje para inexistente y suspendido → evita enumeración de IDs
    return NextResponse.json({ error: 'ID de docente no reconocido' }, { status: 404 })
  }

  // Crear sesión de evaluación con token UUID aleatorio
  const [sesion] = await sql`
    INSERT INTO sesiones_evaluacion (docente_id)
    VALUES (${docenteId})
    RETURNING token, id
  `

  // Cookie httpOnly — no accesible desde JS, expira en 48h
  const res = NextResponse.json({
    ok: true,
    nombre: docente.nombre,
    sesionId: sesion.id,
  })

  res.cookies.set('eval_token', sesion.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 48 * 60 * 60, // 48 horas en segundos
  })

  return res
}
