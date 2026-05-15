'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'

interface Props {
  larps: any[]
  isAdmin: boolean
  userId: string
}

export default function ActividadesClient({ larps, isAdmin, userId }: Props) {
  const { t, locale } = useI18n()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [translating, setTranslating] = useState<string | null>(null)
  const [translateSuccess, setTranslateSuccess] = useState<{ id: string; nombre: string } | null>(null)

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

  async function handleTranslate(id: string, nombre: string, idiomaOriginal: string) {
    const targetLocale = idiomaOriginal === 'es' ? 'en' : 'es'
    setTranslating(id)
    setTranslateSuccess(null)
    try {
      const res = await fetch(`/api/edularp/${id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLocale }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error')
      setTranslateSuccess({ id: data.id, nombre })
    } catch {
      alert(t.translateError)
    }
    setTranslating(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 relative z-10 overflow-visible">
        <div className="grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">{t.backToDashboard}</Link>
            <h1 className="text-base font-semibold">{t.browseActivities}</h1>
          </div>
          <div className="flex justify-center pointer-events-none">
            <Image src="/TechLARP-logo-02.png" alt="TechLARP" width={900} height={225} className="h-48 w-auto -my-[4.5rem]" priority />
          </div>
          <div className="flex items-center justify-end gap-3">
            <LanguageSwitcher />
            {isAdmin && <Link href="/formulario" className="btn-primary text-xs">{t.newActivity}</Link>}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {translateSuccess && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span>✓ {t.translateSuccess}</span>
            <div className="flex items-center gap-3">
              <a
                href={`/dashboard/actividades/${translateSuccess.id}/preview?locale=${locale}`}
                className="font-medium underline underline-offset-2 hover:text-green-900"
              >
                {t.translateSuccessLink}
              </a>
              <button
                onClick={() => setTranslateSuccess(null)}
                className="text-green-600 hover:text-green-900"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {larps.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm text-gray-400 mb-4">{t.noActivitiesYet}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {larps.map((l: any) => (
              <div key={l.id} className="card flex gap-4">
                {/* Thumbnail — primera imagen si existe */}
                {Array.isArray(l.imagenes_urls) && l.imagenes_urls.length > 0 && (
                  <div className="flex-shrink-0 w-24 h-20 rounded-lg overflow-hidden bg-gray-100">
                    <img src={l.imagenes_urls[0]} alt={l.nombre} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{l.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {l.nivel_educativo} · {l.asignaturas} · {l.duracion_min} min · {l.num_participantes} {t.participantsLabel}
                      </p>
                      {/* Inclusion Index badge */}
                      {l.inclusion_index?.designer &&
                        Object.keys(l.inclusion_index.designer).length > 0 && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium mt-1 px-1.5 py-0.5 rounded-full ${
                          Object.values(l.inclusion_index.designer).filter(
                            (v: any) => v?.estado && (v?.evidencia?.length ?? 0) >= 30
                          ).length === 5
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          Inclusion Index&nbsp;
                          {Object.values(l.inclusion_index.designer).filter(
                            (v: any) => v?.estado && (v?.evidencia?.length ?? 0) >= 30
                          ).length}/{Object.keys(l.inclusion_index.designer).length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/dashboard/actividades/${l.id}/preview?locale=${locale}`}
                        className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors"
                        title="Vista previa"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver
                      </Link>
                      <button
                        onClick={() => handleDownloadPDF(l.id, l.nombre)}
                        disabled={downloading === l.id}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-purple-800 border border-purple-200 hover:border-purple-300 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                        title={t.downloadPdf}
                      >
                        {downloading === l.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                          </svg>
                        )}
                        PDF
                      </button>
                      {(l.autor_id === userId || isAdmin) && (
                        <button
                          onClick={() => handleTranslate(l.id, l.nombre, l.idioma_original ?? 'es')}
                          disabled={translating === l.id}
                          className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-900 border border-teal-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                          title={l.idioma_original === 'en' ? t.translateToEs : t.translateToEn}
                        >
                          {translating === l.id ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              {t.translating}
                            </>
                          ) : (
                            <>🌐 {l.idioma_original === 'en' ? 'ES' : 'EN'}</>
                          )}
                        </button>
                      )}
                      <span className="badge-approved">{t.statusPublished}</span>
                    </div>
                  </div>

                  {l.autor_nombre && (
                    <p className="text-xs text-gray-300 mt-2">
                      {l.autor_nombre} · {t.created} {new Date(l.creado_en).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
