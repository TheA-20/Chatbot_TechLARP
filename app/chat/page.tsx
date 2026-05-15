'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'

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
  role:    'user' | 'assistant'
  content: string
  larps?:  LarpRef[]
}

interface HistorialSesion {
  sessionId: string
  titulo: string
  preview: string
  actualizado: string
  mensajeCount: number
}

export default function ChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { locale, t } = useI18n()
  const [mensajes, setMensajes]   = useState<Mensaje[]>([])
  const [input, setInput]         = useState('')
  const [cargando, setCargando]   = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [lastLarps, setLastLarps] = useState<LarpRef[]>([])
  const [historial, setHistorial] = useState<HistorialSesion[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarAbierto, setSidebarAbierto] = useState(true)
  const [previewAbierto, setPreviewAbierto]   = useState(false)
  const [previewLarpId, setPreviewLarpId]     = useState<string | null>(null)
  const [previewData, setPreviewData]         = useState<LarpDetalle | null>(null)
  const [previewCargando, setPreviewCargando] = useState(false)
  const [previewTab, setPreviewTab]           = useState<'resumen' | 'misiones' | 'roles' | 'cartas'>('resumen')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])
  
  // Auto-focus en el input cuando carga la página
  useEffect(() => {
    if (status === 'authenticated') {
      inputRef.current?.focus()
    }
  }, [status])
  
  // Auto-focus después de recibir respuesta
  useEffect(() => {
    if (!cargando && mensajes.length > 0) {
      inputRef.current?.focus()
    }
  }, [cargando, mensajes.length])
  
  // Cargar historial
  async function cargarHistorial() {
    try {
      const res = await fetch('/api/chat/history')
      if (res.ok) {
        const data = await res.json()
        setHistorial(data.historial)
      }
    } catch {
      // silently fail
    }
  }
  
  useEffect(() => {
    if (session) cargarHistorial()
  }, [session])

  async function abrirPreview(id: string) {
    if (previewLarpId === id && previewAbierto) {
      setPreviewAbierto(false)
      return
    }
    setPreviewAbierto(true)
    setPreviewTab('resumen')
    if (previewLarpId === id && previewData) return // ya en caché
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
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ }
    setDownloading(null)
  }

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim()
    if (!msg || cargando) return

    const userMsg: Mensaje = { role: 'user', content: msg }
    setMensajes(m => [...m, userMsg])
    setInput('')
    setCargando(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: msg,
          historial: mensajes.slice(-8).map(({ role, content }) => ({ role, content })),
          locale,
          sessionId: currentSessionId,
          contextLarps: lastLarps,
        }),
      })
      const data = await res.json()
      if (data.respuesta) {
        const larps: LarpRef[] = data.larps ?? []
        setMensajes(m => [...m, { role: 'assistant', content: data.respuesta, larps }])
        if (larps.length > 0) {
          setLastLarps(larps)
          // Si el agente señaló confirmación, abrir la vista previa
          if (data.openPreview) {
            abrirPreview(larps[0].id)
          } else if (previewAbierto && previewLarpId && !larps.some((l: LarpRef) => l.id === previewLarpId)) {
            // El bot pasó a hablar de otra actividad — cerrar la vista previa
            setPreviewAbierto(false)
          }
        }
        
        // Actualizar sessionId si el servidor nos devuelve uno nuevo
        if (data.sessionId && data.sessionId !== currentSessionId) {
          setCurrentSessionId(data.sessionId)
          setActiveSessionId(data.sessionId)
          // Recargar historial para mostrar la nueva sesión
          cargarHistorial()
        }
      } else {
        setMensajes(m => [...m, { role: 'assistant', content: data.error ?? t.chatError }])
      }
    } catch {
      setMensajes(m => [...m, { role: 'assistant', content: t.chatError }])
    } finally {
      setCargando(false)
    }
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours} h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days} d`
    return new Date(date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')
  }

  function startNewConversation() {
    setMensajes([])
    setLastLarps([])
    setActiveSessionId(null)
    setCurrentSessionId(null)
    setPreviewAbierto(false)
    setPreviewLarpId(null)
    setPreviewData(null)
    if (window.innerWidth < 768) setSidebarAbierto(false)
  }

  async function loadFromHistory(sesion: HistorialSesion) {
    setActiveSessionId(sesion.sessionId)
    setCurrentSessionId(sesion.sessionId)
    
    // Cargar todos los mensajes de esta sesión
    try {
      const res = await fetch(`/api/chat/session/${sesion.sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const mensajesCargados: Mensaje[] = []
        data.mensajes.forEach((m: any) => {
          mensajesCargados.push({ role: 'user', content: m.usuario })
          mensajesCargados.push({ role: 'assistant', content: m.bot })
        })
        setMensajes(mensajesCargados)
      }
    } catch {
      // silently fail
    }
    
    if (window.innerWidth < 768) setSidebarAbierto(false)
  }

  const sugerencias = t.chatSuggestions

  if (status === 'loading') return (
    <div className="h-screen flex items-center justify-center">
      <p className="text-sm text-gray-400">{t.loading}</p>
    </div>
  )

  return (
    <div className="h-screen bg-[#f7f7f8] flex md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-[280px] bg-[#ececf1] border-r border-gray-200 z-40 transition-transform duration-200 ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:block`}>
        <div className="flex flex-col h-full">
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Conversaciones</h2>
              <button onClick={() => setSidebarAbierto(false)} className="md:hidden text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={startNewConversation}
              className="w-full flex items-center gap-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Nueva conversación
            </button>
          </div>

          <div className="px-2 py-2 flex-1 overflow-y-auto max-h-[calc(100vh-180px)] space-y-1">
            {historial.length === 0 ? (
              <div className="p-4 text-xs text-gray-500 text-center">
                No hay conversaciones previas
              </div>
            ) : (
              <div className="space-y-1">
                {historial.map((sesion, i) => (
                  <button
                    key={sesion.sessionId ?? i}
                    onClick={() => loadFromHistory(sesion)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                      activeSessionId === sesion.sessionId ? 'bg-white border border-gray-200' : 'hover:bg-white/70'
                    }`}
                  >
                    <p className="text-[13px] font-medium text-gray-800 truncate">{sesion.titulo}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{sesion.preview}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-gray-400">{timeAgo(sesion.actualizado)}</p>
                      <span className="text-[10px] text-gray-400">{sesion.mensajeCount} msgs</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-3 border-t border-gray-200">
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
              Volver al panel
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay para mobile */}
      {sidebarAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 relative z-10 overflow-visible flex-shrink-0">
          <div className="grid grid-cols-3 items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarAbierto(true)} className="md:hidden text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 hidden md:block">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <p className="text-sm font-medium">{t.chatAssistant}</p>
                <p className="text-xs text-gray-400">{t.chatSubtitle}</p>
              </div>
            </div>
            <div className="flex justify-center pointer-events-none">
              <Image src="/TechLARP-logo-02.png" alt="TechLARP" width={900} height={225} className="h-48 w-auto -my-[4.5rem]" priority />
            </div>
            <div className="flex items-center justify-end gap-2">
              <LanguageSwitcher />
            </div>
          </div>
        </header>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto px-4 py-6 w-full">
        <div className="max-w-3xl mx-auto">
        {mensajes.length === 0 ? (
          <div className="space-y-6">
            <div className="text-center pt-8">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h2 className="text-base font-medium text-gray-900 mb-1">{t.chatWelcome}</h2>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                {t.chatWelcomeDesc}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {sugerencias.map((s, i) => (
                <button key={i} onClick={() => enviar(s)}
                  className="text-left text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 hover:border-primary/30 hover:bg-purple-50/30 transition-colors">
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
                    ? 'bg-primary text-white rounded-br-sm'
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
                        em:     ({ children }) => <em className="italic">{children}</em>,
                        ul:     ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                        ol:     ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                        li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                        h1:     ({ children }) => <h1 className="font-bold text-base mb-1 mt-2">{children}</h1>,
                        h2:     ({ children }) => <h2 className="font-semibold text-sm mb-1 mt-2">{children}</h2>,
                        h3:     ({ children }) => <h3 className="font-semibold text-sm mb-1 mt-1">{children}</h3>,
                        code:   ({ children }) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                        hr:     () => <hr className="my-2 border-gray-200" />,
                        table:  ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="text-xs border-collapse w-full">{children}</table>
                          </div>
                        ),
                        thead:  ({ children }) => <thead className="bg-purple-50">{children}</thead>,
                        tbody:  ({ children }) => <tbody>{children}</tbody>,
                        tr:     ({ children }) => <tr className="border-b border-gray-100">{children}</tr>,
                        th:     ({ children }) => <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-200">{children}</th>,
                        td:     ({ children }) => <td className="px-3 py-2 text-gray-600 border border-gray-200">{children}</td>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
                {m.role === 'assistant' && m.larps && m.larps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-1">
                    {m.larps.map(l => (
                      <div key={l.id} className="flex items-center gap-1">
                        {/* Ojo — abre/cierra vista previa */}
                        <button
                          onClick={() => abrirPreview(l.id)}
                          title={t.previewTooltip}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                            previewLarpId === l.id && previewAbierto
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-primary'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {/* Descarga PDF */}
                        <button
                          onClick={() => handleDownloadPDF(l.id, l.nombre)}
                          disabled={downloading === l.id}
                          className="flex items-center gap-1.5 text-xs text-primary hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        >
                          {downloading === l.id ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                            </svg>
                          )}
                          {l.nombre}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
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
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            className="input flex-1"
            placeholder={t.chatPlaceholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
            disabled={cargando}
          />
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || cargando}
            className="btn-primary px-4 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* ── Panel de vista previa ── */}
      <aside className={`flex-shrink-0 border-l border-gray-200 bg-white flex flex-col transition-all duration-300 overflow-hidden ${
        previewAbierto ? 'w-[360px]' : 'w-0'
      }`}>
        {previewAbierto && (
          <>
            {/* Cabecera */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-gray-800 truncate">
                  {previewData?.larp?.nombre ?? t.previewTitle}
                </h3>
              </div>
              <button onClick={() => setPreviewAbierto(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            {previewData && (
              <div className="flex border-b border-gray-100 flex-shrink-0">
                {(['resumen', 'misiones', 'roles', 'cartas'] as const).map(tab => (
                  <button key={tab} onClick={() => setPreviewTab(tab)}
                    className={`flex-1 text-[11px] font-medium py-2.5 transition-colors ${
                      previewTab === tab
                        ? 'text-primary border-b-2 border-primary bg-purple-50/40'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab === 'resumen'   ? t.previewTabSummary
                     : tab === 'misiones' ? `${t.previewTabMissions}${previewData.misiones.length ? ` (${previewData.misiones.length})` : ''}`
                     : tab === 'roles'    ? `${t.previewTabRoles}${previewData.roles.length ? ` (${previewData.roles.length})` : ''}`
                     :                     `${t.previewTabCards}${previewData.cartas.length ? ` (${previewData.cartas.length})` : ''}`}
                  </button>
                ))}
              </div>
            )}

            {/* Spinner */}
            {previewCargando && (
              <div className="flex items-center justify-center flex-1">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Contenido */}
            {!previewCargando && previewData && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── RESUMEN ── */}
                {previewTab === 'resumen' && (
                  <>
                    {/* Translation disclaimer — shown when user's locale differs from activity's original language */}
                    {previewData.larp.idioma_original && previewData.larp.idioma_original !== locale && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-2">
                        <span className="text-amber-500 text-sm flex-shrink-0">⚠️</span>
                        <p className="text-[10px] text-amber-800 leading-relaxed">{t.previewTranslationDisclaimer}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {previewData.larp.nivel_educativo && (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">{previewData.larp.nivel_educativo}</span>
                      )}
                      {previewData.larp.asignaturas && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{previewData.larp.asignaturas}</span>
                      )}
                      {previewData.larp.duracion_min && (
                        <span className="text-[10px] bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">{previewData.larp.duracion_min} {t.previewLabelDuration}</span>
                      )}
                      {previewData.larp.num_participantes && (
                        <span className="text-[10px] bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">{t.previewLabelParticipants} {previewData.larp.num_participantes} {t.previewLabelParticipantsSuffix}</span>
                      )}
                      {/* Version badge: 'traducida' if viewing in a different language, otherwise 'original'/'modificada' */}
                      {(() => {
                        const esTraducida = previewData.larp.idioma_original && previewData.larp.idioma_original !== locale
                        const veces = previewData.larp.veces_modificada ?? 0
                        return (
                          <>
                            <span className={`text-[10px] border rounded-full px-2 py-0.5 ${
                              esTraducida
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : veces > 0
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {esTraducida
                                ? t.previewVersionTranslated
                                : veces > 0
                                  ? t.previewVersionModified
                                  : t.previewVersionOriginal}
                            </span>
                            {veces > 0 && (
                              <span className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                                {(t.previewVersionModifiedCount as unknown as (n: number) => string)(veces)}
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>

                    {previewData.larp.descripcion && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.previewLabelDescription}</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{previewData.larp.descripcion}</p>
                      </div>
                    )}

                    {previewData.larp.storyboard && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.previewLabelStory}</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{previewData.larp.storyboard}</p>
                      </div>
                    )}

                    {previewData.paralelos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.previewLabelParallels}</p>
                        <div className="space-y-2">
                          {previewData.paralelos.map((p, i) => (
                            <div key={i} className="bg-purple-50/60 border border-purple-100 rounded-xl p-2.5 text-xs">
                              <p className="font-medium text-purple-800 mb-0.5">{p.narrativa}</p>
                              <p className="text-gray-600">↔ {p.mundo_real}</p>
                              {p.proposito && <p className="text-gray-500 mt-0.5 italic">{p.proposito}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {previewData.objetivos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.previewLabelObjectives}</p>
                        <ul className="space-y-1">
                          {previewData.objetivos.map((o, i) => (
                            <li key={i} className="flex gap-2 text-xs text-gray-700">
                              <span className="text-purple-400 flex-shrink-0 mt-0.5">▸</span>
                              <span>{o.descripcion ?? o.objetivo ?? JSON.stringify(o)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {previewData.larp.materiales && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.previewLabelMaterials}</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{previewData.larp.materiales}</p>
                      </div>
                    )}

                    {previewData.larp.evaluacion && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.previewLabelEvaluation}</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{previewData.larp.evaluacion}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── MISIONES ── */}
                {previewTab === 'misiones' && (
                  <div className="space-y-3">
                    {previewData.misiones.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-8">{t.previewEmptyMissions}</p>
                      : previewData.misiones.map((m, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-800">{m.titulo}</p>
                            {m.duracion_min && <span className="text-[10px] text-gray-400 flex-shrink-0">{m.duracion_min} {t.previewLabelDuration}</span>}
                          </div>
                          {m.objetivo && <p className="text-xs text-gray-600">{m.objetivo}</p>}
                          {m.problema_larp && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-amber-700 mb-0.5">{t.previewLabelLarpProblem}</p>
                              <p className="text-xs text-amber-800">{m.problema_larp}</p>
                            </div>
                          )}
                          {m.problema_real && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-blue-700 mb-0.5">{t.previewLabelRealProblem}</p>
                              <p className="text-xs text-blue-800">{m.problema_real}</p>
                            </div>
                          )}
                          {m.solucion && (
                            <div className="bg-green-50 border border-green-100 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-green-700 mb-0.5">{t.previewLabelSolution}</p>
                              <p className="text-xs text-green-800">{m.solucion}</p>
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* ── ROLES ── */}
                {previewTab === 'roles' && (
                  <div className="space-y-3">
                    {previewData.roles.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-8">{t.previewEmptyRoles}</p>
                      : previewData.roles.map((r, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-1">
                          <p className="text-xs font-semibold text-gray-800">{r.nombre}</p>
                          {r.descripcion && <p className="text-xs text-gray-600">{r.descripcion}</p>}
                          {r.habilidades && <p className="text-[10px] text-purple-600 italic">{t.previewLabelSkills}: {r.habilidades}</p>}
                          {r.num_jugadoras != null && (
                            <p className="text-[10px] text-gray-400">{r.num_jugadoras} {t.previewLabelPlayers}</p>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* ── CARTAS ── */}
                {previewTab === 'cartas' && (
                  <div className="space-y-3">
                    {previewData.cartas.length === 0
                      ? <p className="text-xs text-gray-400 text-center py-8">{t.previewEmptyCards}</p>
                      : previewData.cartas.map((c, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-800">{c.titulo}</p>
                            {c.tipo && <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{c.tipo}</span>}
                          </div>
                          {c.contenido && <p className="text-xs text-gray-600">{c.contenido}</p>}
                          {c.efecto && <p className="text-[10px] text-amber-700 italic">{t.previewLabelEffect}: {c.efecto}</p>}
                        </div>
                      ))
                    }
                  </div>
                )}

              </div>
            )}

            {/* Footer — descarga */}
            {previewData && !previewCargando && (
              <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => handleDownloadPDF(previewData.larp.id, previewData.larp.nombre)}
                  disabled={downloading === previewData.larp.id}
                  className="w-full flex items-center justify-center gap-2 text-xs text-white bg-primary hover:bg-purple-700 rounded-xl py-2 transition-colors disabled:opacity-50"
                >
                  {downloading === previewData.larp.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                    </svg>
                  )}
                  {t.previewDownloadPdf}
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
