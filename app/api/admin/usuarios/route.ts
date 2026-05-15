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
}

// POST — registrar nuevo docente (desde admin o registro público)
export async function POST(req: NextRequest) {
  const { nombre, email, password, desde_admin } = await req.json()

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
}

// PATCH — activar / suspender docente
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { usuario_id, estado } = await req.json()
  await sql`UPDATE usuarios SET estado = ${estado} WHERE id = ${usuario_id}`
  return NextResponse.json({ ok: true })
}
