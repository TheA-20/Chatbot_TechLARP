import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

// POST /api/evaluacion/inicio
// Body: { nombre: string }
// Siempre crea una sesión nueva — la recuperación se realiza exclusivamente a través
// de la cookie httpOnly eval_token (que el servidor devuelve en esta misma respuesta).
// No se reutiliza sesión por nombre para evitar que un atacante que conozca el nombre
// del evaluador pueda obtener su token de sesión (SEC-11).
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

  try {
    // Siempre crear sesión nueva — no reutilizar por nombre
    const [nueva] = await sql`
      INSERT INTO sesiones_evaluacion (nombre_evaluador)
      VALUES (${nombre})
      RETURNING id, token
    `
    sesionId = nueva.id
    token = nueva.token
  } catch (err) {
    console.error('[evaluacion/inicio] DB error:', err)
    return NextResponse.json(
      { error: 'Error al crear la sesión. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }

  const res = NextResponse.json({ ok: true, nombre, sesionId, esRetorno: false })

  // Cookie httpOnly — no accesible desde JS, expira en 48h
  // secure:true en producción (HTTPS), false en desarrollo local (HTTP)
  res.cookies.set('eval_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 48 * 60 * 60,
  })

  return res
}
