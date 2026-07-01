'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { bp } from '@/lib/base-path'

interface Props {
  actividades: any[]
  isAdmin: boolean
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  borrador:       { label: 'Borrador',    color: 'text-blue-700',   bg: 'bg-blue-50'   },
  revision:       { label: 'En revisión', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  pending_review: { label: 'En revisión', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  modificaciones: { label: 'Requiere cambios', color: 'text-orange-700', bg: 'bg-orange-50' },
  lm_analyzed:    { label: 'Analizada',   color: 'text-purple-700', bg: 'bg-purple-50' },
  under_review:   { label: 'En revisión', color: 'text-amber-700',  bg: 'bg-amber-50'  },
  publicado:      { label: 'Aceptada / Publicada',   color: 'text-green-700',  bg: 'bg-green-50'  },
  rechazado:      { label: 'Rechazada',   color: 'text-red-700',    bg: 'bg-red-50'    },
}

type FiltroEstado = 'todas' | 'borrador' | 'revision' | 'publicado' | 'rechazado'

/** Mini chip con el estado de un criterio del Inclusion Index */
function EstadoChip({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    cumple:   'bg-green-100 text-green-700',
    parcial:  'bg-amber-100 text-amber-700',
    no_cumple:'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${map[estado] ?? 'bg-gray-100 text-gray-500'}`}>
      {estado === 'cumple' ? '✓' : estado === 'parcial' ? '~' : '✗'}
    </span>
  )
}

/** Calcula puntuación 0-100 de los criterios: cumple=1, parcial=0.5, no_cumple=0 */
function calcScore(criterios: Record<string, any>): number {
  const vals = Object.values(criterios)
  if (!vals.length) return 0
  const pts = vals.reduce((acc: number, v: any) => {
    if (v.estado === 'cumple')    return acc + 1
    if (v.estado === 'parcial')   return acc + 0.5
    return acc
  }, 0)
  return Math.round((pts / vals.length) * 100)
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-bold w-8 text-right ${
        score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
      }`}>{score}%</span>
    </div>
  )
}

/** Panel expandible con los datos del Inclusion Index */
function InclusionPanel({ index }: { index: any }) {
  const [tab, setTab] = useState<'designer' | 'llm'>('designer')
  const hasDesigner = index?.designer && Object.keys(index.designer).length > 0
  const hasLlm      = index?.llm_proposal?.criteria && Object.keys(index.llm_proposal.criteria).length > 0
  const alerts      = index?.llm_proposal?.alerts ?? []

  const designerScore = hasDesigner ? calcScore(index.designer) : null
  const llmScore      = hasLlm      ? calcScore(index.llm_proposal.criteria) : null
  const combinedScore = designerScore !== null && llmScore !== null
    ? Math.round(designerScore * 0.6 + llmScore * 0.4)
    : (designerScore ?? llmScore)

  // Resumen numérico
  function score(criterios: Record<string, any>) {
    const vals = Object.values(criterios)
    const cumple  = vals.filter((v: any) => v.estado === 'cumple').length
    const parcial = vals.filter((v: any) => v.estado === 'parcial').length
    return { cumple, parcial, total: vals.length }
  }

  return (
    <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/30">
      {/* Score header */}
      {combinedScore !== null && (
        <div className="px-3 pt-3 pb-2 space-y-1.5 border-b border-indigo-100">
          <ScoreBar score={combinedScore} label="Puntuación global" />
          {hasDesigner && designerScore !== null && <ScoreBar score={designerScore} label="Evaluación diseñadora" />}
          {hasLlm && llmScore !== null && <ScoreBar score={llmScore} label="Propuesta IA (22 crit.)" />}
        </div>
      )}
      {/* Tabs */}
      <div className="flex border-b border-indigo-100">
        {hasDesigner && (
          <button onClick={() => setTab('designer')}
            className={`text-xs px-3 py-2 font-medium transition-colors ${tab === 'designer' ? 'bg-white text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}>
            Evaluación diseñadora
            {(() => { const s = score(index.designer); return <span className="ml-1.5 text-[10px] text-gray-400">{s.cumple}/{s.total}</span> })()}
          </button>
        )}
        {hasLlm && (
          <button onClick={() => setTab('llm')}
            className={`text-xs px-3 py-2 font-medium transition-colors ${tab === 'llm' ? 'bg-white text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}>
            Propuesta IA
            {(() => { const s = score(index.llm_proposal.criteria); return <span className="ml-1.5 text-[10px] text-gray-400">{s.cumple}/{s.total}</span> })()}
          </button>
        )}
      </div>

      <div className="p-3 max-h-64 overflow-y-auto space-y-1.5">
        {tab === 'designer' && hasDesigner && Object.entries(index.designer).map(([id, val]: [string, any]) => (
          <div key={id} className="flex items-start gap-2 bg-white rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-indigo-500 w-12 flex-shrink-0 pt-0.5">{id}</span>
            <EstadoChip estado={val.estado} />
            <p className="text-[11px] text-gray-500 flex-1 leading-relaxed">{val.evidencia}</p>
          </div>
        ))}
        {tab === 'llm' && hasLlm && Object.entries(index.llm_proposal.criteria).map(([id, val]: [string, any]) => (
          <div key={id} className="flex items-start gap-2 bg-white rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] font-bold text-gray-400 w-12 flex-shrink-0 pt-0.5">{id}</span>
            <EstadoChip estado={val.estado} />
            {val.confianza != null && (
              <span className="text-[10px] text-gray-300 flex-shrink-0 pt-0.5">{Math.round(val.confianza * 100)}%</span>
            )}
            <p className="text-[11px] text-gray-500 flex-1 leading-relaxed">{val.evidencia}</p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50 p-3">
          <p className="text-[10px] font-semibold text-amber-700 mb-1">⚠ Alertas de inconsistencia</p>
          {alerts.map((a: any, i: number) => (
            <p key={i} className="text-[11px] text-amber-800"><strong>{a.criterio}:</strong> {a.mensaje}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MisActividadesClient({ actividades, isAdmin }: Props) {
  const router = useRouter()
  const { t } = useI18n()
  const [filtro, setFiltro]           = useState<FiltroEstado>('todas')
  const [eliminando, setEliminando]   = useState<string | null>(null)
  const [confirmDelete, setConfirm]   = useState<string | null>(null)
  const [expandedFeedback, setExpand] = useState<string | null>(null)
  const [expandedIndex, setExpandIdx] = useState<string | null>(null)

  const estados: FiltroEstado[] = ['todas', 'borrador', 'revision', 'publicado', 'rechazado']

  const filtradas = actividades.filter(a => {
    if (filtro === 'todas')    return true
    if (filtro === 'revision') return ['revision','pending_review','lm_analyzed','under_review'].includes(a.estado)
    return a.estado === filtro
  })

  const conteo = (f: FiltroEstado) => f === 'todas'
    ? actividades.length
    : actividades.filter(a => {
        if (f === 'revision') return ['revision','pending_review','lm_analyzed','under_review'].includes(a.estado)
        return a.estado === f
      }).length

  async function eliminarBorrador(id: string) {
    setEliminando(id)
    try {
      const res = await fetch(`${bp}/api/edularp/${id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
      else alert('No se pudo eliminar la actividad')
    } catch {
      alert('Error al eliminar')
    }
    setEliminando(null)
    setConfirm(null)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 relative z-10 overflow-visible sticky top-0">
        <div className="grid grid-cols-3 items-center max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>
            <span className="text-gray-200">|</span>
            <h1 className="text-sm font-semibold text-gray-900">
              {isAdmin ? 'Todas las actividades' : 'Mis actividades'}
            </h1>
          </div>
          <div className="flex justify-center pointer-events-none">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
              alt="TechLARP" width={900} height={225}
              className="h-7 w-auto sm:h-48 sm:-my-[4.5rem]" priority
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <Link href="/formulario" className="btn-primary text-xs">+ Nueva</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Resumen rápido */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total',       value: actividades.length,                                                          color: 'text-gray-900' },
            { label: 'Borradores',  value: actividades.filter(a => a.estado === 'borrador').length,                     color: 'text-blue-600' },
            { label: 'En revisión', value: actividades.filter(a => ['revision','pending_review','lm_analyzed','under_review'].includes(a.estado)).length, color: 'text-amber-600' },
            { label: 'Publicadas',  value: actividades.filter(a => a.estado === 'publicado').length,                    color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-2 flex-wrap mb-6">
          {estados.map(e => (
            <button key={e} onClick={() => setFiltro(e)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtro === e
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {e === 'todas'    ? 'Todas'       :
               e === 'borrador' ? 'Borradores'  :
               e === 'revision' ? 'En revisión' :
               e === 'publicado'? 'Publicadas'  : 'Rechazadas'}
              <span className="ml-1.5 font-semibold">{conteo(e)}</span>
            </button>
          ))}
        </div>

        {filtradas.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <p className="text-sm mb-3">No hay actividades con este estado.</p>
            <Link href="/formulario" className="btn-primary text-sm inline-block">
              Crear primera actividad
            </Link>
          </div>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {filtradas.map(a => {
            const cfg = ESTADO_CONFIG[a.estado] ?? { label: a.estado, color: 'text-gray-600', bg: 'bg-gray-50' }
            const puedeEditar   = ['borrador','rechazado','modificaciones'].includes(a.estado)
            const puedeEliminar = a.estado === 'borrador'
            const tieneIndex    = a.inclusion_index &&
              (a.inclusion_index.designer || a.inclusion_index.llm_proposal)
            const indexAbierto  = expandedIndex === a.id

            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Cabecera: badge + nombre */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <h2 className="text-sm font-semibold text-gray-900 truncate">{a.nombre}</h2>
                      {isAdmin && a.autor_nombre && (
                        <span className="text-xs text-gray-400">— {a.autor_nombre}</span>
                      )}
                    </div>

                    {/* Meta */}
                    <p className="text-xs text-gray-500 mb-1">
                      {a.asignaturas} · {a.nivel_educativo} · {a.duracion_min} min
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xs text-gray-400">
                        Creada {formatDate(a.creado_en)}
                        {a.actualizado_en && ` · Modificada ${formatDate(a.actualizado_en)}`}
                      </p>
                      {/* Botón Inclusion Index */}
                      {tieneIndex && (
                        <button
                          onClick={() => setExpandIdx(indexAbierto ? null : a.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Índice de inclusión
                          <svg className={`w-3 h-3 transition-transform ${indexAbierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Feedback de rechazo */}
                    {a.estado === 'rechazado' && a.ultimo_feedback && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpand(expandedFeedback === a.id ? null : a.id)}
                          className="text-xs text-red-600 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {expandedFeedback === a.id ? 'Ocultar motivo' : 'Ver motivo de rechazo'}
                        </button>
                        {expandedFeedback === a.id && (
                          <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">
                            {a.ultimo_feedback}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Panel Inclusion Index expandible */}
                    {indexAbierto && tieneIndex && (
                      <InclusionPanel index={a.inclusion_index} />
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {a.estado === 'publicado' && (
                      <Link href={`/dashboard/actividades/${a.id}/preview`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        Ver
                      </Link>
                    )}
                    {puedeEditar && (
                      <Link href={`/formulario/${a.id}/editar`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors">
                        {a.estado === 'rechazado' ? 'Corregir' : a.estado === 'modificaciones' ? 'Ver cambios y editar' : 'Editar'}
                      </Link>
                    )}
                    {puedeEliminar && (
                      confirmDelete === a.id
                        ? <div className="flex items-center gap-1">
                            <button onClick={() => eliminarBorrador(a.id)}
                              disabled={eliminando === a.id}
                              className="text-xs px-2 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                              {eliminando === a.id ? '...' : 'Confirmar'}
                            </button>
                            <button onClick={() => setConfirm(null)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                              Cancelar
                            </button>
                          </div>
                        : <button onClick={() => setConfirm(a.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                            Eliminar
                          </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
