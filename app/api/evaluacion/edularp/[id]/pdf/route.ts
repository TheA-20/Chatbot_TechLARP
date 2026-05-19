import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { generateEduLarpPDF, type EduLarpData } from '@/lib/pdf/edularp-pdf'

async function validateEvalToken(req: NextRequest) {
  const token = req.cookies.get('eval_token')?.value
  if (!token) return false
  const [sesion] = await sql`
    SELECT id FROM sesiones_evaluacion
    WHERE token = ${token} AND expira_en > now()
  `
  return !!sesion
}

// GET — descargar PDF directo desde la BD (solo actividades publicadas)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await validateEvalToken(req))) {
    return NextResponse.json({ error: 'Sesión de evaluación no encontrada' }, { status: 401 })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const [edularp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${params.id} AND e.estado = 'publicado'
  `
  if (!edularp) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })

  const [paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT narrativa, mundo_real, proposito FROM paralelos_realidad WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT titulo, objetivo, formato, duracion_min, problema_larp, problema_real, solucion, recursos
        FROM misiones WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT nombre_rol, nombre_habilidad, desc_habilidad, uso_juego
        FROM roles_participantes WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT nombre, tipo, habilidad, lore
        FROM cartas_juego WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT tipo, descripcion FROM objetivos WHERE edularp_id = ${params.id}`,
  ])

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

  const pdfBytes = await generateEduLarpPDF(data)
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

// POST — generar PDF desde datos modificados por el cliente (sin guardar en BD)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await validateEvalToken(req))) {
    return NextResponse.json({ error: 'Sesión de evaluación no encontrada' }, { status: 401 })
  }

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

  const pdfBytes = await generateEduLarpPDF(data)
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
