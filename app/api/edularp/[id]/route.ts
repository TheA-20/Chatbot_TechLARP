import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rol = (session.user as any).rol
  const userId = (session.user as any).id

  // Requested locale — if a translated version exists, serve that instead
  const lang = _req.nextUrl.searchParams.get('lang') ?? 'es'

  const [larp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre, u.email AS autor_email
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${params.id}
      AND (e.estado = 'publicado' OR e.autor_id = ${userId} OR ${rol} = 'admin')
  `
  if (!larp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // If the stored locale differs from requested, try to find a translated version
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
    sql`SELECT * FROM paralelos_realidad WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM misiones         WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM roles_participantes WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM cartas_juego     WHERE edularp_id = ${resolvedId} ORDER BY orden`,
    sql`SELECT * FROM objetivos        WHERE edularp_id = ${resolvedId}`,
  ])

  // If we served a translation, fetch that larp row too so the name/description match
  let larpData = larp
  if (resolvedId !== params.id) {
    const [translatedLarp] = await sql`
      SELECT e.*, u.nombre AS autor_nombre, u.email AS autor_email
      FROM edularp e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.id = ${resolvedId}
    `
    if (translatedLarp) larpData = { ...translatedLarp, _translated_from: params.id }
  }

  return NextResponse.json({ larp: larpData, paralelos, misiones, roles, cartas, objetivos })
}

// PATCH — actualizar campos de un EduLarp existente
// tipo_version, status y veces_modificada se gestionan automáticamente:
//   tipo_version:     'modificada' si ya estaba publicada, 'original' si aún no
//   status:           borrador→piloto (1ª edición post-pub), piloto→validado (posteriores)
//   veces_modificada: incrementa cada edición de una actividad publicada
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rol    = (session.user as any).rol
  const userId = (session.user as any).id

  // Verify ownership or admin
  const [existing] = await sql`
    SELECT id, estado, autor_id, tipo_version, status, veces_modificada FROM edularp
    WHERE id = ${params.id}
      AND (autor_id = ${userId} OR ${rol} = 'admin')
  `
  if (!existing) return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 })

  const body = await req.json()

  const yaPublicada = existing.estado === 'publicado'

  // Auto-set tipo_version — never let client override
  const tipoVersion = yaPublicada ? 'modificada' : (existing.tipo_version ?? 'original')

  // Auto-advance status based on lifecycle
  const statusActual = existing.status ?? 'borrador'
  const nuevoStatus =
    yaPublicada && statusActual === 'borrador' ? 'piloto'
    : yaPublicada && statusActual === 'piloto'  ? 'validado'
    : statusActual

  // Increment modification counter only for published activities
  const vecesModificada = yaPublicada ? (existing.veces_modificada ?? 0) + 1 : (existing.veces_modificada ?? 0)

  const [updated] = await sql`
    UPDATE edularp SET
      nombre            = COALESCE(${body.nombre ?? null},           nombre),
      descripcion       = COALESCE(${body.descripcion ?? null},      descripcion),
      storyboard        = COALESCE(${body.storyboard ?? null},       storyboard),
      nivel_educativo   = COALESCE(${body.nivel_educativo ?? null},  nivel_educativo),
      asignaturas       = COALESCE(${body.asignaturas ?? null},      asignaturas),
      duracion_min      = COALESCE(${body.duracion_min ?? null},     duracion_min),
      num_participantes = COALESCE(${body.num_participantes ?? null},num_participantes),
      materiales        = COALESCE(${body.materiales ?? null},       materiales),
      evaluacion        = COALESCE(${body.evaluacion ?? null},       evaluacion),
      notas_docente     = COALESCE(${body.notas_docente ?? null},    notas_docente),
      tipo_version      = ${tipoVersion},
      status            = ${nuevoStatus},
      veces_modificada  = ${vecesModificada},
      actualizado_en    = NOW()
    WHERE id = ${params.id}
    RETURNING id, tipo_version, status, veces_modificada
  `

  return NextResponse.json({ ok: true, id: updated.id, tipo_version: updated.tipo_version, status: updated.status, veces_modificada: updated.veces_modificada })
}
