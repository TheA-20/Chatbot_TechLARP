/**
 * inclusive-review.ts
 * ---------------------------------------------------------------------------
 * Revisor post-procesado de lenguaje inclusivo para respuestas en espanol.
 *
 * Flujo:
 *   1. Pre-filtro rapido por regex -- si no hay infraccion, devuelve el texto sin tocar.
 *   2. Si hay infraccion, llama a Claude Haiku con un prompt de correccion minima.
 *      Haiku es el modelo elegido porque: rapido (~0.5s), barato, y la tarea
 *      es de correccion lexica (no razonamiento complejo).
 *   3. Si Haiku falla (timeout, API caida), devuelve el texto original sin romper el flujo.
 *
 * Solo actua sobre respuestas en espanol (locale='es').
 * Solo se activa si ANTHROPIC_API_KEY esta configurada.
 */

import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Patron de infracciones -- masculino generico prohibido en TechLARP
// ---------------------------------------------------------------------------

const INFRACCIONES = [
  // Articulo + sustantivo masculino plural (las formas mas comunes)
  /\blos\s+alumn[oa]?s?\b/i,
  /\blos\s+docentes?\b/i,
  /\blos\s+estudiantes?\b/i,
  /\blos\s+jugadores?\b/i,
  /\blos\s+usuarios?\b/i,
  /\blos\s+participantes?\b/i,
  /\blos\s+profesores?\b/i,
  /\blos\s+educadores?\b/i,
  /\blos\s+ninos?\b/i,
  /\blos\s+chicos?\b/i,
  // Singular masculino generico
  /\bel\s+alumno\b/i,
  /\bel\s+estudiante\b/i,
  /\bel\s+jugador\b/i,
  /\bel\s+usuario\b/i,
  /\bun\s+jugador\b/i,
  /\bun\s+alumno\b/i,
  /\bun\s+docente\b/i,
  // Formas que mezclan genero incorrectamente
  /\blas\s+alumnas?\b/i,   // "alumnas" esta prohibido -- usar "estudiantes"
  /\bel\s+alumnado\b/i,    // "alumnado" esta prohibido -- usar "estudiantes"
]

export function tieneInfraccionInclusiva(texto: string): boolean {
  return INFRACCIONES.some((patron) => patron.test(texto))
}

// ---------------------------------------------------------------------------
// Prompt del revisor
// ---------------------------------------------------------------------------

const SYSTEM_REVISOR = `Eres correctora de lenguaje inclusivo para el proyecto TechLARP.
Recibes una respuesta generada por un asistente y debes corregir UNICAMENTE las infracciones de lenguaje inclusivo, sin cambiar el contenido, el tono ni la estructura.

REGLAS DE CORRECCION (aplica en este orden de preferencia):

DOCENTES / EDUCADORES (genero no asumido):
  "los docentes" -> "docentes" o "el profesorado"
  "los profesores" -> "docentes" o "el profesorado"
  "los educadores" -> "docentes"
  "el docente" -> "la persona docente" o "docentes"
  "un docente" -> "una persona docente"

ESTUDIANTES / PARTICIPANTES (preferir neutro; femenino en contexto TechLARP):
  "los alumnos" / "las alumnas" / "el alumnado" -> "estudiantes" (SIEMPRE)
  "los estudiantes" -> "estudiantes" (quitar "los")
  "los participantes" -> "estudiantes" o "quienes participan"
  "el alumno" -> "la estudiante" o "quien estudia"
  "un alumno" -> "una estudiante"

PERSONAS QUE JUEGAN (contexto LARP):
  "los jugadores" -> "quienes juegan" o "las jugadoras"
  "el jugador" -> "quien juega" o "la jugadora"
  "un jugador" -> "quien juega"

USUARIOS:
  "los usuarios" -> "quienes usan la plataforma"
  "el usuario" -> "quien usa la plataforma"

NINOS / JOVENES:
  "los ninos" -> "el alumnado infantil" [EXCEPCION: en este contexto educativo usar "estudiantes"]
  "los chicos" -> "estudiantes" o "el grupo"

IMPORTANTE:
- NO cambies nada mas: no reformules frases, no cambies vocabulario tecnico, no alteres el formato.
- Si la infraccion esta en medio de una frase, haz el cambio minimo necesario para que la frase siga siendo gramaticalmente correcta.
- Devuelve SOLO el texto corregido, sin explicaciones ni comentarios.`

// ---------------------------------------------------------------------------
// Funcion principal
// ---------------------------------------------------------------------------

let _anthropicRevisor: Anthropic | null = null

function getAnthropicRevisor(): Anthropic {
  if (!_anthropicRevisor) {
    _anthropicRevisor = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropicRevisor
}

/**
 * Revisa y corrige infracciones de lenguaje inclusivo en una respuesta en espanol.
 * Devuelve el texto original si no hay infracciones o si la revision falla.
 *
 * @param texto    Texto a revisar
 * @param locale   Idioma de la respuesta ('es' | 'en') -- solo actua en 'es'
 */
export async function revisarLenguajeInclusivo(
  texto: string,
  locale: string = 'es'
): Promise<{ texto: string; corregido: boolean }> {
  // Solo actua en espanol y si Anthropic esta disponible
  if (locale !== 'es' || !process.env.ANTHROPIC_API_KEY) {
    return { texto, corregido: false }
  }

  // Pre-filtro rapido: si no hay infracciones, no llamamos al LLM
  if (!tieneInfraccionInclusiva(texto)) {
    return { texto, corregido: false }
  }

  console.warn('[inclusive-review] Infraccion detectada -- enviando a correccion con Haiku')

  try {
    const response = await getAnthropicRevisor().messages.create({
      model:       'claude-haiku-4-5-20251001', // Haiku: rapido y barato para esta micro-tarea
      max_tokens:  1200,
      temperature: 0.05, // Muy bajo: queremos correccion minima, no reescritura
      system:      SYSTEM_REVISOR,
      messages:    [{ role: 'user', content: texto }],
    })

    const block = response.content[0]
    if (block.type !== 'text' || !block.text.trim()) {
      return { texto, corregido: false }
    }

    const textoCorrecto = block.text.trim()
    const huboCambio = textoCorrecto !== texto
    if (huboCambio) {
      console.info('[inclusive-review] Texto corregido OK')
    }
    return { texto: textoCorrecto, corregido: huboCambio }
  } catch (err: any) {
    // La revision falla silenciosamente -- devuelve el original
    console.warn('[inclusive-review] Revision fallida, usando texto original:', err?.message ?? err)
    return { texto, corregido: false }
  }
}
