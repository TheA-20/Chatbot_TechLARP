/**
 * llm-provider.ts
 * Capa de abstraccion LLM para EduLARP.
 *
 * Proveedores soportados
 *   Claude (Anthropic) -- primario por defecto
 *   Groq (Llama 3.3 70B -> 8B) -- fallback automatico, o primario si LLM_PROVIDER=groq
 *
 * Variables de entorno
 *   ANTHROPIC_API_KEY   requerida si LLM_PROVIDER=claude
 *   GROQ_API_KEY        siempre requerida (fallback)
 *   LLM_PROVIDER        'claude' (defecto) | 'groq' (comportamiento original)
 *   CLAUDE_MODEL        defecto: claude-haiku-4-5-20251001
 *   GROQ_MODEL_PRIMARY  defecto: llama-3.3-70b-versatile
 *   GROQ_MODEL_FALLBACK defecto: llama-3.1-8b-instant
 */

import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Tipos publicos
// ---------------------------------------------------------------------------

export type LLMRole = 'user' | 'assistant'

export interface LLMMessage {
  role: LLMRole
  content: string
}

export interface LLMCallOptions {
  /** Prompt de sistema principal */
  system: string
  /**
   * Instrucciones de sistema adicionales (ej. refuerzo de lenguaje inclusivo).
   * Con Claude se anaden al final del system string.
   * Con Groq se inyectan como mensaje 'system' antes del ultimo turno de usuario.
   */
  systemAppend?: string
  /** Solo turnos user / assistant -- sin mensajes de sistema */
  messages: LLMMessage[]
  maxTokens: number
  temperature?: number
  /** Si true, fuerza salida JSON pura */
  jsonMode?: boolean
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Proveedor primario activo */
export const PRIMARY_LLM = (process.env.LLM_PROVIDER ?? 'claude') as 'claude' | 'groq'

const CLAUDE_MODEL        = process.env.CLAUDE_MODEL        ?? 'claude-sonnet-4-6'
const GROQ_MODEL_PRIMARY  = process.env.GROQ_MODEL_PRIMARY  ?? 'llama-3.3-70b-versatile'
const GROQ_MODEL_FALLBACK = process.env.GROQ_MODEL_FALLBACK ?? 'llama-3.1-8b-instant'

// ---------------------------------------------------------------------------
// Clientes (lazy -- solo si la clave esta presente)
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null
let _groq: Groq | null = null

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('[llm-provider] ANTHROPIC_API_KEY no esta configurada')
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('[llm-provider] GROQ_API_KEY no esta configurada')
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function isRateLimit(err: any): boolean {
  return (
    err?.status === 429 ||
    err?.error?.code === 'rate_limit_exceeded' ||
    err?.error?.error?.code === 'rate_limit_exceeded'
  )
}

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

async function callClaude(opts: LLMCallOptions): Promise<string> {
  const parts: string[] = [opts.system]
  if (opts.systemAppend) parts.push(opts.systemAppend)
  if (opts.jsonMode) {
    parts.push(
      'IMPORTANT: Respond ONLY with a valid JSON object. No markdown fences, no explanation -- just the JSON.'
    )
  }
  const systemFull = parts.join('\n\n')

  const response = await getAnthropic().messages.create({
    model:       CLAUDE_MODEL,
    max_tokens:  opts.maxTokens,
    temperature: opts.temperature ?? 0.3,
    system:      systemFull,
    messages:    opts.messages,
  })

  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}

// ---------------------------------------------------------------------------
// Groq
// ---------------------------------------------------------------------------

async function callGroqModel(opts: LLMCallOptions, model: string): Promise<string> {
  const msgs: Array<{ role: string; content: string }> = [
    { role: 'system', content: opts.system },
    ...opts.messages,
  ]

  if (opts.systemAppend) {
    // Insertar antes del ultimo mensaje de usuario
    const lastUserIdx = msgs.reduceRight(
      (acc: number, m: { role: string }, i: number) => (acc === -1 && m.role === 'user' ? i : acc),
      -1
    )
    const insertAt = lastUserIdx > 0 ? lastUserIdx : msgs.length - 1
    msgs.splice(insertAt, 0, { role: 'system', content: opts.systemAppend })
  }

  const params: Record<string, any> = {
    model,
    max_tokens:  opts.maxTokens,
    temperature: opts.temperature ?? 0.3,
    messages:    msgs,
  }
  if (opts.jsonMode) {
    params.response_format = { type: 'json_object' }
  }

  const r = await getGroq().chat.completions.create(params as any)
  return r.choices[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------

/**
 * Llama al LLM activo y devuelve texto libre.
 *
 * Cascada segun LLM_PROVIDER:
 *   'claude' -> Claude -> Groq 70B -> Groq 8B
 *   'groq'   -> Groq 70B -> Groq 8B   (comportamiento original)
 */
export async function callLLM(opts: LLMCallOptions): Promise<string> {
  if (PRIMARY_LLM === 'groq') {
    try {
      return await callGroqModel(opts, GROQ_MODEL_PRIMARY)
    } catch (err: any) {
      if (!isRateLimit(err)) throw err
      console.warn('[llm-provider] Groq 70B rate-limited -> trying 8B')
      return await callGroqModel(opts, GROQ_MODEL_FALLBACK)
    }
  }

  // Claude primario -> Groq fallback
  try {
    const text = await callClaude(opts)
    return text
  } catch (err: any) {
    console.warn('[llm-provider] Claude fallo -> Groq 70B:', err?.message ?? err)
    try {
      return await callGroqModel(opts, GROQ_MODEL_PRIMARY)
    } catch (err2: any) {
      if (!isRateLimit(err2)) throw err2
      console.warn('[llm-provider] Groq 70B rate-limited -> trying 8B')
      return await callGroqModel(opts, GROQ_MODEL_FALLBACK)
    }
  }
}

/**
 * Llama al LLM y parsea la respuesta como JSON.
 * Para los endpoints de analisis GII y traduccion.
 */
export async function callLLMJson<T = unknown>(opts: LLMCallOptions): Promise<T> {
  const text = await callLLM({ ...opts, jsonMode: true })
  const clean = stripJsonFences(text)
  return JSON.parse(clean) as T
}
