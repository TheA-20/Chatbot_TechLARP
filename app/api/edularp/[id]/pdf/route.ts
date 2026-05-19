import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'
import { generateEduLarpPDF, type EduLarpData } from '@/lib/pdf/edularp-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Autenticación
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const id = params.id
  const lang = (_req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en'

  // 2. Validar formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // 3. Consultar la actividad con todas sus relaciones
  const [edularp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${id} AND e.estado = 'publicado'
  `

  if (!edularp) {
    return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })
  }

  // Consultas en paralelo para rendimiento con varios usuarios
  const [paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT narrativa, mundo_real, proposito FROM paralelos_realidad WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT titulo, objetivo, formato, duracion_min, problema_larp, problema_real, solucion, recursos
        FROM misiones WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT nombre_rol, nombre_habilidad, desc_habilidad, uso_juego
        FROM roles_participantes WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT nombre, tipo, habilidad, lore
        FROM cartas_juego WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT tipo, descripcion FROM objetivos WHERE edularp_id = ${id}`,
  ])

  // 4. Generar PDF
  const data: EduLarpData = {
    nombre: edularp.nombre,
    proyecto: edularp.proyecto,
    descripcion: edularp.descripcion,
    storyboard: edularp.storyboard,
    storyboard_alt: edularp.storyboard_alt,
    nivel_educativo: edularp.nivel_educativo,
    asignaturas: edularp.asignaturas,
    duracion_min: edularp.duracion_min,
    num_participantes: edularp.num_participantes,
    materiales: edularp.materiales,
    evaluacion: edularp.evaluacion,
    notas_docente: edularp.notas_docente,
    competencias: edularp.competencias,
    tipo_version: edularp.tipo_version,
    idioma_original: edularp.idioma_original,
    veces_modificada: edularp.veces_modificada,
    autor_nombre: edularp.autor_nombre,
    creado_en: edularp.creado_en,
    paralelos: paralelos as any[],
    misiones: misiones as any[],
    roles: roles as any[],
    cartas: cartas as any[],
    objetivos: objetivos as any[],
  }

  const pdfBytes = await generateEduLarpPDF(data, lang)
  const safeName = data.nombre
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_TechLARP.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}

// POST — generate PDF from client-provided (modified) activity data without saving to DB
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const lang = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en'

  const body = await req.json().catch(() => null)
  if (!body?.larp) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { larp, paralelos = [], misiones = [], roles = [], cartas = [], objetivos = [] } = body

  const data: EduLarpData = {
    nombre:           larp.nombre,
    proyecto:         larp.proyecto,
    descripcion:      larp.descripcion,
    storyboard:       larp.storyboard,
    storyboard_alt:   larp.storyboard_alt,
    nivel_educativo:  larp.nivel_educativo,
    asignaturas:      larp.asignaturas,
    duracion_min:     larp.duracion_min,
    num_participantes: larp.num_participantes,
    materiales:       larp.materiales,
    evaluacion:       larp.evaluacion,
    notas_docente:    larp.notas_docente,
    competencias:     larp.competencias,
    tipo_version:     larp.tipo_version,
    idioma_original:  larp.idioma_original,
    veces_modificada: larp.veces_modificada,
    autor_nombre:     larp.autor_nombre,
    creado_en:        larp.creado_en,
    paralelos:        paralelos as any[],
    misiones:         misiones as any[],
    roles:            roles as any[],
    cartas:           cartas as any[],
    objetivos:        objetivos as any[],
  }

  const pdfBytes = await generateEduLarpPDF(data, lang)
  const safeName = (data.nombre ?? 'actividad')
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_modificada_TechLARP.pdf"`,
      'Content-Length': String(pdfBytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}
