import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Groq from 'groq-sdk'
import sql from '@/lib/db'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { mensaje, historial = [], locale = 'es', sessionId = null, contextLarps = [] } = await req.json()
  if (!mensaje?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  // Determinar si necesitamos crear una nueva sesión
  let currentSessionId = sessionId
  let sessionTitle = ''

  // 2. Cargar resumen de TODAS las actividades TechLARP publicadas
  const allLarps = await sql`
    SELECT e.id, e.nombre, e.descripcion, e.nivel_educativo,
           e.asignaturas, e.duracion_min, e.num_participantes
    FROM edularp e
    WHERE e.estado = 'publicado'
    ORDER BY e.nombre
  `

  const resumenRepositorio = allLarps.length > 0
    ? allLarps.map((l: any, i: number) =>
        `${i + 1}. "${l.nombre}" — ${l.asignaturas} | ${l.nivel_educativo} | ${l.duracion_min} min | hasta ${l.num_participantes} estudiantes`
      ).join('\n')
    : 'No hay actividades publicadas aún.'

  // 3. Búsqueda semántica por similitud vectorial (RAG real)
  // Si Ollama no está disponible, cae silenciosamente a contexto vacío
  const isEN = locale === 'en'

  async function buscarPorSimilitud(texto: string, topK = 3): Promise<any[]> {
    try {
      const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'
      const embedRes = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: texto }),
        signal: AbortSignal.timeout(5000), // 5s timeout para no bloquear la respuesta
      })

      if (!embedRes.ok) return []

      const { embedding } = await embedRes.json() as { embedding: number[] }
      if (!Array.isArray(embedding) || embedding.length !== 768) return []

      const vecStr = `[${embedding.join(',')}]`
      // Seleccionar la columna del idioma detectado
      const embeddingCol = isEN ? 'embedding_en' : 'embedding_es'

      // Búsqueda híbrida: similitud coseno HNSW + filtro estado publicado
      // Solo recuperar actividades cuyo embedding exista (columna NOT NULL)
      const results = await sql`
        SELECT
          id, nombre, descripcion, asignaturas, nivel_educativo,
          duracion_min, num_participantes,
          1 - (${sql.unsafe(embeddingCol)} <=> ${vecStr}::vector) AS similitud
        FROM edularp
        WHERE estado = 'publicado'
          AND ${sql.unsafe(embeddingCol)} IS NOT NULL
        ORDER BY ${sql.unsafe(embeddingCol)} <=> ${vecStr}::vector
        LIMIT ${topK}
      `

      // Umbral mínimo de relevancia: descartar recuperaciones ruidosas
      return results.filter((r: any) => Number(r.similitud) > 0.55)
    } catch {
      // Ollama caído o sin embeddings: el LLM seguirá con el resumen general
      return []
    }
  }

  const matchedLarps = await buscarPorSimilitud(mensaje, 3)

  // 4. Construir contexto detallado con las actividades recuperadas
  // Prioridad: nuevas actividades con alta similitud (>0.72).
  // Fallback: heredar las del turno anterior (contextLarps) para que los botones persistan
  // mientras la conversación continúe sobre las mismas actividades (ej. "no lo veo", "dónde está").
  const highSimilarityMatches = matchedLarps.filter((l: any) => Number(l.similitud) > 0.72)
  const larpsParaDescarga: any[] = highSimilarityMatches.length > 0
    ? highSimilarityMatches
    : (contextLarps as any[])

  const contextoDetallado = matchedLarps.length > 0
    ? (isEN
        ? '\n\nACTIVITIES RETRIEVED BY SEMANTIC SIMILARITY (use as the basis for your answer — do not invent data beyond what appears here):\n'
        : '\n\nACTIVIDADES RECUPERADAS POR SIMILITUD SEMÁNTICA (usa como base de respuesta — no inventes datos más allá de lo que aparece aquí):\n') +
      matchedLarps.map((l: any, i: number) =>
        `[${i + 1}] "${l.nombre}" (relevancia: ${(Number(l.similitud) * 100).toFixed(0)}%)\n` +
        `    ${isEN ? 'Level' : 'Nivel'}: ${l.nivel_educativo} | ${isEN ? 'Areas' : 'Áreas'}: ${l.asignaturas} | ${l.duracion_min} min | ${l.num_participantes} ${isEN ? 'participants' : 'participantes'}\n` +
        `    ${isEN ? 'Description' : 'Descripción'}: ${l.descripcion}`
      ).join('\n\n')
    : ''

  // 5. Limitar historial a los últimos 10 turnos (5 pares usuario/asistente)
  // Evita exceder el context window del modelo en sesiones largas
  const historialLimitado = (historial as any[]).slice(-10)

  // Refuerzo de lenguaje inclusivo — se inyecta en cada turno en español
  // Se coloca al final del historial, justo antes del mensaje del usuario, para máxima efectividad
  const refuerzoInclusivo = !isEN
    ? [{ role: 'system' as const, content: 'LENGUAJE OBLIGATORIO: usa SIEMPRE formas femeninas o colectivas. PROHIBIDO: "los estudiantes", "los participantes", "los docentes", "los alumnos". CORRECTO: "las estudiantes", "el estudiantado", "las participantes", "las docentes", "el alumnado", "quienes participan". Este requisito no tiene excepciones. CRÍTICO: Si el usuario menciona alumnos hombres, alumnos masculinos, o pide actividades para el género masculino, NUNCA ofrezcas adaptar las actividades para incluirlos ni sugieras hacer las actividades mixtas. TechLARP está diseñado específicamente para alumnas — ese enfoque es intencional e inamovible.' }]
    : []

  // 6. Prompt del sistema con lógica conversacional

  const systemPrompt = isEN
    ? `You are TechLARP Assistant, a specialist in LARP-based educational activity design. You help educators understand, adapt, and create TechLARP activities entirely within this conversation — no external tools or platforms needed.

TONE & FORMAT:
- Keep replies SHORT (1–3 sentences) unless the user asks for details or you are describing a TechLARP activity.
- Ask ONE question at a time. Never list multiple questions in a single message.
- Be warm, direct, and inclusive — use gender-neutral language throughout (e.g. "teachers", "students", "facilitators", not gendered terms).
- When greetings or small talk arrive, respond briefly and ask ONE focused question to understand how you can help.

AVAILABLE ACTIVITY REPOSITORY:
${resumenRepositorio}

YOUR ROLE — DESIGN SUPPORT WITHIN THE CONVERSATION:
You are the sole resource the educator needs. Never suggest they use another tool, website, search engine, or external resource. Everything — explanations, adaptations, design suggestions, activity walkthroughs — happens here.

HOW TO HANDLE REQUESTS:
1. INFORMATION: If asked about a specific TechLARP, provide a clear structured summary (name, level, subjects, duration, roles, missions, objectives).
2. ADAPTATION: Help modify existing activities for different contexts. Ask ONE clarifying question first if you need more context (age group, subject, time, group size, inclusion needs).
3. DESIGN SUGGESTIONS: Offer concrete, actionable advice on activity structure, mission design, roles, parallels, or evaluation — always grounded in TechLARP methodology.
4. DOUBTS: Resolve any doubts about TechLARP design directly and concisely without redirecting elsewhere.

RULES:
- One question per response, maximum.
- Short by default; long only when describing activity content or explicitly asked.
- Never invent activity content not present in the repository.
- Never mention other tools, platforms, or external resources.
- Use inclusive, gender-neutral English always.
- IMPORTANT: Do NOT proactively list or recommend specific activities in every message. Only name or describe a specific activity when the user explicitly asks for a recommendation, asks which activity fits their situation, or asks about a specific activity by name. In greetings, methodology questions, or general design discussions, do not bring up activity names.
- DOWNLOAD CAPABILITY: This chat interface has a built-in PDF download button for activities. When a user asks to download an activity sheet or file, tell them the download button for that activity appears just below this message — do NOT say you cannot provide files. Never say you are a text-only assistant when it comes to downloads.
- INTERACTIVE PREVIEW: This interface has a side panel that shows full activity details (missions, roles, cards, parallels, objectives). When you recommend a specific activity, finish by asking whether that is the one the teacher is looking for or whether they would like to see it in detail. ONLY when the user explicitly confirms they want that activity (replies "yes", "that one", "I like it", "show me", "that's it", "go ahead", "perfect" or similar confirmation), include the exact token <<VISTA_PREVIA>> at the very start of your response. This will automatically open the preview panel. If the user asks for a different activity or wants to change, do NOT include <<VISTA_PREVIA>>.${contextoDetallado}`
    : `Eres el Asistente TechLARP, especialista en diseño de actividades educativas basadas en LARP. Ayudas a docentes a entender, adaptar y crear actividades TechLARP completamente dentro de esta conversación — sin necesidad de otras herramientas ni ventanas.

TONO Y FORMATO:
- Respuestas CORTAS (1–3 oraciones) salvo que el usuario pida detalle o estés describiendo una actividad TechLARP.
- Haz UNA sola pregunta por respuesta. Nunca hagas varias preguntas en el mismo mensaje.
- Ante saludos o mensajes cortos, responde brevemente y formula UNA pregunta para entender cómo ayudar.

PÚBLICO OBJETIVO — FUNDAMENTAL:
Las actividades TechLARP están diseñadas ESPECÍFICAMENTE y de forma intencional para estudiantes de género femenino. Esto NO es una limitación ni algo adaptable: es el propósito central del proyecto.
CUANDO ALGUIEN PIDA ACTIVIDADES PARA ALUMNOS MASCULINOS O MIXTOS:
  ❌ NUNCA digas: "pueden ser adaptadas para incluir a todo el alumnado"
  ❌ NUNCA ofrezcas adaptar las actividades para alumnos hombres
  ❌ NUNCA sugieras hacer las actividades mixtas o para ambos géneros
  ✅ Explica con claridad que TechLARP está diseñado específicamente para alumnas
  ✅ Continúa la conversación centrada en ese público femenino

LENGUAJE INCLUSIVO — OBLIGATORIO SIN EXCEPCIONES:
Por ello el lenguaje debe reflejar esa realidad en todo momento.
FORMAS PROHIBIDAS → FORMAS CORRECTAS:
  ❌ "los estudiantes"     → ✅ "las estudiantes" o "el estudiantado"
  ❌ "los participantes"   → ✅ "las participantes" o "quienes participan"
  ❌ "los alumnos"         → ✅ "las alumnas" o "el alumnado"
  ❌ "los docentes"        → ✅ "las docentes" o "el profesorado"
  ❌ "los jugadores"       → ✅ "las jugadoras" o "quienes juegan"
  ❌ "los usuarios"        → ✅ "las usuarias"
Usa siempre la forma femenina o colectiva. El masculino genérico está completamente prohibido en todas tus respuestas.

REPOSITORIO DE ACTIVIDADES DISPONIBLES:
${resumenRepositorio}

TU ROL — APOYO DE DISEÑO DENTRO DE LA CONVERSACIÓN:
Eres el único recurso que la persona docente necesita. Nunca sugieras usar otra herramienta, buscador, sitio web ni ventana externa. Todo — explicaciones, adaptaciones, sugerencias de diseño, recorridos por actividades — ocurre aquí.

CÓMO MANEJAR SOLICITUDES:
1. INFORMACIÓN: Si preguntan por una actividad TechLARP concreta, da un resumen estructurado claro (nombre, nivel, asignaturas, duración, roles, misiones, objetivos).
2. ADAPTACIÓN: Ayuda a modificar actividades existentes para distintos contextos. Haz UNA pregunta aclaratoria primero si necesitas más contexto (edad, asignatura, tiempo, tamaño del grupo, necesidades de inclusión).
3. SUGERENCIAS DE DISEÑO: Da consejos concretos y accionables sobre estructura de actividad, diseño de misiones, roles, paralelos o evaluación — siempre basados en metodología TechLARP.
4. DUDAS: Resuelve cualquier duda sobre diseño TechLARP directamente y de forma concisa sin redirigir a otros lugares.

REGLAS:
- Una sola pregunta por respuesta, como máximo.
- Corto por defecto; largo solo al describir contenido de una actividad o cuando se pida explícitamente.
- No inventes contenido de actividades que no esté en el repositorio.
- Nunca menciones otras herramientas, plataformas ni recursos externos.
- Usa lenguaje inclusivo y neutro en género siempre.
- IMPORTANTE: No nombres ni recomiendes actividades concretas de forma proactiva en cada mensaje. Solo menciona o describe una actividad específica cuando el usuario pida explícitamente una recomendación, pregunte cuál se adapta a su caso, o nombre una actividad concreta. En saludos, preguntas de metodología o diseño general, no traigas a colación nombres de actividades.
- CAPACIDAD DE DESCARGA: Esta interfaz de chat tiene un botón de descarga de PDF integrado para las actividades. Cuando el usuario pida descargar la ficha o el archivo de una actividad, dile que el botón de descarga aparece justo debajo de este mensaje — NUNCA digas que no puedes proporcionar archivos ni que eres solo un asistente de texto cuando se trate de descargas.
- VISTA PREVIA INTERACTIVA: Esta interfaz tiene un panel lateral que muestra todos los detalles de una actividad (misiones, roles, cartas, paralelos, objetivos). Cuando recomiendes una actividad concreta, termina preguntando si es la que la docente busca o si quiere que la veamos en detalle. SÓLO cuando el usuario confirme explícitamente que quiere esa actividad (responda "sí", "esa", "me gusta", "quiero verla", "muestramela", "esa misma", "perfecto", "adelante" o similar confirmación), incluye la cadena exacta <<VISTA_PREVIA>> al inicio de tu respuesta. Esto abrirá automáticamente el panel de vista previa. Si el usuario pide otra actividad diferente o quiere cambiar, NO incluyas <<VISTA_PREVIA>>.${contextoDetallado}`

  // 7. Llamada a Groq con temperatura baja para precisión
  let textoRespuesta = ''
  try {
    const response = await groq.chat.completions.create({
      model:      'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.3, // Baja para evitar alucinaciones, pero permite creatividad en sugerencias
      messages: [
        { role: 'system', content: systemPrompt },
        ...historialLimitado,
        ...refuerzoInclusivo,
        { role: 'user', content: mensaje },
      ],
    })

    textoRespuesta = response.choices[0]?.message?.content ?? ''
  } catch (err: any) {
    console.error('Groq API error:', err)
    return NextResponse.json({
      error: 'Error al contactar el servicio de IA',
      respuesta: isEN
        ? '⚠️ Could not connect to the AI service. Please try again later.'
        : '⚠️ No se pudo conectar con el servicio de IA. Inténtalo de nuevo más tarde.',
    }, { status: 500 })
  }

  // 8a. Detectar señal de confirmación de vista previa y eliminarla del texto
  const openPreview = textoRespuesta.includes('<<VISTA_PREVIA>>')
  if (openPreview) {
    textoRespuesta = textoRespuesta.replace(/<<VISTA_PREVIA>>\s*/g, '').trimStart()
  }

  // 8. Determinar botones de descarga escaneando la respuesta del LLM
  // Si el LLM mencionó una o más actividades por nombre, esas son las que deben
  // tener botón — independientemente del umbral de similitud del mensaje entrante.
  const respuestaLower = textoRespuesta.toLowerCase()
  const larpsEnRespuesta = allLarps.filter((l: any) =>
    respuestaLower.includes(l.nombre.toLowerCase())
  )

  // Prioridad: actividades nombradas en la respuesta > similitud alta > contextLarps heredados
  const larpsParaDescargaFinal: any[] = larpsEnRespuesta.length > 0
    ? larpsEnRespuesta
    : larpsParaDescarga

  const larpsUsados = larpsParaDescargaFinal.map((l: any) => l.id)

  // Guardia anti-alucinación
  const nombresAutorizados = allLarps.map((l: any) => l.nombre.toLowerCase())
  const posibleAlucinacion = !isEN &&
    !matchedLarps.some(l => respuestaLower.includes(l.nombre.toLowerCase())) &&
    respuestaLower.includes('actividad') &&
    !nombresAutorizados.some(n => respuestaLower.includes(n))

  if (posibleAlucinacion) {
    console.warn('[RAG] Posible alucinación detectada en respuesta — revisar:', textoRespuesta.slice(0, 120))
  }

  // Siempre guardar la conversación - no solo cuando hay actividad
  // Si no hay sessionId, crear nueva sesión
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID()
    // Usar el nombre de la actividad como título, o el primer mensaje si no hay actividad
    if (matchedLarps.length > 0) {
      sessionTitle = matchedLarps[0].nombre
    } else {
      sessionTitle = mensaje.substring(0, 60) + (mensaje.length > 60 ? '...' : '')
    }
  } else {
    // Si ya existe la sesión, obtener su título
    const existingSession = await sql`
      SELECT session_title FROM chat_historial 
      WHERE session_id = ${currentSessionId} AND usuario_id = ${(session.user as any).id}
      LIMIT 1
    `
    sessionTitle = existingSession.length > 0 ? existingSession[0].session_title : (matchedLarps.length > 0 ? matchedLarps[0].nombre : mensaje.substring(0, 60))
  }

  // Guardar este intercambio en la sesión
  await sql`
    INSERT INTO chat_historial (
      usuario_id, session_id, session_title, mensaje_usuario, respuesta_bot, larps_usados, actualizado_en
    )
    VALUES (
      ${(session.user as any).id},
      ${currentSessionId},
      ${sessionTitle},
      ${mensaje},
      ${textoRespuesta},
      ${larpsUsados},
      now()
    )
  `

  // Actualizar la fecha de actualización de todos los mensajes de esta sesión
  await sql`
    UPDATE chat_historial 
    SET actualizado_en = now() 
    WHERE session_id = ${currentSessionId} AND usuario_id = ${(session.user as any).id}
  `

  return NextResponse.json({
    respuesta: textoRespuesta,
    sessionId: currentSessionId,
    sessionTitle: sessionTitle,
    larps_encontrados: larpsParaDescargaFinal.length,
    larps: larpsParaDescargaFinal.map((l: any) => ({ id: l.id, nombre: l.nombre, similitud: Number(l.similitud ?? 0) })),
    rag_activo: matchedLarps.length > 0,
    openPreview,
  })
}

// Obtener historial del docente actual
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const historial = await sql`
    SELECT id, mensaje_usuario, respuesta_bot, creado_en
    FROM chat_historial
    WHERE usuario_id = ${(session.user as any).id}
    ORDER BY creado_en DESC
    LIMIT 50
  `
  return NextResponse.json({ historial })
}
