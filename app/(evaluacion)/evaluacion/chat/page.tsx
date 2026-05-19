'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LarpRef {
  id: string
  nombre: string
}

interface LarpDetalle {
  larp: Record<string, any>
  paralelos: Record<string, any>[]
  misiones: Record<string, any>[]
  roles: Record<string, any>[]
  cartas: Record<string, any>[]
  objetivos: Record<string, any>[]
}

interface Mensaje {
  role: 'user' | 'assistant'
  content: string
  larps?: LarpRef[]
}

const ESCENARIOS = [
  { id: null,  label: 'Libre' },
  { id: 1,     label: 'E1 · Selección guiada' },
  { id: 2,     label: 'E2 · Adaptación' },
  { id: 3,     label: 'E3 · Apoyo formativo' },
  { id: 4,     label: 'E4 · Fuera de alcance' },
  { id: 5,     label: 'E5 · Exploración libre' },
]

export default function EvaluacionChatPage() {
  const router = useRouter()
  const [nombreDocente, setNombreDocente] = useState('')
  const [mensajes, setMensajes]   = useState<Mensaje[]>([])
  const [input, setInput]         = useState('')
  const [cargando, setCargando]   = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [lastLarps, setLastLarps] = useState<LarpRef[]>([])
  const [escenario, setEscenario] = useState<number | null>(null)

  const [previewAbierto, setPreviewAbierto]   = useState(false)
  const [previewLarpId, setPreviewLarpId]     = useState<string | null>(null)
  const [previewData, setPreviewData]         = useState<LarpDetalle | null>(null)
  const [previewCargando, setPreviewCargando] = useState(false)
  const [previewTab, setPreviewTab]           = useState<'resumen' | 'misiones' | 'roles' | 'cartas'>('resumen')
  const [previewEdits, setPreviewEdits]       = useState<Record<string, string>>({})
  const [editingField, setEditingField]       = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  function pv(key: string, original: string | undefined | null): string {
    return key in previewEdits ? previewEdits[key] : (original ?? '')
  }
  function setPreviewField(key: string, val: string) {
    setPreviewEdits(p => ({ ...p, [key]: val }))
  }

  useEffect(() => {
    const nombre = sessionStorage.getItem('eval_nombre') ?? ''
    setNombreDocente(nombre)

    // Cargar historial si el evaluador ya tenía una sesión activa
    async function cargarHistorial() {
      try {
        const res = await fetch('/api/evaluacion/historial')
        if (!res.ok) return
        const data = await res.json()
        if (!data.mensajes?.length) return

        const msgs: Mensaje[] = []
        for (const m of data.mensajes) {
          msgs.push({ role: 'user', content: m.mensaje_usuario })
          if (m.respuesta_bot) {
            const larps: LarpRef[] = Array.isArray(m.larps) ? m.larps : []
            msgs.push({ role: 'assistant', content: m.respuesta_bot, larps })
          }
        }
        setMensajes(msgs)
        // Actualizar el escenario al último usado
        const ultimoEscenario = data.mensajes[data.mensajes.length - 1]?.escenario ?? null
        if (ultimoEscenario) setEscenario(ultimoEscenario)
      } catch { /* silently fail */ }
    }

    cargarHistorial()
    inputRef.current?.focus()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function abrirPreview(id: string) {
    if (previewLarpId === id && previewAbierto) { setPreviewAbierto(false); return }
    setPreviewAbierto(true)
    setPreviewTab('resumen')
    if (previewLarpId !== id) { setPreviewEdits({}); setEditingField(null) }
    if (previewLarpId === id && previewData) return
    setPreviewLarpId(id)
    setPreviewData(null)
    setPreviewCargando(true)
    try {
      const res = await fetch(`/api/edularp/${id}`)
      if (res.ok) setPreviewData(await res.json())
    } catch { /* silently fail */ }
    setPreviewCargando(false)
  }

  async function handleDownloadPDF(id: string, nombre: string) {
    setDownloading(id)
    try {
      const res = await fetch(`/api/edularp/${id}/pdf`)
      if (!res.ok) throw new Error('Error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '_')}_TechLARP.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ }
    setDownloading(null)
  }

  async function handleDownloadModifiedPDF() {
    if (!previewData || !previewLarpId) return
    setDownloading('mod_' + previewLarpId)
    try {
      const modified: LarpDetalle = JSON.parse(JSON.stringify(previewData))
      for (const [key, val] of Object.entries(previewEdits)) {
        const parts = key.split('|')
        if (parts.length === 2) { (modified as any)[parts[0]][parts[1]] = val }
        else if (parts.length === 3) { (modified as any)[parts[0]][parseInt(parts[1])][parts[2]] = val }
      }
      const res = await fetch(`/api/edularp/${previewLarpId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modified),
      })
      if (!res.ok) throw new Error('Error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${previewData.larp.nombre.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, '').replace(/\s+/g, '_')}_modificada_TechLARP.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ }
    setDownloading(null)
  }

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim()
    if (!msg || cargando) return

    setMensajes(m => [...m, { role: 'user', content: msg }])
    setInput('')
    setCargando(true)

    try {
      const res = await fetch('/api/evaluacion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: msg,
          historial: mensajes.slice(-8).map(({ role, content }) => ({ role, content })),
          locale: 'es',
          contextLarps: lastLarps,
          escenario,
        }),
      })

      // Si la sesión expiró o no existe, volver a la pantalla de acceso
      if (res.status === 401) {
        router.push('/evaluacion')
        return
      }

      const data = await res.json()
      if (data.respuesta) {
        const larps: LarpRef[] = data.larps ?? []
        setMensajes(m => [...m, { role: 'assistant', content: data.respuesta, larps }])
        if (larps.length > 0) {
          setLastLarps(larps)
          if (data.openPreview) {
            abrirPreview(larps[0].id)
          } else if (previewAbierto && previewLarpId && !larps.some((l: LarpRef) => l.id === previewLarpId)) {
            setPreviewAbierto(false)
          }
        }
      } else {
        setMensajes(m => [...m, { role: 'assistant', content: data.error ?? 'Error al obtener respuesta.' }])
      }
    } catch {
      setMensajes(m => [...m, { role: 'assistant', content: 'Error de conexión. Inténtalo de nuevo.' }])
    } finally {
      setCargando(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="h-screen bg-[#f7f7f8] flex overflow-hidden">

      {/* ── MAIN CHAT ─────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 h-full transition-all duration-200 ${previewAbierto ? 'mr-[420px]' : ''}`}>

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-3 flex-shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/TechLARP_Symbol.png" alt="TechLARP" width={32} height={32} className="object-contain flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Asistente TechLARP</p>
              {nombreDocente && (
                <p className="text-xs text-gray-400 truncate">Sesión de evaluación · {nombreDocente}</p>
              )}
            </div>
          </div>

          {/* Selector de escenario */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 hidden sm:inline">Escenario:</span>
            <select
              value={escenario ?? ''}
              onChange={e => setEscenario(e.target.value === '' ? null : Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {ESCENARIOS.map(s => (
                <option key={s.id ?? 'libre'} value={s.id ?? ''}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Mensajes */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {mensajes.length === 0 ? (
              <div className="space-y-5 pt-6">
                <div className="text-center">
                  <p className="text-base font-medium text-gray-800 mb-1">¡Hola{nombreDocente ? `, ${nombreDocente}` : ''}!</p>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Estás en la sesión de evaluación del asistente TechLARP. Puedes interactuar libremente o seleccionar un escenario en la barra superior.
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white border border-gray-100 text-gray-800">
                    Hola, soy el Asistente TechLARP. Estoy aquí para ayudarte a encontrar, entender o adaptar actividades TechLARP. ¿Por dónde empezamos?
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Busco una actividad de Matemáticas para 5.º de Primaria',
                    'Quiero adaptar una actividad de Secundaria para 6.º de Primaria',
                    'Explícame qué es el pensamiento computacional',
                    'Muéstrame qué actividades hay disponibles',
                  ].map((s, i) => (
                    <button key={i} onClick={() => enviar(s)}
                      className="text-left text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {mensajes.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                      ${m.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {m.role === 'user' ? (
                        m.content.split('\n').map((line, j) => (
                          <p key={j} className={j > 0 ? 'mt-2' : ''}>{line}</p>
                        ))
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            ul:     ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                            ol:     ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                            li:     ({ children }) => <li className="text-sm">{children}</li>,
                            h3:     ({ children }) => <h3 className="font-semibold text-sm mt-3 mb-1">{children}</h3>,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      )}
                    </div>

                    {/* Botones de actividades */}
                    {m.role === 'assistant' && m.larps && m.larps.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 max-w-[80%]">
                        {m.larps.map(l => (
                          <div key={l.id} className="flex gap-1">
                            <button
                              onClick={() => abrirPreview(l.id)}
                              className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 transition-colors"
                            >
                              {l.nombre}
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(l.id, l.nombre)}
                              disabled={downloading === l.id}
                              title="Descargar PDF"
                              className="text-xs bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                            >
                              {downloading === l.id ? '…' : '⬇'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {cargando && (
                  <div className="flex items-start">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </main>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 px-4 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={e => { e.preventDefault(); enviar() }}
              className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-300 transition-all"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escribe tu mensaje…"
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none"
                disabled={cargando}
              />
              <button
                type="submit"
                disabled={cargando || !input.trim()}
                className="flex-shrink-0 w-8 h-8 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 rounded-xl flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── PANEL DE VISTA PREVIA ─────────────────────────── */}
      {previewAbierto && (
        <aside className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-gray-200 overflow-y-auto z-30 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Vista previa</h2>
            <button onClick={() => setPreviewAbierto(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {previewCargando ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : previewData ? (
            <div className="flex-1 overflow-y-auto">
              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-5 gap-4">
                {(['resumen', 'misiones', 'roles', 'cartas'] as const).map(tab => (
                  <button key={tab} onClick={() => setPreviewTab(tab)}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors capitalize ${previewTab === tab ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              <div className="px-5 py-4 space-y-4 text-sm">
                {previewTab === 'resumen' && (
                  <>
                    <h3 className="font-semibold text-base text-gray-900">{previewData.larp.nombre}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded text-xs">{previewData.larp.nivel_educativo}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{previewData.larp.duracion_min} min</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{previewData.larp.num_participantes} participantes</span>
                    </div>
                    <p className="text-gray-600 text-xs leading-relaxed">{previewData.larp.asignaturas}</p>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Descripción</p>
                      {editingField === 'larp|descripcion' ? (
                        <textarea
                          className="w-full text-xs border border-violet-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                          rows={4}
                          value={pv('larp|descripcion', previewData.larp.descripcion)}
                          onChange={e => setPreviewField('larp|descripcion', e.target.value)}
                          onBlur={() => setEditingField(null)}
                          autoFocus
                        />
                      ) : (
                        <p
                          className="text-xs text-gray-600 leading-relaxed cursor-text hover:bg-violet-50 rounded p-1 -m-1 transition-colors"
                          onClick={() => setEditingField('larp|descripcion')}
                        >
                          {pv('larp|descripcion', previewData.larp.descripcion)}
                        </p>
                      )}
                    </div>
                    {previewData.paralelos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">Paralelos narrativa ↔ mundo real</p>
                        <div className="space-y-2">
                          {previewData.paralelos.map((p, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-2 text-xs">
                              <span className="font-medium text-violet-700">{p.narrativa}</span>
                              <span className="text-gray-400 mx-1">↔</span>
                              <span className="text-gray-600">{p.mundo_real}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {previewData.objetivos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">Objetivos</p>
                        <ul className="space-y-1">
                          {previewData.objetivos.map((o, i) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-violet-400 flex-shrink-0">·</span>
                              <span>[{o.tipo}] {o.descripcion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {previewTab === 'misiones' && (
                  <div className="space-y-4">
                    {previewData.misiones.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay misiones registradas.</p>
                    ) : previewData.misiones.map((m, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3">
                        <p className="font-medium text-gray-800 text-xs mb-1">{i + 1}. {m.titulo}</p>
                        <p className="text-xs text-gray-500 mb-1">{m.objetivo}</p>
                        {m.duracion_min && <span className="text-xs text-gray-400">{m.duracion_min} min</span>}
                        {m.problema_larp && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">LARP:</span> {m.problema_larp}</p>}
                        {m.problema_real && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Real:</span> {m.problema_real}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {previewTab === 'roles' && (
                  <div className="space-y-3">
                    {previewData.roles.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay roles registrados.</p>
                    ) : previewData.roles.map((r, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3">
                        <p className="font-medium text-gray-800 text-xs">{r.nombre_rol}</p>
                        {r.nombre_habilidad && <p className="text-xs text-violet-600">{r.nombre_habilidad}</p>}
                        <p className="text-xs text-gray-500 mt-1">{r.desc_habilidad}</p>
                        {r.uso_juego && <p className="text-xs text-gray-400 mt-1 italic">{r.uso_juego}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {previewTab === 'cartas' && (
                  <div className="space-y-3">
                    {previewData.cartas.length === 0 ? (
                      <p className="text-xs text-gray-400">No hay cartas registradas.</p>
                    ) : previewData.cartas.map((c, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-800 text-xs">{c.nombre}</p>
                          <span className="px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px]">{c.tipo}</span>
                        </div>
                        {c.habilidad && <p className="text-xs text-gray-500">{c.habilidad}</p>}
                        {c.lore && <p className="text-xs text-gray-400 italic mt-1">{c.lore}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones PDF */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => previewLarpId && handleDownloadPDF(previewLarpId, previewData.larp.nombre)}
                  disabled={!!downloading}
                  className="flex-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  {downloading === previewLarpId ? 'Descargando…' : 'Descargar PDF original'}
                </button>
                {Object.keys(previewEdits).length > 0 && (
                  <button
                    onClick={handleDownloadModifiedPDF}
                    disabled={!!downloading}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-900 text-white rounded-lg py-2 transition-colors disabled:opacity-50"
                  >
                    Descargar PDF modificado
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400">No se pudo cargar la actividad.</p>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
