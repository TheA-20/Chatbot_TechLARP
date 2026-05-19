import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

function isRateLimit(err: any): boolean {
  return err?.status === 429 || err?.error?.code === 'rate_limit_exceeded'
}

async function callOllama(systemPrompt: string, payload: any): Promise<any> {
  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const model     = process.env.OLLAMA_CHAT_MODEL ?? 'llama3.2'
  const res = await fetch(`${ollamaUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ollama' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: JSON.stringify(payload) },
      ],
      temperature: 0.1,
      max_tokens: 8192,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'
  // Strip markdown code fences if present
  const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean)
}

async function callGroqFallback(systemPrompt: string, payload: any): Promise<any> {
  const params = {
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: JSON.stringify(payload) },
    ],
  }
  let completion
  try {
    completion = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', ...params })
  } catch (err: any) {
    if (!isRateLimit(err)) throw err
    completion = await groq.chat.completions.create({ model: 'llama-3.1-8b-instant', ...params })
  }
  return JSON.parse(completion.choices[0].message.content ?? '{}')
}

/** Primary: Ollama. Fallback: Groq 70B → Groq 8B */
async function callLLM(systemPrompt: string, payload: any): Promise<any> {
  try {
    return await callOllama(systemPrompt, payload)
  } catch (err) {
    console.warn('[translateLarpInMemory] Ollama failed, falling back to Groq:', (err as any)?.message)
    return callGroqFallback(systemPrompt, payload)
  }
}

export interface LarpChildren {
  paralelos: any[]
  misiones: any[]
  roles: any[]
  cartas: any[]
  objetivos: any[]
}

/**
 * Translate a LARP and its child records in-memory using Groq.
 * Returns translated data without persisting anything to the database.
 * Falls back to the original data if the LLM call fails.
 */
export async function translateLarpInMemory(
  larp: any,
  children: LarpChildren,
  targetLang: 'es' | 'en',
): Promise<{ larp: any } & LarpChildren> {
  const { paralelos, misiones, roles, cartas, objetivos } = children

  const payload = {
    nombre:        larp.nombre,
    proyecto:      larp.proyecto,
    descripcion:   larp.descripcion,
    storyboard:    larp.storyboard,
    storyboard_alt: larp.storyboard_alt,
    asignaturas:   larp.asignaturas,
    materiales:    larp.materiales,
    evaluacion:    larp.evaluacion,
    notas_docente: larp.notas_docente,
    competencias:  larp.competencias,
    paralelos: paralelos.map(p => ({ narrativa: p.narrativa, mundo_real: p.mundo_real, proposito: p.proposito })),
    misiones:  misiones.map(m => ({ titulo: m.titulo, objetivo: m.objetivo, formato: m.formato, problema_larp: m.problema_larp, problema_real: m.problema_real, solucion: m.solucion, recursos: m.recursos, inclusion: m.inclusion })),
    roles:     roles.map(r => ({ nombre_rol: r.nombre_rol, nombre_habilidad: r.nombre_habilidad, desc_habilidad: r.desc_habilidad })),
    cartas:    cartas.map(c => ({ nombre: c.nombre, habilidad: c.habilidad, lore: c.lore, descripcion: c.descripcion })),
    objetivos: objetivos.map(o => ({ tipo: o.tipo, descripcion: o.descripcion })),
  }

  const sourceLang = larp.idioma_original === 'es' ? 'Spanish' : 'English'

  const systemPrompt = targetLang === 'en'
    ? `You are an expert translator for TechLARP - an educational LARP program for female students in STEM education.
TASK: Translate all text fields from ${sourceLang} to English.
RULES:
- Gender-neutral language: "students", "participants", "teachers". Keep explicit female references where present.
- Keep null values as null.
- Do NOT translate the "tipo" field inside the objetivos array - preserve exactly as-is.
- Translate string arrays (e.g. competencias) element by element.
- Return ONLY a valid JSON object with the exact same structure and keys as the input, no extra text.`
    : `Eres traductora especialista en TechLARP - programa LARP educativo disenado para alumnas en STEM.
TAREA: Traduce todos los campos de texto de ${sourceLang} al espanol.
REGLAS:
- Lenguaje inclusivo: "estudiantes", "participantes", "docentes". Femenino explicito donde el original lo indique.
- Los valores null dejalos como null.
- NO traduzcas el campo "tipo" dentro del array de objetivos - mantenlo exactamente como esta.
- Traduce los arrays de cadenas (p. ej. competencias) elemento por elemento.
- Devuelve UNICAMENTE un objeto JSON valido con la misma estructura y claves exactas que el input, sin texto adicional.`

  let t: any = {}
  try {
    t = await callLLM(systemPrompt, payload)
  } catch (err) {
    console.warn('[translateLarpInMemory] Translation failed, returning original:', (err as any)?.message)
    return { larp, ...children }
  }

  return {
    larp: {
      ...larp,
      nombre:          t.nombre          ?? larp.nombre,
      proyecto:        t.proyecto         ?? larp.proyecto,
      descripcion:     t.descripcion      ?? larp.descripcion,
      storyboard:      t.storyboard       ?? larp.storyboard,
      storyboard_alt:  t.storyboard_alt   ?? larp.storyboard_alt,
      asignaturas:     t.asignaturas      ?? larp.asignaturas,
      materiales:      t.materiales       ?? larp.materiales,
      evaluacion:      t.evaluacion       ?? larp.evaluacion,
      notas_docente:   t.notas_docente    ?? larp.notas_docente,
      competencias:    t.competencias     ?? larp.competencias,
      // Mark as target language so the "translated" banner disappears in preview
      idioma_original: targetLang,
      _auto_translated: true,
    },
    paralelos: paralelos.map((p, i) => ({
      ...p,
      narrativa:  t.paralelos?.[i]?.narrativa  ?? p.narrativa,
      mundo_real: t.paralelos?.[i]?.mundo_real ?? p.mundo_real,
      proposito:  t.paralelos?.[i]?.proposito  ?? p.proposito,
    })),
    misiones: misiones.map((m, i) => ({
      ...m,
      titulo:        t.misiones?.[i]?.titulo        ?? m.titulo,
      objetivo:      t.misiones?.[i]?.objetivo      ?? m.objetivo,
      formato:       t.misiones?.[i]?.formato       ?? m.formato,
      problema_larp: t.misiones?.[i]?.problema_larp ?? m.problema_larp,
      problema_real: t.misiones?.[i]?.problema_real ?? m.problema_real,
      solucion:      t.misiones?.[i]?.solucion      ?? m.solucion,
      recursos:      t.misiones?.[i]?.recursos      ?? m.recursos,
      inclusion:     t.misiones?.[i]?.inclusion     ?? m.inclusion,
    })),
    roles: roles.map((r, i) => ({
      ...r,
      nombre_rol:       t.roles?.[i]?.nombre_rol       ?? r.nombre_rol,
      nombre_habilidad: t.roles?.[i]?.nombre_habilidad ?? r.nombre_habilidad,
      desc_habilidad:   t.roles?.[i]?.desc_habilidad   ?? r.desc_habilidad,
    })),
    cartas: cartas.map((c, i) => ({
      ...c,
      nombre:      t.cartas?.[i]?.nombre      ?? c.nombre,
      habilidad:   t.cartas?.[i]?.habilidad   ?? c.habilidad,
      lore:        t.cartas?.[i]?.lore        ?? c.lore,
      descripcion: t.cartas?.[i]?.descripcion ?? c.descripcion,
    })),
    objetivos: objetivos.map((o, i) => ({
      ...o,
      // tipo is never translated - DB CHECK constraint uses fixed Spanish values
      descripcion: t.objetivos?.[i]?.descripcion ?? o.descripcion,
    })),
  }
}
