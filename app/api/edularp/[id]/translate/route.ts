import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = (session.user as any).id as string
  const rol = (session.user as any).rol as string

  const body = await req.json()
  const targetLocale: 'es' | 'en' = body.targetLocale === 'en' ? 'en' : 'es'

  // Fetch original LARP — only owner or admin may translate
  const larps = await sql`
    SELECT * FROM edularp
    WHERE id = ${params.id}
      AND (autor_id = ${userId} OR ${rol} = 'admin')
  `
  if (larps.length === 0) {
    return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 })
  }
  const larp = larps[0]

  if (larp.idioma_original === targetLocale) {
    return NextResponse.json(
      { error: 'La actividad ya está en ese idioma' },
      { status: 400 }
    )
  }

  // Fetch all child records
  const [paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT * FROM paralelos_realidad WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM misiones WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM roles_participantes WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM cartas_juego WHERE edularp_id = ${params.id} ORDER BY orden`,
    sql`SELECT * FROM objetivos WHERE edularp_id = ${params.id}`,
  ])

  // Build translation payload — text fields only
  const payload = {
    nombre: larp.nombre,
    proyecto: larp.proyecto,
    descripcion: larp.descripcion,
    storyboard: larp.storyboard,
    storyboard_alt: larp.storyboard_alt,
    asignaturas: larp.asignaturas,
    materiales: larp.materiales,
    evaluacion: larp.evaluacion,
    notas_docente: larp.notas_docente,
    competencias: larp.competencias,
    paralelos: paralelos.map((p: any) => ({
      narrativa: p.narrativa,
      mundo_real: p.mundo_real,
      proposito: p.proposito,
    })),
    misiones: misiones.map((m: any) => ({
      titulo: m.titulo,
      objetivo: m.objetivo,
      formato: m.formato,
      problema_larp: m.problema_larp,
      problema_real: m.problema_real,
      solucion: m.solucion,
      recursos: m.recursos,
      inclusion: m.inclusion,
    })),
    roles: roles.map((r: any) => ({
      nombre_rol: r.nombre_rol,
      nombre_habilidad: r.nombre_habilidad,
      desc_habilidad: r.desc_habilidad,
    })),
    cartas: cartas.map((c: any) => ({
      nombre: c.nombre,
      habilidad: c.habilidad,
      lore: c.lore,
      descripcion: c.descripcion,
    })),
    objetivos: objetivos.map((o: any) => ({
      // tipo is kept unchanged — DB CHECK constraint uses fixed Spanish values
      tipo: o.tipo,
      descripcion: o.descripcion,
    })),
  }

  const sourceLang = larp.idioma_original === 'es' ? 'Spanish' : 'English'

  const systemPrompt =
    targetLocale === 'en'
      ? `You are an expert translator for TechLARP — an educational LARP (Live Action Role-Playing) program designed specifically for female students in STEM education.

TASK: Translate all text fields from ${sourceLang} to English.

GENDER-INCLUSIVE LANGUAGE RULES:
- Default to gender-neutral forms: "students", "participants", "players", "they/them"
- Where the source explicitly refers to female participants, keep that reference explicit: "female students", "girls", "she/her"
- Never erase the specifically female-oriented and feminist design intent of TechLARP
- Prefer inclusive terms: "humankind" not "mankind", "workforce" not "manpower"

IMPORTANT CONSTRAINTS:
- Do NOT translate the "tipo" field inside the objetivos array — preserve those values exactly as-is
- Keep null values as null
- Translate string arrays (e.g. competencias) by translating each element
- Return ONLY a valid JSON object with the exact same structure and keys as the input, no extra text`
      : `Eres traductora especialista en TechLARP — un programa de LARP (juego de rol en vivo) educativo diseñado específicamente para alumnas en educación STEM.

TAREA: Traduce todos los campos de texto de ${sourceLang} a español.

REGLAS DE LENGUAJE INCLUSIVO EN FEMENINO:
- Usa formas femeninas explícitas cuando te refieras a las participantes: "alumnas", "chicas", "jugadoras", "estudiantes"
- Usa artículos y adjetivos en femenino: "las alumnas", "ellas son responsables de..."
- NUNCA uses el masculino genérico. Para referentes neutros colectivos usa: "el alumnado", "las participantes"
- TechLARP es un proyecto diseñado para chicas → mantén siempre esa intención feminista e inclusiva en la redacción
- Para roles técnicos o profesionales usa el femenino cuando exista: "programadoras", "investigadoras", "ingenieras", "científicas"

RESTRICCIONES IMPORTANTES:
- NO traduzcas el campo "tipo" dentro del array de objetivos — mantenlo exactamente como está
- Los valores null déjalos como null
- Traduce los arrays de cadenas (p. ej. competencias) traduciendo cada elemento
- Devuelve ÚNICAMENTE un objeto JSON válido con la misma estructura y claves exactas que el input, sin texto adicional`

  const llmParams = {
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: JSON.stringify(payload) },
    ],
  }

  let rawContent: string
  try {
    const r70b = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', ...llmParams })
    rawContent = r70b.choices[0].message.content ?? '{}'
  } catch (err: any) {
    const isRateLimit = err?.status === 429 || err?.error?.code === 'rate_limit_exceeded'
    if (!isRateLimit) return NextResponse.json({ error: 'Error del servicio de traducción' }, { status: 502 })
    try {
      const r8b = await groq.chat.completions.create({ model: 'llama-3.1-8b-instant', ...llmParams })
      rawContent = r8b.choices[0].message.content ?? '{}'
    } catch {
      return NextResponse.json({ error: 'Servicio de traducción no disponible (rate limit)' }, { status: 503 })
    }
  }

  let translated: any
  try {
    translated = JSON.parse(rawContent!)
  } catch {
    return NextResponse.json({ error: 'Error al parsear la traducción' }, { status: 500 })
  }

  // Insert translated LARP record
  const newLarps = await sql`
    INSERT INTO edularp (
      autor_id, nombre, proyecto, descripcion, storyboard, storyboard_alt,
      nivel_educativo, asignaturas, duracion_min, num_participantes,
      materiales, evaluacion, notas_docente, competencias,
      tipo_version, idioma_original, traduccion_de,
      recursos_globales, imagenes_urls, inclusion_index, estado
    ) VALUES (
      ${userId},
      ${translated.nombre ?? larp.nombre},
      ${translated.proyecto ?? null},
      ${translated.descripcion ?? larp.descripcion},
      ${translated.storyboard ?? larp.storyboard},
      ${translated.storyboard_alt ?? null},
      ${larp.nivel_educativo},
      ${translated.asignaturas ?? larp.asignaturas},
      ${larp.duracion_min},
      ${larp.num_participantes},
      ${translated.materiales ?? null},
      ${translated.evaluacion ?? null},
      ${translated.notas_docente ?? null},
      ${translated.competencias ?? larp.competencias ?? []},
      'traducida',
      ${targetLocale},
      ${larp.id},
      ${larp.recursos_globales},
      ${larp.imagenes_urls ?? []},
      ${larp.inclusion_index},
      'pending_review'
    ) RETURNING id
  `
  const newId = newLarps[0].id

  // Insert translated child records
  const inserts: Promise<any>[] = []

  if (Array.isArray(translated.paralelos) && translated.paralelos.length > 0) {
    inserts.push(
      sql`INSERT INTO paralelos_realidad ${sql(
        (translated.paralelos as any[]).map((p: any, i: number) => ({
          edularp_id: newId,
          narrativa: p.narrativa ?? paralelos[i]?.narrativa ?? '',
          mundo_real: p.mundo_real ?? paralelos[i]?.mundo_real ?? '',
          proposito: p.proposito ?? null,
          orden: i,
        }))
      )}`
    )
  }

  if (Array.isArray(translated.misiones) && translated.misiones.length > 0) {
    inserts.push(
      sql`INSERT INTO misiones ${sql(
        (translated.misiones as any[]).map((m: any, i: number) => ({
          edularp_id: newId,
          titulo: m.titulo ?? misiones[i]?.titulo ?? '',
          objetivo: m.objetivo ?? misiones[i]?.objetivo ?? '',
          duracion_min: misiones[i]?.duracion_min ?? null,
          formato: m.formato ?? null,
          problema_larp: m.problema_larp ?? null,
          problema_real: m.problema_real ?? null,
          solucion: m.solucion ?? null,
          recursos: m.recursos ?? null,
          inclusion: m.inclusion ?? null,
          orden: i,
        }))
      )}`
    )
  }

  if (Array.isArray(translated.roles) && translated.roles.length > 0) {
    inserts.push(
      sql`INSERT INTO roles_participantes ${sql(
        (translated.roles as any[]).map((r: any, i: number) => ({
          edularp_id: newId,
          nombre_rol: r.nombre_rol ?? roles[i]?.nombre_rol ?? '',
          nombre_habilidad: r.nombre_habilidad ?? null,
          desc_habilidad: r.desc_habilidad ?? roles[i]?.desc_habilidad ?? '',
          uso_juego: roles[i]?.uso_juego ?? null,
          orden: i,
        }))
      )}`
    )
  }

  if (Array.isArray(translated.cartas) && translated.cartas.length > 0) {
    inserts.push(
      sql`INSERT INTO cartas_juego ${sql(
        (translated.cartas as any[]).map((c: any, i: number) => ({
          edularp_id: newId,
          nombre: c.nombre ?? cartas[i]?.nombre ?? '',
          tipo: cartas[i]?.tipo ?? 'otro',
          habilidad: c.habilidad ?? null,
          lore: c.lore ?? null,
          descripcion: c.descripcion ?? null,
          imagen_url: cartas[i]?.imagen_url ?? null,
          orden: i,
        }))
      )}`
    )
  }

  if (Array.isArray(translated.objetivos) && translated.objetivos.length > 0) {
    inserts.push(
      sql`INSERT INTO objetivos ${sql(
        (translated.objetivos as any[]).map((o: any, i: number) => ({
          edularp_id: newId,
          // always use original tipo — DB CHECK constraint requires fixed Spanish values
          tipo: objetivos[i]?.tipo ?? 'Otro',
          descripcion: o.descripcion ?? objetivos[i]?.descripcion ?? '',
        }))
      )}`
    )
  }

  await Promise.all(inserts)

  return NextResponse.json({ ok: true, id: newId })
}
