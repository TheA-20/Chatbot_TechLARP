import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { generateEduLarpPDF, type EduLarpData } from '@/lib/pdf/edularp-pdf'
import { callLLMJson } from '@/lib/llm-provider'

async function translateData(data: EduLarpData): Promise<EduLarpData> {
  const payload = {
    nombre: data.nombre,
    descripcion: data.descripcion,
    storyboard: data.storyboard,
    storyboard_alt: data.storyboard_alt,
    asignaturas: data.asignaturas,
    materiales: data.materiales,
    evaluacion: data.evaluacion,
    notas_docente: data.notas_docente,
    competencias: data.competencias,
    paralelos: data.paralelos.map(p => ({ narrativa: p.narrativa, mundo_real: p.mundo_real, proposito: p.proposito })),
    misiones: data.misiones.map(m => ({ titulo: m.titulo, objetivo: m.objetivo, formato: m.formato, problema_larp: m.problema_larp, problema_real: m.problema_real, solucion: m.solucion, recursos: m.recursos })),
    roles: data.roles.map(r => ({ nombre_rol: r.nombre_rol, nombre_habilidad: r.nombre_habilidad, desc_habilidad: r.desc_habilidad, uso_juego: r.uso_juego })),
    cartas: data.cartas.map(c => ({ nombre: c.nombre, habilidad: c.habilidad, lore: c.lore })),
    objetivos: data.objetivos.map(o => ({ tipo: o.tipo, descripcion: o.descripcion })),
  }

  const TRANSLATE_SYSTEM = `You are a professional translator. Translate all Spanish text values in the provided JSON object to English.
Rules:
- Return ONLY valid JSON with exactly the same structure as input.
- Translate all string values; do NOT change keys.
- For "objetivos[].tipo", do NOT translate it — keep as is.
- Null or empty string values must remain null or empty string.
- Preserve formatting, line breaks, and bullet points.`

  let translated: any = {}
  try {
    translated = await callLLMJson({
      system:      TRANSLATE_SYSTEM,
      messages:    [{ role: 'user', content: JSON.stringify(payload) }],
      maxTokens:   8192,
      temperature: 0.1,
    })
  } catch { /* fallback: return original data */ }

  return {
    ...data,
    nombre:        translated.nombre        ?? data.nombre,
    descripcion:   translated.descripcion   ?? data.descripcion,
    storyboard:    translated.storyboard    ?? data.storyboard,
    storyboard_alt: translated.storyboard_alt ?? data.storyboard_alt,
    asignaturas:   translated.asignaturas   ?? data.asignaturas,
    materiales:    translated.materiales    ?? data.materiales,
    evaluacion:    translated.evaluacion    ?? data.evaluacion,
    notas_docente: translated.notas_docente ?? data.notas_docente,
    competencias:  translated.competencias  ?? data.competencias,
    paralelos:     (translated.paralelos ?? data.paralelos).map((p: any, i: number) => ({
      ...data.paralelos[i],
      narrativa:   p.narrativa   ?? data.paralelos[i]?.narrativa,
      mundo_real:  p.mundo_real  ?? data.paralelos[i]?.mundo_real,
      proposito:   p.proposito   ?? data.paralelos[i]?.proposito,
    })),
    misiones: (translated.misiones ?? data.misiones).map((m: any, i: number) => ({
      ...data.misiones[i],
      titulo:         m.titulo         ?? data.misiones[i]?.titulo,
      objetivo:       m.objetivo       ?? data.misiones[i]?.objetivo,
      formato:        m.formato        ?? data.misiones[i]?.formato,
      problema_larp:  m.problema_larp  ?? data.misiones[i]?.problema_larp,
      problema_real:  m.problema_real  ?? data.misiones[i]?.problema_real,
      solucion:       m.solucion       ?? data.misiones[i]?.solucion,
      recursos:       m.recursos       ?? data.misiones[i]?.recursos,
    })),
    roles: (translated.roles ?? data.roles).map((r: any, i: number) => ({
      ...data.roles[i],
      nombre_rol:       r.nombre_rol       ?? data.roles[i]?.nombre_rol,
      nombre_habilidad: r.nombre_habilidad ?? data.roles[i]?.nombre_habilidad,
      desc_habilidad:   r.desc_habilidad   ?? data.roles[i]?.desc_habilidad,
      uso_juego:        r.uso_juego        ?? data.roles[i]?.uso_juego,
    })),
    cartas: (translated.cartas ?? data.cartas).map((c: any, i: number) => ({
      ...data.cartas[i],
      nombre:    c.nombre    ?? data.cartas[i]?.nombre,
      habilidad: c.habilidad ?? data.cartas[i]?.habilidad,
      lore:      c.lore      ?? data.cartas[i]?.lore,
    })),
    objetivos: (translated.objetivos ?? data.objetivos).map((o: any, i: number) => ({
      ...data.objetivos[i],
      tipo:       data.objetivos[i]?.tipo,  // never translate tipo
      descripcion: o.descripcion ?? data.objetivos[i]?.descripcion,
    })),
  }
}

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

  const lang = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es') as 'es' | 'en'

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

  const pdfData = lang === 'en' ? await translateData(data) : data
  const pdfBytes = await generateEduLarpPDF(pdfData, lang)
  const safeName = pdfData.nombre
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

  const pdfData = lang === 'en' ? await translateData(data) : data
  const pdfBytes = await generateEduLarpPDF(pdfData, lang)
  const safeName = (pdfData.nombre ?? 'actividad')
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
