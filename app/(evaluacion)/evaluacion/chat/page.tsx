'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evalDict, type EvalLocale } from '@/lib/i18n/eval-dict'

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

function getScenariosInfo(lang: EvalLocale) {
  const L = evalDict[lang]
  return [
    { id: null, key: 'libre', label: L.scenarioFreeLabel, desc: L.scenarioFreeDesc },
    { id: 1,    key: '1',     label: L.scenario1Label,    desc: L.scenario1Desc },
    { id: 2,    key: '2',     label: L.scenario2Label,    desc: L.scenario2Desc },
    { id: 3,    key: '3',     label: L.scenario3Label,    desc: L.scenario3Desc },
    { id: 4,    key: '4',     label: L.scenario4Label,    desc: L.scenario4Desc },
    { id: 5,    key: '5',     label: L.scenario5Label,    desc: L.scenario5Desc },
  ]
}

export default function EvaluacionChatPage() {
  const router = useRouter()
  const [nombreDocente, setNombreDocente] = useState('')
  const [escenario, setEscenario]         = useState<number | null>(null)
  const [mensajes, setMensajes]           = useState<Mensaje[]>([])
  const [historialCache, setHistorialCache] = useState<Record<string, Mensaje[]>>({})
  const [lastLarps, setLastLarps]         = useState<LarpRef[]>([])
  const [lastLarpsCache, setLastLarpsCache] = useState<Record<string, LarpRef[]>>({})
  const [input, setInput]                 = useState('')
  const [cargando, setCargando]           = useState(false)
  const [downloading, setDownloading]     = useState<string | null>(null)
  const [lang, setLang]                   = useState<EvalLocale>('es')

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
    const savedLang = sessionStorage.getItem('eval_lang')
    if (savedLang === 'en' || savedLang === 'es') setLang(savedLang)

    async function cargarHistorial() {
      try {
        const res = await fetch('/api/evaluacion/historial')
        if (!res.ok) return
        const data = await res.json()

        const grupos: Record<string, Mensaje[]>   = { libre: [], '1': [], '2': [], '3': [], '4': [], '5': [] }
        const lrpGrupos: Record<string, LarpRef[]> = { libre: [], '1': [], '2': [], '3': [], '4': [], '5': [] }

        for (const m of data.mensajes ?? []) {
          const key = m.escenario === null ? 'libre' : String(m.escenario)
          if (!grupos[key]) grupos[key] = []
          if (!lrpGrupos[key]) lrpGrupos[key] = []
          grupos[key].push({ role: 'user', content: m.mensaje_usuario })
          if (m.respuesta_bot) {
            const larps: LarpRef[] = Array.isArray(m.larps) ? m.larps : []
            grupos[key].push({ role: 'assistant', content: m.respuesta_bot, larps })
            lrpGrupos[key].push(...larps)
          }
        }

        setHistorialCache(grupos)
        setLastLarpsCache(lrpGrupos)
        setMensajes(grupos['libre'] ?? [])
        setLastLarps(lrpGrupos['libre'] ?? [])
      } catch { /* fail silently */ }
    }

    cargarHistorial()
    inputRef.current?.focus()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  function cambiarEscenario(nuevoId: number | null) {
    if (nuevoId === escenario || cargando) return
    const currentKey = escenario === null ? 'libre' : String(escenario)
    const newKey     = nuevoId  === null ? 'libre' : String(nuevoId)

    setHistorialCache(c => ({ ...c, [currentKey]: mensajes }))
    setLastLarpsCache(c => ({ ...c, [currentKey]: lastLarps }))

    setMensajes(historialCache[newKey] ?? [])
    setLastLarps(lastLarpsCache[newKey] ?? [])
    setEscenario(nuevoId)
    setPreviewAbierto(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function reiniciarEscenario() {
    const key   = escenario === null ? 'libre' : String(escenario)
    const label = ESCENARIOS_INFO.find(s => s.key === key)?.label ?? 'esta conversacion'
    if (!window.confirm(evalDict[lang].resetConfirm(label))) return

    try {
      await fetch(`/api/evaluacion/historial?escenario=${key}`, { method: 'DELETE' })
    } catch { /* fail silently */ }

    setMensajes([])
    setLastLarps([])
    setHistorialCache(c => ({ ...c, [key]: [] }))
    setLastLarpsCache(c => ({ ...c, [key]: [] }))
    setPreviewAbierto(false)
  }

  function salir() {
    sessionStorage.removeItem('eval_nombre')
    sessionStorage.removeItem('eval_retorno')
    router.push('/evaluacion')
  }

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
      const res = await fetch(`/api/evaluacion/edularp/${id}`)
      if (res.ok) setPreviewData(await res.json())
    } catch { /* silently fail */ }
    setPreviewCargando(false)
  }

  async function handleDownloadPDF(id: string, nombre: string) {
    setDownloading(id)
    try {
      const res = await fetch(`/api/evaluacion/edularp/${id}/pdf?lang=${lang}`)
      if (!res.ok) throw new Error('Error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nombre.replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, '_')}_TechLARP.pdf`
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
      const res = await fetch(`/api/evaluacion/edularp/${previewLarpId}/pdf?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modified),
      })
      if (!res.ok) throw new Error('Error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${previewData.larp.nombre.replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, '_')}_modificada_TechLARP.pdf`
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
          locale: lang,
          contextLarps: lastLarps,
          escenario,
        }),
      })

      if (res.status === 401) { router.push('/evaluacion'); return }

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
      setMensajes(m => [...m, { role: 'assistant', content: evalDict[lang].connError }])
    } finally {
      setCargando(false)
      inputRef.current?.focus()
    }
  }

  const L = evalDict[lang]
  const ESCENARIOS_INFO = getScenariosInfo(lang)
  const escenarioActual = ESCENARIOS_INFO.find(s => s.id === escenario)!

  function changeLang(l: EvalLocale) {
    setLang(l)
    sessionStorage.setItem('eval_lang', l)
  }

  return (
    <div className="h-screen bg-[#f7f7f8] flex overflow-hidden">

      {/* SIDEBAR IZQUIERDO */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 z-20">
        {/* Logo + usuario */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <Image src="/TechLARP_Symbol.png" alt="TechLARP" width={28} height={28} className="object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900">TechLARP</p>
            {nombreDocente && <p className="text-[11px] text-gray-400 truncate">{nombreDocente}</p>}
          </div>
        </div>

        {/* Lista de escenarios */}
        <nav className="flex-1 overflow-y-auto py-2">
          <p className="px-4 pt-1 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {L.sidebarScenarios}
          </p>
          {ESCENARIOS_INFO.map(s => {
            const key    = s.key
            const cached = historialCache[key] ?? []
            const count  = cached.filter(m => m.role === 'user').length
            const activo = escenario === s.id
            return (
              <button
                key={key}
                onClick={() => cambiarEscenario(s.id)}
                disabled={cargando}
                className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                  activo
                    ? 'bg-violet-50 border-violet-500'
                    : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-medium leading-tight ${activo ? 'text-violet-700' : 'text-gray-700'}`}>
                    {s.label}
                  </span>
                  {count > 0 && (
                    <span className={`ml-1 flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      activo ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </div>
                <p className={`text-[10px] leading-snug ${activo ? 'text-violet-600/70' : 'text-gray-400'}`}>
                  {s.desc}
                </p>
              </button>
            )
          })}
        </nav>

        {/* Botones inferiores */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {/* Selector de idioma — controla UI + agente + PDF */}
          <div className="flex items-center justify-between text-xs text-gray-400 pb-1">
            <span>{L.sidebarPdfLang}</span>
            <div className="flex gap-1">
              <button
                onClick={() => changeLang('es')}
                className={`px-2.5 py-1 rounded border transition-colors ${lang === 'es' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >ES</button>
              <button
                onClick={() => changeLang('en')}
                className={`px-2.5 py-1 rounded border transition-colors ${lang === 'en' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >EN</button>
            </div>
          </div>
          <button
            onClick={reiniciarEscenario}
            disabled={mensajes.length === 0 || cargando}
            className="w-full text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-2 transition-colors"
          >
            {L.sidebarReset}
          </button>
          <button
            onClick={salir}
            className="w-full text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {L.sidebarLeave}
          </button>
        </div>
      </aside>

      {/* AREA DE CHAT */}
      <div className={`flex flex-col flex-1 min-w-0 h-full transition-all duration-200 ${previewAbierto ? 'mr-[420px]' : ''}`}>

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex-shrink-0 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{escenarioActual.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{escenarioActual.desc}</p>
          </div>
          {lastLarps.length > 0 && (
            <button
              onClick={() => lastLarps[0] && abrirPreview(lastLarps[0].id)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                previewAbierto
                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                  : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {L.headerPreview}
            </button>
          )}
        </header>

        {/* Mensajes */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {mensajes.length === 0 ? (
              <div className="space-y-5 pt-6">
                <div className="text-center">
                  <p className="text-base font-medium text-gray-800 mb-1">
                    {nombreDocente ? `Hola, ${nombreDocente}!` : 'Hola!'}
                  </p>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {escenario === null ? L.greetingFree : escenarioActual.desc}
                  </p>
                </div>
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed bg-white border border-gray-100 text-gray-800">
                    {L.welcomeMsg}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    L.suggestion1,
                    L.suggestion2,
                    L.suggestion3,
                    L.suggestion4,
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

                    {/* Botones de actividades por mensaje */}
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
                              {downloading === l.id ? '...' : 'PDF'}
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
                placeholder={L.inputPlaceholder}
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

      {/* PANEL DE VISTA PREVIA */}
      {previewAbierto && (
        <aside className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-gray-200 overflow-y-auto z-30 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">{L.previewTitle}</h2>
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
              <div className="flex border-b border-gray-100 px-5 gap-4">
                {(['resumen', 'misiones', 'roles', 'cartas'] as const).map(tab => (
                  <button key={tab} onClick={() => setPreviewTab(tab)}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors capitalize ${previewTab === tab ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'resumen' ? L.previewTabResumen : tab === 'misiones' ? L.previewTabMisiones : tab === 'roles' ? L.previewTabRoles : L.previewTabCartas}
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
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{previewData.larp.num_participantes} {L.previewParticipants}</span>
                    </div>
                    <p className="text-gray-600 text-xs leading-relaxed">{previewData.larp.asignaturas}</p>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">{L.previewTabResumen}</p>
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
                        <p className="text-xs font-medium text-gray-700 mb-2">{L.previewStoryboard}</p>
                        <div className="space-y-2">
                          {previewData.paralelos.map((p, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-2 text-xs">
                              <span className="font-medium text-violet-700">{p.narrativa}</span>
                              <span className="text-gray-400 mx-1">vs</span>
                              <span className="text-gray-600">{p.mundo_real}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {previewData.objetivos.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">{L.previewTabMisiones}</p>
                        <ul className="space-y-1">
                          {previewData.objetivos.map((o, i) => (
                            <li key={i} className="text-xs text-gray-600 flex gap-2">
                              <span className="text-violet-400 flex-shrink-0">-</span>
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

              <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
                <div className="flex gap-2">
                <button
                  onClick={() => previewLarpId && handleDownloadPDF(previewLarpId, previewData.larp.nombre)}
                  disabled={!!downloading}
                  className="flex-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  {downloading === previewLarpId ? L.previewDownloading : L.previewDownloadOriginal}
                </button>
                {Object.keys(previewEdits).length > 0 && (
                  <button
                    onClick={handleDownloadModifiedPDF}
                    disabled={!!downloading}
                    className="flex-1 text-xs bg-gray-800 hover:bg-gray-900 text-white rounded-lg py-2 transition-colors disabled:opacity-50"
                  >
                    {L.previewDownloadModified}
                  </button>
                )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-gray-400">{L.previewFailed}</p>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}