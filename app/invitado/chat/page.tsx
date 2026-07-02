'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { bp } from '@/lib/base-path'

interface LarpRef { id: string; nombre: string }

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

export default function InvitadoChatPage() {
  const { locale, t } = useI18n()
  const [mensajes, setMensajes]               = useState<Mensaje[]>([])
  const [input, setInput]                     = useState('')
  const [cargando, setCargando]               = useState(false)
  const [downloading, setDownloading]         = useState<string | null>(null)
  const [pdfLang, setPdfLang]                 = useState<'es' | 'en'>('es')
  const [lastLarps, setLastLarps]             = useState<LarpRef[]>([])
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (!cargando && mensajes.length > 0) setTimeout(() => inputRef.current?.focus(), 80)
  }, [cargando, mensajes.length])

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
      const res = await fetch(`${bp}/api/edularp/${id}?lang=${locale}`)
      if (res.ok) setPreviewData(await res.json())
    } catch {}
    setPreviewCargando(false)
  }

  async function handleDownloadPDF(id: string, nombre: string) {
    setDownloading(id)
    try {
      const res = await fetch(`${bp}/api/edularp/${id}/pdf?lang=${pdfLang}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${nombre.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_TechLARP.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(null)
  }

  async function handleDownloadModifiedPDF() {
    if (!previewData || !previewLarpId) return
    setDownloading('mod_' + previewLarpId)
    try {
      const modified: LarpDetalle = JSON.parse(JSON.stringify(previewData))
      for (const [key, val] of Object.entries(previewEdits)) {
        const parts = key.split('|')
        if (parts.length === 2)      (modified as any)[parts[0]][parts[1]] = val
        else if (parts.length === 3) (modified as any)[parts[0]][parseInt(parts[1])][parts[2]] = val
      }
      const res = await fetch(`${bp}/api/edularp/${previewLarpId}/pdf?lang=${pdfLang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modified),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${previewData.larp.nombre.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_modificada_TechLARP.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(null)
  }

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim()
    if (!msg || cargando) return
    setMensajes(m => [...m, { role: 'user', content: msg }])
    setInput('')
    setCargando(true)
    try {
      const res = await fetch(`${bp}/api/invitado/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje:     msg,
          historial:   mensajes.slice(-8).map(({ role, content }) => ({ role, content })),
          locale,
          contextLarps: lastLarps,
        }),
      })
      const data = await res.json()
      if (data.respuesta) {
        const larps: LarpRef[] = data.larps ?? []
        setMensajes(m => [...m, { role: 'assistant', content: data.respuesta, larps }])
        if (larps.length > 0) {
          setLastLarps(larps)
          if (data.openPreview) abrirPreview(larps[0].id)
          else if (previewAbierto && previewLarpId && !larps.some((l: LarpRef) => l.id === previewLarpId))
            setPreviewAbierto(false)
        }
      } else {
        setMensajes(m => [...m, { role: 'assistant', content: data.error ?? t.chatError }])
      }
    } catch {
      setMensajes(m => [...m, { role: 'assistant', content: t.chatError }])
    } finally {
      setCargando(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  const sugerencias = t.chatSuggestions

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#f7f7f8] flex flex-col overflow-hidden">

      {/* ── Banner de invitado ── */}
      <div className="bg-primary/90 text-white text-xs text-center py-1.5 px-4 flex items-center justify-center gap-3 flex-shrink-0">
        <span>{t.guestBanner}</span>
        <Link href="/registro" className="underline font-semibold hover:opacity-80">
          {t.guestCreateAccount}
        </Link>
        <span className="text-white/50">|</span>
        <Link href="/login" className="underline font-semibold hover:opacity-80">
          {t.guestLogIn}
        </Link>
      </div>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <Link href="/bienvenida" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t.guestBack}
        </Link>
        <div className="flex justify-center">
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
            alt="TechLARP" width={900} height={225}
            className="h-6 w-auto sm:h-40 sm:-my-[3.5rem]" priority
          />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <select
            value={pdfLang}
            onChange={e => setPdfLang(e.target.value as 'es' | 'en')}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600"
          >
            <option value="es">PDF ES</option>
            <option value="en">PDF EN</option>
          </select>
        </div>
      </header>

      {/* ── Layout principal: chat + panel preview ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Area de chat ── */}
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${previewAbierto ? 'md:w-1/2' : 'w-full'}`}>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {mensajes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800 mb-1">{t.chatWelcome}</p>
                  <p className="text-sm text-gray-500 max-w-sm">{t.chatWelcomeDesc}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                  {sugerencias?.map((s: string) => (
                    <button key={s} onClick={() => enviar(s)}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 transition-colors text-gray-600">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                }`}>
                  {m.role === 'assistant'
                    ? <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    : <p className="whitespace-pre-wrap">{m.content}</p>
                  }
                  {m.role === 'assistant' && m.larps && m.larps.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.larps.map((l: LarpRef) => (
                        <div key={l.id} className="flex gap-1">
                          <button onClick={() => abrirPreview(l.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium">
                            {l.nombre}
                          </button>
                          <button
                            disabled={downloading === l.id}
                            onClick={() => handleDownloadPDF(l.id, l.nombre)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-50"
                          >
                            {downloading === l.id ? '...' : 'PDF'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none shadow-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder={t.chatPlaceholder}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 bg-gray-50"
                disabled={cargando}
                maxLength={2000}
              />
              <button
                onClick={() => enviar()}
                disabled={cargando || !input.trim()}
                className="btn-primary text-sm px-4 py-2.5 rounded-xl disabled:opacity-40"
              >
                {t.send}
              </button>
            </div>
          </div>
        </div>

        {/* ── Panel de vista previa ── */}
        {/* Mobile backdrop */}
        {previewAbierto && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setPreviewAbierto(false)}
          />
        )}
        {previewAbierto && (
          <div className="
            flex flex-col bg-white overflow-hidden
            fixed bottom-0 left-0 right-0 h-[82vh] z-50 rounded-t-2xl shadow-2xl border-t border-gray-200
            md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:h-auto md:rounded-none md:shadow-none md:border-t-0 md:border-l md:border-gray-200 md:w-1/2
          ">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex gap-1">
                {(['resumen', 'misiones', 'roles', 'cartas'] as const).map(tab => (
                  <button key={tab} onClick={() => setPreviewTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${
                      previewTab === tab ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'resumen'  ? t.previewTabSummary
                     : tab === 'misiones' ? t.previewTabMissions
                     : tab === 'roles'    ? t.previewTabRoles
                     :                     t.previewTabCards}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {previewLarpId && (
                  <>
                    <button
                      onClick={handleDownloadModifiedPDF}
                      disabled={!!downloading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {downloading?.startsWith('mod_') ? '...' : t.downloadPdf}
                    </button>
                    {Object.keys(previewEdits).length > 0 && (
                      <button onClick={() => { setPreviewEdits({}); setEditingField(null) }}
                        className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                        {t.previewResetEdits}
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setPreviewAbierto(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {previewCargando && (
                <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
                  {t.loading}
                </div>
              )}

              {!previewCargando && previewData && (
                <>
                  {previewTab === 'resumen' && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{t.previewLabelTitle}</p>
                        {editingField === 'larp|nombre'
                          ? <textarea value={pv('larp|nombre', previewData.larp.nombre)}
                              onChange={e => setPreviewField('larp|nombre', e.target.value)}
                              onBlur={() => setEditingField(null)}
                              className="w-full text-base font-semibold border rounded-lg px-2 py-1 text-sm resize-none" rows={2} autoFocus />
                          : <p className="font-semibold text-base cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1 transition-colors"
                              onClick={() => setEditingField('larp|nombre')}>
                              {pv('larp|nombre', previewData.larp.nombre)}
                              <span className="ml-1 text-xs text-gray-300 opacity-0 group-hover:opacity-100">✏️</span>
                            </p>
                        }
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{previewData.larp.nivel_educativo}</span>
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">{previewData.larp.asignaturas}</span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{previewData.larp.duracion_min} min</span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{previewData.larp.num_participantes} {locale === 'en' ? 'participants' : 'participantes'}</span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{t.previewLabelDescription}</p>
                        {editingField === 'larp|descripcion'
                          ? <textarea value={pv('larp|descripcion', previewData.larp.descripcion)}
                              onChange={e => setPreviewField('larp|descripcion', e.target.value)}
                              onBlur={() => setEditingField(null)}
                              className="w-full border rounded-lg px-2 py-1 text-sm resize-none" rows={4} autoFocus />
                          : <p className="text-gray-700 cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1 transition-colors leading-relaxed"
                              onClick={() => setEditingField('larp|descripcion')}>
                              {pv('larp|descripcion', previewData.larp.descripcion)}
                            </p>
                        }
                      </div>
                      {previewData.larp.storyboard && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Storyboard</p>
                          {editingField === 'larp|storyboard'
                            ? <textarea value={pv('larp|storyboard', previewData.larp.storyboard)}
                                onChange={e => setPreviewField('larp|storyboard', e.target.value)}
                                onBlur={() => setEditingField(null)}
                                className="w-full border rounded-lg px-2 py-1 text-sm resize-none" rows={5} autoFocus />
                            : <p className="text-gray-700 cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1 transition-colors leading-relaxed whitespace-pre-line"
                                onClick={() => setEditingField('larp|storyboard')}>
                                {pv('larp|storyboard', previewData.larp.storyboard)}
                              </p>
                          }
                        </div>
                      )}
                      {previewData.paralelos.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">{t.previewParallelRealities}</p>
                          {previewData.paralelos.map((p: any, i: number) => (
                            <div key={i} className="mb-3 p-2 bg-gray-50 rounded-lg">
                              <p className="text-xs font-medium text-gray-500 mb-1">{t.previewLabelFantasy}</p>
                              {editingField === `paralelos|${i}|narrativa`
                                ? <textarea value={pv(`paralelos|${i}|narrativa`, p.narrativa)}
                                    onChange={e => setPreviewField(`paralelos|${i}|narrativa`, e.target.value)}
                                    onBlur={() => setEditingField(null)}
                                    className="w-full border rounded px-2 py-1 text-xs resize-none" rows={2} autoFocus />
                                : <p className="text-xs cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1"
                                    onClick={() => setEditingField(`paralelos|${i}|narrativa`)}>
                                    {pv(`paralelos|${i}|narrativa`, p.narrativa)}
                                  </p>
                              }
                              <p className="text-xs font-medium text-gray-500 mt-2 mb-1">{t.previewLabelReality}</p>
                              {editingField === `paralelos|${i}|mundo_real`
                                ? <textarea value={pv(`paralelos|${i}|mundo_real`, p.mundo_real)}
                                    onChange={e => setPreviewField(`paralelos|${i}|mundo_real`, e.target.value)}
                                    onBlur={() => setEditingField(null)}
                                    className="w-full border rounded px-2 py-1 text-xs resize-none" rows={2} autoFocus />
                                : <p className="text-xs cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1"
                                    onClick={() => setEditingField(`paralelos|${i}|mundo_real`)}>
                                    {pv(`paralelos|${i}|mundo_real`, p.mundo_real)}
                                  </p>
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {previewTab === 'misiones' && (
                    <div className="space-y-4">
                      {previewData.misiones.map((m: any, i: number) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3">
                          {editingField === `misiones|${i}|titulo`
                            ? <input value={pv(`misiones|${i}|titulo`, m.titulo)}
                                onChange={e => setPreviewField(`misiones|${i}|titulo`, e.target.value)}
                                onBlur={() => setEditingField(null)}
                                className="w-full font-semibold border rounded px-2 py-0.5 text-sm mb-2" autoFocus />
                            : <p className="font-semibold mb-2 cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1"
                                onClick={() => setEditingField(`misiones|${i}|titulo`)}>
                                {i + 1}. {pv(`misiones|${i}|titulo`, m.titulo)}
                              </p>
                          }
                          <p className="text-xs text-gray-400 mb-1">{t.previewLabelObjective}</p>
                          {editingField === `misiones|${i}|objetivo`
                            ? <textarea value={pv(`misiones|${i}|objetivo`, m.objetivo)}
                                onChange={e => setPreviewField(`misiones|${i}|objetivo`, e.target.value)}
                                onBlur={() => setEditingField(null)}
                                className="w-full border rounded px-2 py-1 text-xs resize-none" rows={2} autoFocus />
                            : <p className="text-xs text-gray-700 cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1"
                                onClick={() => setEditingField(`misiones|${i}|objetivo`)}>
                                {pv(`misiones|${i}|objetivo`, m.objetivo)}
                              </p>
                          }
                        </div>
                      ))}
                    </div>
                  )}

                  {previewTab === 'roles' && (
                    <div className="space-y-3">
                      {previewData.roles.map((r: any, i: number) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3">
                          <p className="font-semibold text-xs text-primary mb-1">{r.nombre_rol}</p>
                          {r.nombre_habilidad && <p className="text-xs font-medium text-gray-600 mb-1">{r.nombre_habilidad}</p>}
                          {editingField === `roles|${i}|desc_habilidad`
                            ? <textarea value={pv(`roles|${i}|desc_habilidad`, r.desc_habilidad)}
                                onChange={e => setPreviewField(`roles|${i}|desc_habilidad`, e.target.value)}
                                onBlur={() => setEditingField(null)}
                                className="w-full border rounded px-2 py-1 text-xs resize-none" rows={3} autoFocus />
                            : <p className="text-xs text-gray-700 cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1"
                                onClick={() => setEditingField(`roles|${i}|desc_habilidad`)}>
                                {pv(`roles|${i}|desc_habilidad`, r.desc_habilidad)}
                              </p>
                          }
                        </div>
                      ))}
                    </div>
                  )}

                  {previewTab === 'cartas' && (
                    <div className="grid grid-cols-2 gap-2">
                      {previewData.cartas.map((c: any, i: number) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-2">
                          <p className="font-semibold text-xs mb-1">{c.nombre}</p>
                          <p className="text-xs text-gray-400 mb-1">{c.tipo}</p>
                          {c.lore && <p className="text-xs text-gray-600 italic">{c.lore}</p>}
                          {c.habilidad && <p className="text-xs text-primary mt-1">{c.habilidad}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tip de edicion */}
            {previewData && (
              <div className="px-4 py-2 border-t border-gray-100 bg-amber-50 flex-shrink-0">
                <p className="text-xs text-amber-700">{t.previewEditTip}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
