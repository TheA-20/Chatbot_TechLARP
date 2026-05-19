import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { edularpSchema } from '@/lib/schemas/edularp.schema'
import sql from '@/lib/db'

// GET — listar EduLarps (publicados para todos, propios para docentes)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const propios = searchParams.get('propios') === 'true'

  let larps
  if (propios && session) {
    larps = await sql`
      SELECT e.*, u.nombre AS autor_nombre
      FROM edularp e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.autor_id = ${(session.user as any).id}
      ORDER BY e.creado_en DESC
    `
  } else if (estado && (session?.user as any)?.rol === 'admin') {
    larps = await sql`
      SELECT e.*, u.nombre AS autor_nombre
      FROM edularp e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.estado = ${estado}
      ORDER BY e.creado_en ASC
    `
  } else {
    larps = await sql`
      SELECT e.*, u.nombre AS autor_nombre
      FROM edularp e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.estado = 'publicado'
      ORDER BY e.creado_en DESC
    `
  }
  return NextResponse.json({ larps })
}

// POST — crear nuevo EduLarp
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = edularpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.flatten() }, { status: 422 })
  }

  const data = parsed.data
  const autorId = (session.user as any).id

  // Insertar EduLarp principal
  const [larp] = await sql`
    INSERT INTO edularp (
      autor_id, nombre, proyecto, descripcion, storyboard, storyboard_alt,
      nivel_educativo, asignaturas, duracion_min, num_participantes,
      materiales, evaluacion, notas_docente, competencias, tipo_version,
      idioma_original, recursos_globales, imagenes_urls, inclusion_index, estado
    ) VALUES (
      ${autorId}, ${data.nombre}, ${data.proyecto ?? null},
      ${data.descripcion}, ${data.storyboard}, ${data.storyboard_alt ?? null},
      ${data.nivel_educativo}, ${data.asignaturas},
      ${data.duracion_min}, ${data.num_participantes},
      ${data.materiales ?? null}, ${data.evaluacion ?? null},
      ${data.notas_docente ?? null}, ${data.competencias ?? []},
      'original',
      ${data.idioma_original ?? 'es'},
      ${data.recursos_globales ? sql.json(data.recursos_globales) : null},
      ${data.imagenes_urls ?? []},
      ${data.inclusion_index ? sql.json(data.inclusion_index) : null},
      'pending_review'
    ) RETURNING id
  `

  const id = larp.id

  // Fire-and-forget LLM analysis (does not block the response)
  analizarConLLM(id, data)

  // Insertar paralelos, misiones, roles, cartas y objetivos en paralelo
  await Promise.all([
    data.paralelos.length > 0 && sql`
      INSERT INTO paralelos_realidad ${sql(
        data.paralelos.map((p, i) => ({
          edularp_id: id, narrativa: p.narrativa,
          mundo_real: p.mundo_real, proposito: p.proposito ?? null, orden: i
        }))
      )}
    `,
    data.misiones.length > 0 && sql`
      INSERT INTO misiones ${sql(
        data.misiones.map((m, i) => ({
          edularp_id: id, titulo: m.titulo, objetivo: m.objetivo,
          duracion_min: m.duracion_min ?? null, formato: m.formato ?? null,
          problema_larp: m.problema_larp ?? null, problema_real: m.problema_real ?? null,
          solucion: m.solucion ?? null, recursos: m.recursos ?? null,
          orden: i
        }))
      )}
    `,
    data.roles.length > 0 && sql`
      INSERT INTO roles_participantes ${sql(
        data.roles.map((r, i) => ({
          edularp_id: id, nombre_rol: r.nombre_rol,
          nombre_habilidad: r.nombre_habilidad ?? null,
          desc_habilidad: r.desc_habilidad,
          uso_juego: r.uso_juego ?? null, orden: i
        }))
      )}
    `,
    data.cartas && data.cartas.length > 0 && sql`
      INSERT INTO cartas_juego ${sql(
        data.cartas.map((c, i) => ({
          edularp_id: id, nombre: c.nombre, tipo: c.tipo,
          habilidad: c.habilidad ?? null, lore: c.lore ?? null,
          descripcion: c.descripcion ?? null, orden: i
        }))
      )}
    `,
    data.objetivos.length > 0 && sql`
      INSERT INTO objetivos ${sql(
        data.objetivos.map(o => ({
          edularp_id: id, tipo: o.tipo, descripcion: o.descripcion
        }))
      )}
    `,
  ])

  return NextResponse.json({ id, mensaje: 'Actividad enviada a revisión correctamente' }, { status: 201 })
}

/**
 * Fire-and-forget: calls /api/edularp/[id]/analyze after the LARP is saved.
 * Errors are swallowed — a failed LLM pass does not break the submission flow.
 */
async function analizarConLLM(edularpId: string, _data: unknown): Promise<void> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const subpath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    await fetch(`${baseUrl}${subpath}/api/edularp/${edularpId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_SECRET ?? '' },
    })
  } catch (err) {
    console.error('[analizarConLLM] Error calling analyze endpoint:', err)
  }
}
