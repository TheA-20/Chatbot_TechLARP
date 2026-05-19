import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

// POST /api/evaluacion/inicio
// Body: { nombre: string }
// Identifica al evaluador por nombre, reutiliza sesión activa o crea una nueva
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const nombre = body?.nombre?.trim()

  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: 'Introduce tu nombre (mínimo 2 caracteres)' }, { status: 400 })
  }
  if (nombre.length > 80) {
    return NextResponse.json({ error: 'Nombre demasiado largo' }, { status: 400 })
  }

  let sesionId: string
  let token: string
  let esRetorno = false

  try {
    // Buscar sesión activa para este nombre (insensible a mayúsculas)
    const [existente] = await sql`
      SELECT id, token FROM sesiones_evaluacion
      WHERE lower(nombre_evaluador) = lower(${nombre})
        AND expira_en > now()
      ORDER BY creado_en DESC
      LIMIT 1
    `

    if (existente) {
      // Reutilizar sesión — extender expiración otras 48h
      await sql`
        UPDATE sesiones_evaluacion
        SET expira_en = now() + INTERVAL '48 hours'
        WHERE id = ${existente.id}
      `
      sesionId = existente.id
      token = existente.token
      esRetorno = true
    } else {
      // Crear nueva sesión
      const [nueva] = await sql`
        INSERT INTO sesiones_evaluacion (nombre_evaluador)
        VALUES (${nombre})
        RETURNING id, token
      `
      sesionId = nueva.id
      token = nueva.token
    }
  } catch (err) {
    console.error('[evaluacion/inicio] DB error:', err)
    return NextResponse.json(
      { error: 'Error al crear la sesión. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }

  const res = NextResponse.json({ ok: true, nombre, sesionId, esRetorno })

  // Cookie httpOnly — no accesible desde JS, expira en 48h
  res.cookies.set('eval_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 48 * 60 * 60,
  })

  return res
}
