'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useI18n } from '@/lib/i18n/context'
import Image from 'next/image'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { bp } from '@/lib/base-path'

interface DashboardClientProps {
  userName: string
  rol: string
  stats: { total: number; borradores: number; en_revision: number; publicados: number; rechazados: number }
  misLarps: any[]
  notifs: any[]
}

export default function DashboardClient({ userName, rol, stats, misLarps, notifs }: DashboardClientProps) {
  const { t } = useI18n()

  const estadoBadge: Record<string, string> = {
    borrador:  'badge-info',
    revision:  'badge-pending',
    publicado: 'badge-approved',
    rechazado: 'badge-rejected',
  }

  const statusLabel = (estado: string) => {
    const map: Record<string, string> = {
      borrador: t.statusDraft, revision: t.statusReview,
      publicado: t.statusPublished, rechazado: t.statusRejected,
    }
    return map[estado] ?? estado
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 relative z-10 overflow-visible">
        <div className="grid grid-cols-3 items-center">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-400">{t.welcome}, {userName}</span>
          </div>
          <div className="flex justify-center pointer-events-none col-span-2 sm:col-span-1">
            <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`} alt="TechLARP" width={900} height={225} className="h-7 w-auto sm:h-48 sm:-my-[4.5rem]" priority />
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <LanguageSwitcher />
            {rol === 'admin' && (
              <Link href="/admin/revision" className="hidden sm:inline-flex btn-secondary text-xs">{t.adminPanel}</Link>
            )}
            <Link href="/chat" className="btn-primary text-xs">{t.chatbot}</Link>
            <button onClick={() => signOut({ callbackUrl: `${bp}/login` })} className="text-xs text-gray-400 hover:text-gray-600">{t.logout}</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">


        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: t.totalActivities,  value: stats.total,       color: 'text-gray-900' },
            { label: t.inReview,    value: stats.en_revision,  color: 'text-amber-600' },
            { label: t.published,   value: stats.publicados,   color: 'text-green-600' },
            { label: t.drafts,      value: stats.borradores,   color: 'text-blue-600' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">{m.label}</p>
              <p className={`text-2xl font-semibold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Acciones rápidas — 2×2 grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {/* 1. Nueva actividad */}
          {(['admin', 'docente'].includes(rol)) ? (
            <Link href="/formulario" className="card hover:border-primary/30 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm font-medium">{t.uploadActivity}</p>
              <p className="text-xs text-gray-400 mt-1">{t.uploadActivityDesc}</p>
            </Link>
          ) : (
            <div className="card opacity-40 cursor-not-allowed select-none">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">{t.uploadActivity}</p>
              <p className="text-xs text-gray-300 mt-1">Solo docentes</p>
            </div>
          )}
          {/* 2. Mis actividades */}
          <Link href="/dashboard/mis-actividades" className="card hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Mis actividades</p>
            <p className="text-xs text-gray-400 mt-1">Ver y gestionar tus LARP</p>
          </Link>
          {/* 3. Chatbot */}
          <Link href="/chat" className="card hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium">{t.chatbot}</p>
            <p className="text-xs text-gray-400 mt-1">{t.chatbotDesc}</p>
          </Link>
          {/* 4. Explorar actividades */}
          <Link href="/dashboard/actividades" className="card hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-medium">{t.browseActivities}</p>
            <p className="text-xs text-gray-400 mt-1">{t.browseActivitiesDesc}</p>
          </Link>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">{t.latestActivities}</h2>
            <Link href="/dashboard/actividades" className="text-xs text-primary hover:underline">{t.viewAll}</Link>
          </div>
          {misLarps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-3">{t.noLarpsYet}</p>
              {['admin', 'docente'].includes(rol) ? (
                <Link href="/formulario" className="btn-primary text-xs">{t.uploadFirst}</Link>
              ) : (
                <p className="text-xs text-gray-400">{t.uploadFirst}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {misLarps.map(larp => (
                <Link
                  key={larp.id}
                  href={`/dashboard/actividades/${larp.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{larp.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{larp.nivel_educativo} · {larp.asignaturas}</p>
                    </div>
                  </div>
                  <span className={`badge ${estadoBadge[larp.estado] ?? 'badge-info'} ml-3 shrink-0 text-xs`}>
                    {statusLabel(larp.estado)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notificaciones */}
        {notifs.length > 0 && (
          <div className="card mt-6">
            <h2 className="text-sm font-medium mb-4">Notificaciones</h2>
            <div className="space-y-2">
              {notifs.map((n, i) => (
                <div key={i} className={`p-3 rounded-xl text-xs ${
                  n.tipo === 'aprobado' ? 'bg-green-50 text-green-700' :
                  n.tipo === 'rechazado' ? 'bg-red-50 text-red-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  <p className="font-medium">{n.mensaje}</p>
                  {n.feedback && <p className="mt-1 text-xs opacity-80">{n.feedback}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
