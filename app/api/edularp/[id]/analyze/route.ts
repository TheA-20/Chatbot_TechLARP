import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import sql from '@/lib/db'
import { timingSafeEqual } from 'crypto'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

const SYSTEM_PROMPT = `Eres un evaluador experto del Gender Inclusion Index (GII) v1.0 para actividades TechLARP.
Tu tarea es evaluar 22 criterios de inclusión de género en el diseño de una actividad educativa de LARP (juego de rol en vivo).
El diseñador ya ha evaluado 5 criterios directamente relacionados con su diseño concreto.
Tú debes evaluar los 22 criterios complementarios, analizando el contenido completo del LARP.

Los 22 criterios que debes evaluar son:
IT-03: La actividad evita estereotipar culturas, etnias o contextos socioeconómicos en los roles narrativos.
IT-04: El diseño incluye adaptaciones para estudiantes con diversidad funcional física, sensorial o cognitiva.
IM-01: Los materiales visuales (cartas, ilustraciones) muestran diversidad de género, etnia y corporalidad.
IM-02: Las figuras históricas o científicas referenciadas incluyen mujeres y personas no binarias relevantes en STEM.
IM-03: Los roles protagonistas no concentran agencia narrativa exclusivamente en personajes masculinos o masculinizados.
LA-01: Los textos de la actividad (misiones, cartas, storyboard) usan lenguaje no sexista o inclusivo.
LA-02: Las instrucciones para el alumnado evitan el masculino genérico cuando se habla de personas o grupos.
LA-03: El vocabulario técnico STEM se explica de forma accesible, sin presuponer conocimiento previo diferenciado por género.
PA-01: La estructura de misiones permite distribución equitativa de roles de liderazgo sin favorecer perfiles dominantes.
PA-02: Los roles tienen importancia narrativa equivalente; ninguno es sistemáticamente subordinado.
PA-03: El diseño incluye mecanismos explícitos para garantizar la participación de estudiantes típicamente silenciadas o invisibilizadas.
EI-01: Los objetivos de aprendizaje incluyen explícitamente al menos un objetivo de conciencia o equidad de género.
EI-02: El diseño prevé algún mecanismo de retroalimentación post-piloto sobre experiencia de inclusión del alumnado.
LARP-01: El storyboard evita dinámicas narrativas de rescate en las que personajes femeninos son pasivos o víctimas.
LARP-02: Los roles con habilidades especiales no reproducen jerarquías de poder asociadas al género.
LARP-03: El debriefing post-LARP incluye preguntas explícitas sobre representación de género en la experiencia.
LARP-04: La actividad permite que estudiantes de distintos géneros ocupen cualquier rol sin restricción narrativa.
LARP-05: El facilitador o facilitadora tiene orientaciones específicas sobre inclusión de género en la guía docente.
LARP-06: Las misiones no requieren habilidades físicas que excluyan sistemáticamente a ciertos perfiles de estudiantes.
LARP-07: Los materiales (cartas, fichas) no privilegian la velocidad lectora como única ventaja competitiva.
LARP-08: El número y tipo de roles está diseñado para funcionar con grupos mixtos en género, sin crear roles de relleno.
LARP-09: La actividad incluye al menos una misión que requiere colaboración explícita entre diferentes roles.

Para cada criterio responde con: "cumple", "parcial" o "no_cumple", y proporciona una evidencia breve (máx. 80 caracteres).
Además, señala hasta 3 alertas de inconsistencia si la evaluación del diseñador contradice el contenido del LARP.

Responde ÚNICAMENTE en JSON con la siguiente estructura exacta:
{
  "criteria": {
    "IT-03": { "estado": "cumple|parcial|no_cumple", "evidencia": "...", "confianza": 0.0-1.0 },
    ... (los 22 criterios)
  },
  "alerts": [
    { "criterio": "IT-01", "mensaje": "La evaluación del diseñador indica 'cumple' pero el storyboard muestra..." }
  ],
  "model": "llama-3.3-70b-versatile",
  "evaluated_at": "ISO timestamp"
}`

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Allow internal server-to-server calls (validated by secret token) or admin session
  const internalHeader = req.headers.get('x-internal-token')
  const internalSecret = process.env.INTERNAL_API_SECRET
  // Guard: if INTERNAL_API_SECRET is unset, never allow bypass (prevents open endpoint on default docker compose)
  let isInternalCall = false
  if (internalSecret && internalHeader) {
    try {
      const a = Buffer.from(internalHeader)
      const b = Buffer.from(internalSecret)
      isInternalCall = a.length === b.length && timingSafeEqual(a, b)
    } catch {
      isInternalCall = false
    }
  }
  if (!isInternalCall) {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const { id } = params

  // Fetch full LARP data
  const [larp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${id}
  `
  if (!larp) return NextResponse.json({ error: 'LARP no encontrado' }, { status: 404 })

  const [misiones, roles, cartas, objetivos] = await Promise.all([
    sql`SELECT titulo, objetivo, problema_larp, problema_real, solucion FROM misiones WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT nombre_rol, nombre_habilidad, desc_habilidad FROM roles_participantes WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT nombre, tipo, habilidad, lore, descripcion FROM cartas_juego WHERE edularp_id = ${id} ORDER BY orden`,
    sql`SELECT tipo, descripcion FROM objetivos WHERE edularp_id = ${id}`,
  ])

  // Build the user message with LARP content
  const designerEval = larp.inclusion_index?.designer
    ? Object.entries(larp.inclusion_index.designer)
        .map(([k, v]: [string, any]) => `  ${k}: ${v.estado} — ${v.evidencia?.slice(0, 80) ?? ''}`)
        .join('\n')
    : 'No disponible'

  const userMessage = `=== ACTIVIDAD TECHLARP ===
Nombre: ${larp.nombre}
Descripción: ${larp.descripcion}
Nivel: ${larp.nivel_educativo} | Asignaturas: ${larp.asignaturas}
Duración: ${larp.duracion_min} min | Participantes: ${larp.num_participantes}
Storyboard: ${larp.storyboard}
${larp.storyboard_alt ? `Narrativa alternativa: ${larp.storyboard_alt}` : ''}
Evaluación: ${larp.evaluacion ?? 'No especificada'}
Notas docente: ${larp.notas_docente ?? 'No especificadas'}

=== MISIONES ===
${misiones.map((m: any, i: number) => `${i + 1}. ${m.titulo}\n   Objetivo: ${m.objetivo}\n   LARP: ${m.problema_larp ?? ''} | Real: ${m.problema_real ?? ''}\n   Solución: ${m.solucion ?? ''}`).join('\n')}

=== ROLES ===
${roles.map((r: any) => `- ${r.nombre_rol} | Habilidad: ${r.nombre_habilidad ?? ''} — ${r.desc_habilidad}`).join('\n')}

=== CARTAS ===
${cartas.map((c: any) => `- [${c.tipo}] ${c.nombre}: ${c.descripcion ?? c.lore ?? ''}`).join('\n')}

=== OBJETIVOS DE APRENDIZAJE ===
${objetivos.map((o: any) => `- [${o.tipo}] ${o.descripcion}`).join('\n')}

=== EVALUACIÓN DEL DISEÑADOR (5 criterios) ===
${designerEval}

Evalúa los 22 criterios complementarios siguiendo las instrucciones del sistema.`

  let llmProposal: Record<string, unknown>
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    llmProposal = JSON.parse(raw)
    llmProposal.evaluated_at = new Date().toISOString()
    llmProposal.model = 'llama-3.3-70b-versatile'
  } catch (err) {
    console.error('[analyze] LLM call failed:', err)
    return NextResponse.json({ error: 'LLM analysis failed' }, { status: 500 })
  }

  // Merge into inclusion_index.llm_proposal and update estado
  const currentIndex = larp.inclusion_index ?? {}
  const updatedIndex = {
    ...currentIndex,
    llm_proposal: llmProposal,
  }

  await sql`
    UPDATE edularp
    SET
      inclusion_index = ${sql.json(updatedIndex)},
      estado = 'lm_analyzed'
    WHERE id = ${id}
  `

  // Notify admin
  try {
    const admins = await sql`SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1`
    if (admins.length > 0) {
      await sql`
        INSERT INTO notificaciones (usuario_id, tipo, mensaje, edularp_id)
        VALUES (
          ${admins[0].id},
          'analisis_completado',
          ${`Análisis IA completado para "${larp.nombre}". Listo para revisión.`},
          ${id}
        )
      `
    }
  } catch (notifErr) {
    // Notification failure does not block the response
    console.warn('[analyze] Could not create notification:', notifErr)
  }

  return NextResponse.json({ ok: true, id, estado: 'lm_analyzed' })
}
