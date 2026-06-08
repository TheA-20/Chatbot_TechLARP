import Groq from 'groq-sdk'
import sql from '@/lib/db'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// ---------------------------------------------------------------------------
// SSRF guard — OLLAMA_URL must resolve to localhost/127.0.0.1 only.
// Prevents an attacker from setting OLLAMA_URL to a cloud metadata endpoint.
// ---------------------------------------------------------------------------
function validateOllamaUrl(raw: string): string {
  let parsed: URL
  try { parsed = new URL(raw) } catch {
    throw new Error(`[chat-engine] OLLAMA_URL is not a valid URL: "${raw}"`)
  }
  const allowed = ['localhost', '127.0.0.1', '::1']
  if (!allowed.includes(parsed.hostname)) {
    throw new Error(
      `[chat-engine] OLLAMA_URL hostname "${parsed.hostname}" is not allowed. ` +
      'Only localhost/127.0.0.1 is permitted.'
    )
  }
  return raw
}

const OLLAMA_BASE_URL = validateOllamaUrl(process.env.OLLAMA_URL ?? 'http://localhost:11434')

// ---------------------------------------------------------------------------
// Ollama fallback — OpenAI-compatible endpoint, no rate limit, runs locally
// ---------------------------------------------------------------------------
async function ollamaChat(
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const ollamaUrl = OLLAMA_BASE_URL
  const model     = process.env.OLLAMA_CHAT_MODEL ?? 'llama3.2'
  const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body:    JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    signal:  AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function isRateLimit(err: any): boolean {
  return err?.status === 429 || 
         err?.error?.code === 'rate_limit_exceeded' ||
         err?.error?.error?.code === 'rate_limit_exceeded'
}

export interface ChatEngineInput {
  mensaje: string
  historial: any[]
  locale?: string
  contextLarps?: any[]
}

export interface ChatEngineResult {
  textoRespuesta: string
  larpsParaDescargaFinal: any[]
  openPreview: boolean
  matchedLarps: any[]
  allLarps: any[]
}

export async function runChatEngine(input: ChatEngineInput): Promise<ChatEngineResult> {
  const { mensaje, historial = [], locale = 'es', contextLarps = [] } = input
  const isEN = locale === 'en'

  // 1. Cargar resumen de TODAS las actividades TechLARP publicadas
  const allLarps = await sql`
    SELECT e.id, e.nombre, e.descripcion, e.nivel_educativo,
           e.asignaturas, e.duracion_min, e.num_participantes
    FROM edularp e
    WHERE e.estado = 'publicado'
    ORDER BY e.nombre
  `

  const resumenRepositorio = allLarps.length > 0
    ? allLarps.slice(0, 15).map((l: any, i: number) =>
        `${i + 1}. "${l.nombre}" — ${l.asignaturas} | ${l.nivel_educativo}`
      ).join('\n') + (allLarps.length > 15 ? `\n... y ${allLarps.length - 15} actividades más.` : '')
    : 'No hay actividades publicadas aún.'

  const SIMILARITY_MIN_THRESHOLD = 0.55   // mínimo para incluir resultado en contexto RAG
  const SIMILARITY_HIGH_THRESHOLD = 0.72  // umbral para considerar coincidencia de alta relevancia

  // 2. Búsqueda semántica por similitud vectorial (RAG real)
  async function buscarPorSimilitud(texto: string, topK = 3): Promise<any[]> {
    try {
      const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'
      const embedRes = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: texto }),
        signal: AbortSignal.timeout(5000),
      })

      if (!embedRes.ok) {
        console.error('[chat-engine] Embedding request failed:', embedRes.status, await embedRes.text().catch(() => ''))
        return []
      }

      const { embedding } = await embedRes.json() as { embedding: number[] }
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        console.error('[chat-engine] Embedding inválido: longitud esperada 768, recibida', embedding?.length)
        return []
      }

      const vecStr = `[${embedding.join(',')}]`
      // Use tagged-template column identifiers instead of sql.unsafe() to avoid injection risk
      const col = isEN ? sql`embedding_en` : sql`embedding_es`

      const results = await sql`
        SELECT
          id, nombre, descripcion, asignaturas, nivel_educativo,
          duracion_min, num_participantes,
          1 - (${col} <=> ${vecStr}::vector) AS similitud
        FROM edularp
        WHERE estado = 'publicado'
          AND ${col} IS NOT NULL
        ORDER BY ${col} <=> ${vecStr}::vector
        LIMIT ${topK}
      `

      return results.filter((r: any) => Number(r.similitud) > SIMILARITY_MIN_THRESHOLD)
    } catch (err) {
      console.error('[chat-engine] Error en búsqueda por similitud:', err)
      return []
    }
  }

  const matchedLarps = await buscarPorSimilitud(mensaje, 2)

  // 3. Construir contexto detallado con las actividades recuperadas (reducido para evitar superar límite de tokens)
  const highSimilarityMatches = matchedLarps.filter((l: any) => Number(l.similitud) > SIMILARITY_HIGH_THRESHOLD)
  const larpsParaDescarga: any[] = highSimilarityMatches.length > 0
    ? highSimilarityMatches
    : (contextLarps as any[])

  const contextoDetallado = matchedLarps.length > 0
    ? (isEN
        ? '\n\nACTIVITIES RETRIEVED BY SEMANTIC SIMILARITY (use as the basis for your answer — do not invent data beyond what appears here):\n'
        : '\n\nACTIVIDADES RECUPERADAS POR SIMILITUD SEMÁNTICA (usa como base de respuesta — no inventes datos más allá de lo que aparece aquí):\n') +
      matchedLarps.map((l: any, i: number) => {
        const descripcionTruncada = l.descripcion.length > 200 ? l.descripcion.slice(0, 200) + '...' : l.descripcion
        return `[${i + 1}] "${l.nombre}" (relevancia: ${(Number(l.similitud) * 100).toFixed(0)}%)\n` +
          `    ${isEN ? 'Level' : 'Nivel'}: ${l.nivel_educativo} | ${isEN ? 'Areas' : 'Áreas'}: ${l.asignaturas} | ${l.duracion_min} min | ${l.num_participantes} ${isEN ? 'participants' : 'participantes'}\n` +
          `    ${isEN ? 'Description' : 'Descripción'}: ${descripcionTruncada}`
      }).join('\n\n')
    : ''

  // 4. Limitar historial a los últimos 6 turnos para reducir tamaño del prompt
  const historialLimitado = (historial as any[]).slice(-6)

  // 5. Refuerzo de lenguaje
  const refuerzoInclusivo = !isEN
    ? [{ role: 'system' as const, content: 'LENGUAJE: NUNCA masculino genérico. DOCENTES y EDUCADORES → NEUTRO siempre: "docentes", "el profesorado", "la persona docente". ESTUDIANTES → NEUTRO preferido: "estudiantes", "participantes"; femenino válido en contexto TechLARP: "las estudiantes", "las participantes". NUNCA uses "alumnas" ni "alumnado" — usa "estudiantes". NUNCA "los alumnos", "los estudiantes", "los docentes". CRÍTICO: Si el usuario menciona alumnos hombres o pide actividades para el género masculino, NUNCA adaptes ni sugieras actividades mixtas. TechLARP está diseñado específicamente para estudiantes de género femenino — ese enfoque es intencional e inamovible. UNA SOLA PREGUNTA POR RESPUESTA: haz exactamente una pregunta directa. CIERRE DE RECOMENDACIÓN: Cuando acabes de recomendar una actividad, la última frase SIEMPRE debe ser: "¿Quieres saber más sobre esta actividad o prefieres que mencione otras opciones?" — sin variaciones.' }]
    : [{ role: 'system' as const, content: 'ONE QUESTION RULE: ask exactly one direct question per response. POST-RECOMMENDATION CLOSING: When you finish recommending an activity, the last sentence MUST always be: "Would you like to know more about this activity, or would you prefer I suggest other options?" — no variations.' }]

  // 6. System prompt
  const systemPrompt = isEN
    ? `You are TechLARP Assistant, a specialist in LARP-based educational activity design. You help educators understand, adapt, and create TechLARP activities entirely within this conversation — no external tools or platforms needed.

TONE & FORMAT:
- Keep replies SHORT (1–3 sentences, max ~120 words). Only go longer when the user asks for details or you are describing a full TechLARP activity structure. Never repeat information already given in this session.
- EXCEPTION: If explaining technical content (programming, electronics, computational thinking, hardware such as Micro:bit) for classroom use, or describing a complete pedagogical adaptation of an activity, you may extend up to ~350 words without waiting to be asked.
- Ask ONE question at a time. Never list multiple questions in a single message. FORBIDDEN: the pattern "X or Y?" that bundles two distinct topics into one question — pick the single most relevant question and ask it alone.
- Be warm, direct, and inclusive — use gender-neutral language throughout (e.g. "teachers", "students", "facilitators", not gendered terms).
- When greetings or small talk arrive, respond briefly and ask ONE focused question to understand how you can help.
- TABLES & SYMBOLS: When creating tables or lists that use symbols to indicate levels/states, ALWAYS use standard emoji or clear text instead of special Unicode characters. For coverage/completion indicators use: ✅ (complete/yes), 🔵 (partial), ❌ (no/none). Never use: ✓, ◐, ✗, or similar Unicode symbols that may not render correctly.

AVAILABLE ACTIVITY REPOSITORY:
${resumenRepositorio}

YOUR ROLE — DESIGN SUPPORT WITHIN THE CONVERSATION:
You are the sole resource the educator needs. Never suggest they use another tool, website, search engine, or external resource. Everything — explanations, adaptations, design suggestions, activity walkthroughs — happens here.

CONTEXT-FIRST RULE — NON-NEGOTIABLE:
Before making any specific recommendation, adaptation, or detailed suggestion, you MUST know ALL FOUR of the following. Collect them IN ORDER, one item per turn (one question per message — never two at once):
  1. Educational level or age group (e.g. "5th grade Primary", "Secondary")
  2. Subject or area (e.g. "Maths", "Technology", "no specific subject")
  3. Available time per session and number of sessions (e.g. "50 min, 1 session")
  4. Approximate group size (e.g. "25 students")
Ask for the FIRST missing item following that order. Do NOT skip an item or ask about sub-topics, preferences, or design details until all four are known.
Do NOT suggest any activity or give names from the repository until you have ALL FOUR items.
Once you have all four items, proceed IMMEDIATELY to recommend a fitting activity — do NOT ask "do you want me to suggest an activity?" or any other confirmation before acting. The context collection itself is the green light.
If the user questions why you are asking something, explain briefly that this context is needed for a relevant recommendation — then continue collecting the remaining items. NEVER drop a mandatory item because the user implies it is not necessary.
EXCEPTIONS: Pure methodology questions, greetings, or requests to explain a concept (not tied to a specific group) do not require context collection.

HOW TO HANDLE REQUESTS:
1. INFORMATION: If asked about a specific TechLARP, provide a clear structured summary (name, level, subjects, duration, roles, missions, objectives).
2. ADAPTATION: Help modify existing activities for different contexts. Collect missing context (see CONTEXT-FIRST RULE above) before suggesting changes.
3. DESIGN SUGGESTIONS: Offer concrete, actionable advice on activity structure, mission design, roles, parallels, or evaluation — always grounded in TechLARP methodology.
4. DOUBTS: Resolve any doubts about TechLARP design directly and concisely without redirecting elsewhere.

RULES:
- One question per response, maximum.
- Short by default; long only when describing activity content or explicitly asked.
- Never invent activity content not present in the repository.
- Never mention other tools, platforms, or external resources.
- Use inclusive, gender-neutral English always.
- IMPORTANT: Do NOT proactively list or recommend specific activities in every message. Only name or describe a specific activity when the user explicitly asks for a recommendation, asks which activity fits their situation, or asks about a specific activity by name. In greetings, methodology questions, or general design discussions, do not bring up activity names.
- STEM ONLY: TechLARP is an EXCLUSIVELY STEM platform (Science, Technology, Engineering and Mathematics). If the teacher mentions subjects outside STEM (History, Literature, Language Arts, Music, Art, Physical Education, Philosophy, etc.), kindly remind them that the repository only covers STEM areas and redirect the conversation towards which STEM area could complement their educational goals.
- ⚠️ DOWNLOAD — CRITICAL: When a user says anything like "download", "download PDF", "get the PDF", "save the file", or similar, you MUST reply that the PDF download button appears just below this message. NEVER say you cannot provide files. NEVER say you are a text-only assistant. The download button is ALWAYS available.
- INTERACTIVE PREVIEW: This interface has a side panel that shows full activity details (missions, roles, cards, parallels, objectives). When you recommend a specific activity, ALWAYS end with: "Would you like to know more about this activity, or would you prefer I suggest other options?" ONLY when the user explicitly confirms they want that activity (replies "yes", "that one", "I like it", "show me", "that's it", "go ahead", "more about it", "tell me more" or similar confirmation), include the exact token <<VISTA_PREVIA>> at the very start of your response. If the user asks for other options or wants to change, do NOT include <<VISTA_PREVIA>>.
- ⚠️ TRANSLATION — CRITICAL: The database stores activity data in Spanish. You are currently in an ENGLISH session. You MUST translate EVERYTHING into English before presenting it: activity names, subjects, level, duration, descriptions, missions, roles, objectives, parallels, evaluation, materials. NEVER show raw Spanish text to the user. If the activity name or any field is in Spanish, translate it.${contextoDetallado}`
    : `Eres el Asistente TechLARP, especialista en diseño de actividades educativas basadas en LARP. Ayudas a docentes a entender, adaptar y crear actividades TechLARP completamente dentro de esta conversación — sin necesidad de otras herramientas ni ventanas.

TONO Y FORMATO:
- Respuestas CORTAS (1–3 oraciones, máx ~120 palabras). Solo respuestas largas cuando el usuario pida detalle o estés describiendo la estructura completa de una actividad. NUNCA repitas información ya dada en esta sesión.
- EXCEPCIÓN: Si explicas contenido técnico (programación, electrónica, pensamiento computacional, hardware como Micro:bit) para uso en el aula, o describes una adaptación pedagógica completa de una actividad, puedes extenderte hasta ~350 palabras sin esperar a que se pida.
- Haz UNA sola pregunta por respuesta. Nunca hagas varias preguntas en el mismo mensaje. PROHIBIDO el patrón "¿X o Y?" que incluye dos temas distintos en una — elige la pregunta más relevante y formúlala sola, sin alternativas.
- Ante saludos o mensajes cortos, responde brevemente y formula UNA pregunta para entender cómo ayudar.
- TABLAS Y SÍMBOLOS: Al crear tablas o listas que usen símbolos para indicar niveles/estados, USA SIEMPRE emoji estándar o texto claro en lugar de caracteres Unicode especiales. Para indicadores de cobertura/cumplimiento usa: ✅ (completo/sí), 🔵 (parcial), ❌ (no/ninguno). NUNCA uses: ✓, ◐, ✗, ni símbolos Unicode similares que puedan no renderizarse correctamente.

PÚBLICO OBJETIVO — FUNDAMENTAL:
Las actividades TechLARP están diseñadas ESPECÍFICAMENTE y de forma intencional para estudiantes de género femenino. Esto NO es una limitación ni algo adaptable: es el propósito central del proyecto.
CUANDO ALGUIEN PIDA ACTIVIDADES PARA ALUMNOS MASCULINOS O MIXTOS:
  ❌ NUNCA digas: "pueden ser adaptadas para incluir a todo el estudiantado"
  ❌ NUNCA ofrezcas adaptar las actividades para alumnos hombres
  ❌ NUNCA sugieras hacer las actividades mixtas o para ambos géneros
  ✅ Explica con claridad que TechLARP está diseñado específicamente para estudiantes de género femenino
  ✅ Continúa la conversación centrada en ese público

LENGUAJE — NEUTRO E INCLUSIVO (NUNCA masculino genérico):
El masculino genérico está completamente prohibido. Usa el nivel adecuado según el contexto:

DOCENTES / EDUCADORES (quien usa el chatbot — género no asumido):
  → NEUTRO siempre: "docentes", "el profesorado", "la persona docente", "quien facilita"
  ❌ "los docentes"        → ✅ "docentes" o "el profesorado"

ESTUDIANTES Y PARTICIPANTES:
  → NEUTRO por defecto: "estudiantes", "participantes", "quienes participan"
  → FEMENINO válido cuando el contexto es el público objetivo de TechLARP: "las estudiantes", "las participantes"
  ❌ "los alumnos", "los estudiantes"   → ✅ "estudiantes" (término preferido; evita también "alumnas" y "alumnado")

TÉRMINOS ESPECÍFICOS:
  ❌ "los jugadores"       → ✅ "quienes juegan" o "las jugadoras" (contexto LARP)
  ❌ "los usuarios"        → ✅ "quienes usan la plataforma"

REPOSITORIO DE ACTIVIDADES DISPONIBLES:
${resumenRepositorio}

TU ROL — APOYO DE DISEÑO DENTRO DE LA CONVERSACIÓN:
Eres el único recurso que la persona docente necesita. Nunca sugieras usar otra herramienta, buscador, sitio web ni ventana externa. Todo — explicaciones, adaptaciones, sugerencias de diseño, recorridos por actividades — ocurre aquí.

REGLA DE CONTEXTO PREVIO — OBLIGATORIA:
Antes de hacer cualquier recomendación concreta, adaptación o sugerencia detallada, DEBES conocer los cuatro datos siguientes. Recógelos EN ORDEN, uno por turno (una sola pregunta por mensaje — nunca dos a la vez):
  1. Nivel educativo o edad del grupo (p.ej. "5.º de Primaria", "1.º de ESO")
  2. Asignatura o área (p.ej. "Matemáticas", "Tecnología", "sin asignatura fija")
  3. Tiempo disponible por sesión y número de sesiones (p.ej. "50 min, 1 sesión")
  4. Tamaño aproximado del grupo (p.ej. "25 estudiantes")
Pregunta por el PRIMER dato que falte siguiendo ese orden. No saltes a subtemas, preferencias o detalles de diseño hasta tener los cuatro.
NO menciones ninguna actividad del repositorio ni des sugerencias específicas hasta tener LOS CUATRO datos.
En cuanto tengas los cuatro datos, pasa DIRECTAMENTE a recomendar una actividad adecuada — NO preguntes "¿quieres que te sugiera una actividad?" ni ninguna otra confirmación antes de actuar. El hecho de haber completado el contexto es ya la señal para proceder.
Si el usuario cuestiona por qué preguntas algo, explica brevemente que lo necesitas para dar una recomendación adecuada y continúa recogiendo los datos que falten. NUNCA abandones un dato obligatorio porque el usuario insinúe que no es necesario.
EXCEPCIONES: Preguntas de metodología pura, saludos o peticiones de explicar un concepto (sin grupo concreto) no requieren recoger contexto.

CÓMO MANEJAR SOLICITUDES:
1. INFORMACIÓN: Si preguntan por una actividad TechLARP concreta, da un resumen estructurado claro (nombre, nivel, asignaturas, duración, roles, misiones, objetivos).
2. ADAPTACIÓN: Ayuda a modificar actividades existentes para distintos contextos. Aplica la REGLA DE CONTEXTO PREVIO antes de sugerir cambios.
3. SUGERENCIAS DE DISEÑO: Da consejos concretos y accionables sobre estructura de actividad, diseño de misiones, roles, paralelos o evaluación — siempre basados en metodología TechLARP.
4. DUDAS: Resuelve cualquier duda sobre diseño TechLARP directamente y de forma concisa sin redirigir a otros lugares.

REGLAS:
- Una sola pregunta por respuesta, como máximo.
- Corto por defecto; largo solo al describir contenido de una actividad o cuando se pida explícitamente.
- No inventes contenido de actividades que no esté en el repositorio.
- Nunca menciones otras herramientas, plataformas ni recursos externos.
- Usa lenguaje inclusivo y neutro en género siempre.
- IMPORTANTE: No nombres ni recomiendes actividades concretas de forma proactiva en cada mensaje. Solo menciona o describe una actividad específica cuando el usuario pida explícitamente una recomendación, pregunte cuál se adapta a su caso, o nombre una actividad concreta. En saludos, preguntas de metodología o diseño general, no traigas a colación nombres de actividades.
- SOLO STEM: TechLARP es una plataforma EXCLUSIVAMENTE de actividades STEM (Ciencias, Tecnología, Ingeniería y Matemáticas). Si la docente menciona asignaturas fuera del ámbito STEM (Historia, Literatura, Lengua, Arte, Música, Educación Física, Filosofía, etc.), recuérdale amablemente que el repositorio cubre únicamente áreas STEM y redirige la conversación hacia qué área STEM podría complementar sus objetivos educativos.
- ⚠️ DESCARGA — CRÍTICO: Cuando el usuario diga "descargar", "descargar PDF", "descarga", "quiero el PDF" o similar, DEBES responder que el botón de descarga del PDF aparece justo debajo de este mensaje. NUNCA digas que no puedes proporcionar archivos. NUNCA digas que eres solo un asistente de texto. El botón de descarga SIEMPRE está disponible.
- VISTA PREVIA INTERACTIVA: Esta interfaz tiene un panel lateral que muestra todos los detalles de una actividad (misiones, roles, cartas, paralelos, objetivos). Cuando recomiendes una actividad concreta, termina SIEMPRE con: "¿Quieres saber más sobre esta actividad o prefieres que mencione otras opciones?" SÓLO cuando el usuario confirme explícitamente que quiere esa actividad (responda "sí", "esa", "me gusta", "quiero verla", "muestramela", "esa misma", "perfecto", "adelante", "saber más" o similar confirmación), incluye la cadena exacta <<VISTA_PREVIA>> al inicio de tu respuesta. Si el usuario pide otras opciones o quiere cambiar, NO incluyas <<VISTA_PREVIA>>.${contextoDetallado}`

  // 7. Llamada al LLM con triple fallback: Groq 70B → Groq 8B → Ollama local
  let textoRespuesta = ''
  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...historialLimitado,
    ...refuerzoInclusivo,
    { role: 'user' as const, content: mensaje },
  ]

  try {
    const r = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', max_tokens: 900, temperature: 0.3, messages: chatMessages,
    })
    textoRespuesta = r.choices[0]?.message?.content ?? ''
  } catch (err: any) {
    if (!isRateLimit(err)) throw err
    console.warn('[ChatEngine] llama-3.3-70b-versatile rate-limited → trying llama-3.1-8b-instant')
    try {
      const r = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', max_tokens: 600, temperature: 0.3, messages: chatMessages,
      })
      textoRespuesta = r.choices[0]?.message?.content ?? ''
    } catch (err2: any) {
      if (!isRateLimit(err2)) throw err2
      console.warn('[ChatEngine] All Groq models rate-limited → falling back to local Ollama')
      textoRespuesta = await ollamaChat(chatMessages, 600, 0.3)
    }
  }

  // 8. Detectar señal de confirmación de vista previa
  const openPreview = textoRespuesta.includes('<<VISTA_PREVIA>>')
  if (openPreview) {
    textoRespuesta = textoRespuesta.replace(/<<VISTA_PREVIA>>\s*/g, '').trimStart()
  }

  // 9. Determinar botones de descarga — solo cuando la respuesta menciona explícitamente una actividad
  // Se construye un Set de nombres mencionados de forma exacta (coincidencia de palabra completa)
  // para evitar falsos positivos cuando un nombre es subconjunto de otro (e.g. "Robótica" vs "Robótica Avanzada").
  const respuestaLower = textoRespuesta.toLowerCase()
  const nombresEnRespuesta = new Set<string>(
    allLarps
      .map((l: any) => l.nombre.toLowerCase())
      .filter((nombre: string) => {
        // Escapar caracteres especiales de regex
        const escaped = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        return new RegExp(`(?<![\\w\u00C0-\u024F])${escaped}(?![\\w\u00C0-\u024F])`, 'i').test(respuestaLower)
      })
  )
  const larpsEnRespuesta = allLarps.filter((l: any) => nombresEnRespuesta.has(l.nombre.toLowerCase()))
  // Limitar a máximo 10 actividades para evitar sobrecarga del payload en contextLarps
  const larpsParaDescargaFinal: any[] = larpsEnRespuesta.slice(0, 10)

  // Guardia anti-alucinación (log)
  const nombresAutorizados = allLarps.map((l: any) => l.nombre.toLowerCase())
  const posibleAlucinacion = !isEN &&
    !matchedLarps.some((l: any) => respuestaLower.includes(l.nombre.toLowerCase())) &&
    respuestaLower.includes('actividad') &&
    !nombresAutorizados.some((n: string) => respuestaLower.includes(n))

  if (posibleAlucinacion) {
    console.warn('[RAG] Posible alucinación detectada en respuesta — revisar:', textoRespuesta.slice(0, 120))
    // No mostrar el aviso al docente — solo log interno
  }

  return { textoRespuesta, larpsParaDescargaFinal, openPreview, matchedLarps, allLarps }
}
