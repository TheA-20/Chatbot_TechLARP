import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { edularpSchema } from '@/lib/schemas/edularp.schema'
import sql from '@/lib/db'

/**
 * PUT /api/edularp/[id]/editar
 * Reemplaza todos los datos de un LARP en estado borrador o rechazado.
 * - Borra y re-inserta paralelos, misiones, roles, cartas y objetivos.
 * - Actualiza el estado (borrador | pending_review).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rol    = (session.user as any).rol
  const userId = (session.user as any).id

  // Verificar propiedad y estado editable
  const [existing] = await sql`
    SELECT id, estado, autor_id FROM edularp
    WHERE id = ${params.id}
      AND (autor_id = ${userId} OR ${rol} = 'admin')
      AND (estado IN ('borrador', 'rechazado', 'modificaciones', 'pending_review') OR ${rol} = 'admin')
  `
  if (!existing) return NextResponse.json({ error: 'No encontrado, sin permiso o no editable' }, { status: 404 })

  const body = await req.json()
  const { estado: nuevoEstado, ...formData } = body

  const estadoFinal = ['borrador', 'pending_review'].includes(nuevoEstado ?? '') ? nuevoEstado : 'borrador'

  const parsed = edularpSchema.safeParse(formData)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 422 })
  }

  const data = parsed.data

  // Actualizar campos principales del LARP
  await sql`
    UPDATE edularp SET
      nombre             = ${data.nombre},
      descripcion        = ${data.descripcion},
      storyboard         = ${data.storyboard},
      storyboard_alt     = ${data.storyboard_alt ?? null},
      nivel_educativo    = ${data.nivel_educativo},
      asignaturas        = ${data.asignaturas},
      duracion_min       = ${data.duracion_min},
      num_participantes  = ${data.num_participantes},
      materiales         = ${data.materiales ?? null},
      evaluacion         = ${data.evaluacion ?? null},
      notas_docente      = ${data.notas_docente ?? null},
      competencias       = ${data.competencias ?? []},
      estado             = ${estadoFinal},
      actualizado_en     = NOW()
    WHERE id = ${params.id}
  `

  // Re-insertar subelementos (borrar + insertar es más seguro que diff individual)
  await sql`DELETE FROM paralelos_realidad  WHERE edularp_id = ${params.id}`
  await sql`DELETE FROM misiones            WHERE edularp_id = ${params.id}`
  await sql`DELETE FROM roles_participantes WHERE edularp_id = ${params.id}`
  await sql`DELETE FROM cartas_juego        WHERE edularp_id = ${params.id}`
  await sql`DELETE FROM objetivos           WHERE edularp_id = ${params.id}`

  await Promise.all([
    data.paralelos.length > 0 && sql`
      INSERT INTO paralelos_realidad ${sql(
        data.paralelos.map((p, i) => ({
          edularp_id: params.id, narrativa: p.narrativa,
          mundo_real: p.mundo_real, proposito: p.proposito ?? null, orden: i
        }))
      )}
    `,
    data.misiones.length > 0 && sql`
      INSERT INTO misiones ${sql(
        data.misiones.map((m, i) => ({
          edularp_id: params.id, titulo: m.titulo, objetivo: m.objetivo,
          duracion_min: m.duracion_min ?? null, formato: m.formato ?? null,
          problema_larp: m.problema_larp ?? null, problema_real: m.problema_real ?? null,
          solucion: m.solucion ?? null, recursos: m.recursos ?? null, orden: i
        }))
      )}
    `,
    data.roles.length > 0 && sql`
      INSERT INTO roles_participantes ${sql(
        data.roles.map((r, i) => ({
          edularp_id: params.id, nombre_rol: r.nombre_rol,
          nombre_habilidad: r.nombre_habilidad ?? null,
          desc_habilidad: r.desc_habilidad, uso_juego: r.uso_juego ?? null, orden: i
        }))
      )}
    `,
    data.cartas && data.cartas.length > 0 && sql`
      INSERT INTO cartas_juego ${sql(
        data.cartas.map((c, i) => ({
          edularp_id: params.id, nombre: c.nombre, tipo: c.tipo,
          habilidad: c.habilidad ?? null, lore: c.lore ?? null,
          descripcion: c.descripcion ?? null, orden: i
        }))
      )}
    `,
    data.objetivos.length > 0 && sql`
      INSERT INTO objetivos ${sql(
        data.objetivos.map(o => ({
          edularp_id: params.id, tipo: o.tipo, descripcion: o.descripcion
        }))
      )}
    `,
  ])

  // Si se envía a revisión, disparar análisis LLM
  if (estadoFinal === 'pending_review') {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const subpath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    fetch(`${baseUrl}${subpath}/api/edularp/${params.id}/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_SECRET ?? '' },
    }).catch(err => console.error('[editar] Error calling analyze:', err))
  }

  return NextResponse.json({ ok: true, id: params.id, estado: estadoFinal })
}
