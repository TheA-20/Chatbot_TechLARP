import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET — listar docentes
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  try {
    const usuarios = await sql`
      SELECT u.id, u.nombre, u.email, u.rol, u.estado,
             u.creado_en, u.ultimo_acceso,
             COUNT(e.id)::int AS num_larps
      FROM usuarios u
      LEFT JOIN edularp e ON e.autor_id = u.id
      WHERE u.rol != 'admin'
      GROUP BY u.id
      ORDER BY u.creado_en DESC
    `
    return NextResponse.json({ usuarios })
  } catch (err) {
    console.error('[usuarios GET] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST — registrar nuevo docente (desde admin o registro público)
export async function POST(req: NextRequest) {
  const { nombre, email, password, desde_admin } = await req.json()

  // Only admins may create accounts in active state directly
  if (desde_admin) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).rol !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
  }
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'El email no tiene un formato válido' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  try {
    const existe = await sql`SELECT id FROM usuarios WHERE email = ${email}`
    if (existe.length > 0) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    const estado = desde_admin ? 'activo' : 'pendiente'

    const [user] = await sql`
      INSERT INTO usuarios (nombre, email, password_hash, rol, estado)
      VALUES (${nombre}, ${email}, ${hash}, 'docente', ${estado})
      RETURNING id, nombre, email, estado
    `
    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    console.error('[usuarios POST] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH — activar / suspender docente
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const VALID_ESTADOS = ['activo', 'pendiente', 'suspendido'] as const
  const { usuario_id, estado } = await req.json()

  if (!VALID_ESTADOS.includes(estado)) {
    return NextResponse.json({ error: `Estado inválido. Valores permitidos: ${VALID_ESTADOS.join(', ')}` }, { status: 400 })
  }

  try {
    const result = await sql`
      UPDATE usuarios SET estado = ${estado}
      WHERE id = ${usuario_id} AND rol != 'admin'
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado o no modificable' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[usuarios PATCH] DB error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
