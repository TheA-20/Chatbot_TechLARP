'use client'
import { useState } from 'react'
import Link from 'next/link'
import { bp } from '@/lib/base-path'

interface Props {
  id: string
  locale: string
  isAdmin: boolean
  isOwner: boolean
  t: {
    downloadPdf: string
    reanalyze: string
    reanalyzing: string
    reanalyzed: string
    editActivity: string
  }
}

export default function PreviewActions({ id, locale, isAdmin, isOwner, t }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzed, setReanalyzed] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`${bp}/api/edularp/${id}/pdf`)
      if (!res.ok) throw new Error('Error')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TechLARP_${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ }
    setDownloading(false)
  }

  async function handleReanalyze() {
    setReanalyzing(true)
    try {
      await fetch(`${bp}/api/edularp/${id}/analyze`, { method: 'POST' })
      setReanalyzed(true)
      setTimeout(() => setReanalyzed(false), 4000)
    } catch { /* silently fail */ }
    setReanalyzing(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* PDF download */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-primary hover:bg-purple-50 transition-colors disabled:opacity-50"
        title={t.downloadPdf}
      >
        {downloading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3"/>
          </svg>
        )}
        <span className="hidden sm:inline">PDF</span>
      </button>

      {/* Re-analyze — admin only */}
      {isAdmin && (
        <button
          onClick={handleReanalyze}
          disabled={reanalyzing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-50"
          title={t.reanalyze}
        >
          {reanalyzing ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : reanalyzed ? (
            <span className="text-green-600">✓</span>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          )}
          <span className="hidden sm:inline">
            {reanalyzing ? t.reanalyzing : reanalyzed ? t.reanalyzed : t.reanalyze}
          </span>
        </button>
      )}

      {/* Edit — admin or owner */}
      {(isAdmin || isOwner) && (
        <Link
          href={`/formulario/${id}/editar?locale=${locale}`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
          title={t.editActivity}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          <span className="hidden sm:inline">{t.editActivity}</span>
        </Link>
      )}
    </div>
  )
}
