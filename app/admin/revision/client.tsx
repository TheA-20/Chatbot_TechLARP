'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Seccion = 'revision' | 'docentes'

export default function AdminRevisionClient({ pendientes, docentes, stats }: any) {
  const router = useRouter()
  const [seccion, setSeccion]     = useState<Seccion>('revision')
  const [preview, setPreview]     = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [feedback, setFeedback]   = useState('')
  const [motivoId, setMotivoId]   = useState<string | null>(null)
  const [motivo, setMotivo]       = useState('')
  const [loading, setLoading]     = useState(false)

  async function openPreview(id: string) {
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/edularp/${id}`)
      const data = await res.json()
      setPreview(data)
      setFeedback('')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function aprobar(id: string, fb = '') {
    setLoading(true)
    await fetch('/api/admin/aprobar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edularp_id: id, feedback: fb }),
    })
    setPreview(null); setFeedback(''); setLoading(false); router.refresh()
  }

  async function rechazar(id: string, m: string) {
    if (!m.trim()) return
    setLoading(true)
    await fetch('/api/admin/rechazar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edularp_id: id, motivo: m }),
    })
    setMotivoId(null); setMotivo(''); setPreview(null); setLoading(false); router.refresh()
  }

  async function toggleDocente(id: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'activo' ? 'suspendido' : 'activo'
    await fetch('/api/admin/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: id, estado: nuevoEstado }),
    })
    router.refresh()
  }

  async function aprobarDocente(id: string) {
    await fetch('/api/admin/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: id, estado: 'activo' }),
    })
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-40 overflow-visible">
        <div className="grid grid-cols-3 items-center max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-sm font-medium">Panel de administración</span>
          </div>
          <div className="flex justify-center pointer-events-none">
            <Image src="/TechLARP-logo-02.png" alt="TechLARP" width={900} height={225} className="h-48 w-auto -my-[4.5rem]" priority />
          </div>
          <div className="flex justify-end">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Admin</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {/* ── MÉTRICAS ── */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Publicados',  value: stats.publicados,  color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Rechazados', value: stats.rechazados, color: 'text-red-500',    bg: 'bg-red-50' },
            { label: 'Docentes',   value: stats.docentes,   color: 'text-blue-600',  bg: 'bg-blue-50' },
          ].map(m => (
            <div key={m.label} className={`${m.bg} rounded-xl border border-white p-4`}>
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className={`text-2xl font-semibold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 mb-4 bg-white border border-gray-100 rounded-xl p-1 w-fit">
          {([['revision', 'Revisión', stats.pendientes], ['docentes', 'Docentes', null]] as const).map(([s, label, badge]) => (
            <button key={s} onClick={() => setSeccion(s)}
              className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg transition-colors font-medium
                ${seccion === s ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
              {badge > 0 && (
                <span className={`text-xs px-1.5 py-0 rounded-full font-semibold
                  ${seccion === s ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── SECCIÓN REVISIÓN ── */}
        {seccion === 'revision' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium">Actividades pendientes de revisión</h2>
            </div>
            {pendientes.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">No hay actividades pendientes</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendientes.map((l: any) => (
                  <div key={l.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{l.nombre}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          l.estado === 'revision' || l.estado === 'pending_review' ? 'bg-amber-100 text-amber-700'
                          : l.estado === 'lm_analyzed' ? 'bg-indigo-100 text-indigo-700'
                          : l.estado === 'under_review' ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                        }`}>{l.estado}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {l.nivel_educativo} · {l.asignaturas} · {l.duracion_min} min · {l.num_participantes} participantes · {l.num_roles} roles
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {l.autor_nombre} · {new Date(l.creado_en).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openPreview(l.id)}
                        disabled={loadingPreview}
                        className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver detalle
                      </button>
                      <button onClick={() => aprobar(l.id)} className="btn-success text-xs" disabled={loading}>Aprobar</button>
                      <button onClick={() => { setMotivoId(l.id); setMotivo('') }} className="btn-danger text-xs">Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECCIÓN DOCENTES ── */}
        {seccion === 'docentes' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium">Gestión de docentes</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {docentes.map((d: any) => (
                <div key={d.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                    {d.nombre.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.nombre}</p>
                    <p className="text-xs text-gray-400">{d.email} · {d.num_larps} actividades</p>
                  </div>
                  <span className={d.estado === 'activo' ? 'badge-approved' : d.estado === 'pendiente' ? 'badge-pending' : 'badge-rejected'}>
                    {d.estado}
                  </span>
                  {d.estado === 'pendiente'
                    ? <button onClick={() => aprobarDocente(d.id)} className="btn-success text-xs">Aprobar acceso</button>
                    : <button onClick={() => toggleDocente(d.id, d.estado)}
                        className={d.estado === 'activo' ? 'btn-danger text-xs' : 'btn-success text-xs'}>
                        {d.estado === 'activo' ? 'Suspender' : 'Reactivar'}
                      </button>
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DE VISTA PREVIA (slide-over) ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setPreview(null)} />
          <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => setPreview(null)}
                className="flex items-center gap-2 text-gray-400 hover:text-gray-600 text-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cerrar
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setMotivoId(preview.larp.id); setMotivo('') }} className="btn-danger text-xs">Rechazar</button>
                <button onClick={() => aprobar(preview.larp.id, feedback)} className="btn-success text-xs" disabled={loading}>Aprobar y publicar</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 text-white">
                <h2 className="text-xl font-bold mb-1">{preview.larp.nombre}</h2>
                <p className="text-purple-100 text-sm mb-3">{preview.larp.descripcion}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[preview.larp.nivel_educativo, preview.larp.asignaturas,
                    `${preview.larp.duracion_min} min`, `${preview.larp.num_participantes} participantes`
                  ].filter(Boolean).map((tag, i) => (
                    <span key={i} className="bg-white/20 px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
                <p className="text-purple-200 text-xs mt-3">{preview.larp.autor_nombre} · {preview.larp.autor_email}</p>
              </div>

              {/* Images Gallery */}
              {Array.isArray(preview.larp.imagenes_urls) && preview.larp.imagenes_urls.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Imágenes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {preview.larp.imagenes_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden bg-gray-100 aspect-video hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {preview.larp.storyboard && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">Narrativa / Storyboard</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">{preview.larp.storyboard}</p>
                  {preview.larp.storyboard_alt && (
                    <p className="text-xs text-gray-500 bg-purple-50 rounded-lg p-3 mt-2 whitespace-pre-wrap">{preview.larp.storyboard_alt}</p>
                  )}
                </section>
              )}

              {preview.paralelos?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Paralelos con la realidad</h3>
                  <div className="grid grid-cols-3 gap-1 text-xs text-gray-400 font-medium mb-1 px-1">
                    <span>Narrativa</span><span>Real</span><span>Propósito</span>
                  </div>
                  <div className="space-y-2">
                    {preview.paralelos.map((p: any) => (
                      <div key={p.id} className="grid grid-cols-3 gap-1 bg-gray-50 rounded-lg p-2 text-xs">
                        <span className="text-purple-700 font-medium">{p.narrativa}</span>
                        <span className="text-gray-600">{p.mundo_real}</span>
                        <span className="text-gray-400 italic">{p.proposito}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {preview.misiones?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Misiones ({preview.misiones.length})</h3>
                  <div className="space-y-3">
                    {preview.misiones.map((m: any, i: number) => (
                      <div key={m.id} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">{i+1}</span>
                          <p className="text-sm font-medium">{m.titulo}</p>
                          {m.formato && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 ml-auto">{m.formato}</span>}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{m.objetivo}</p>
                        {m.duracion_min && <p className="text-xs text-gray-400">⏱ {m.duracion_min} min</p>}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {m.problema_larp && <div className="bg-purple-50 rounded p-2 text-xs"><strong className="text-purple-700">LARP:</strong> {m.problema_larp}</div>}
                          {m.problema_real && <div className="bg-blue-50 rounded p-2 text-xs"><strong className="text-blue-700">Real:</strong> {m.problema_real}</div>}
                        </div>
                        {m.solucion && <p className="text-xs text-gray-600 mt-2"><strong>Solución:</strong> {m.solucion}</p>}

                      </div>
                    ))}
                  </div>
                </section>
              )}

              {preview.roles?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Roles ({preview.roles.length})</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {preview.roles.map((r: any) => (
                      <div key={r.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-xs font-semibold">{r.nombre_rol}</p>
                        {r.nombre_habilidad && <p className="text-xs text-amber-700 mt-1">⚡ {r.nombre_habilidad}</p>}
                        <p className="text-xs text-gray-500 mt-1">{r.desc_habilidad}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {preview.cartas?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Cartas ({preview.cartas.length})</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {preview.cartas.map((c: any) => (
                      <div key={c.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium">{c.nombre}</p>
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">{c.tipo}</span>
                        </div>
                        {c.habilidad && <p className="text-xs text-purple-600">⚡ {c.habilidad}</p>}
                        {c.lore && <p className="text-xs text-gray-400 italic mt-1">{c.lore}</p>}
                        {c.descripcion && <p className="text-xs text-gray-500 mt-1">{c.descripcion}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {preview.objetivos?.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Objetivos de aprendizaje</h3>
                  <div className="space-y-2">
                    {preview.objetivos.map((o: any) => (
                      <div key={o.id} className="flex gap-3 bg-gray-50 rounded-lg p-3">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex-shrink-0 h-fit">{o.tipo}</span>
                        <p className="text-xs text-gray-600">{o.descripcion}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Inclusion Index — designer evaluations + LLM proposals */}
              {preview.larp.inclusion_index && (
                <section>
                  <h3 className="text-sm font-semibold mb-3">Inclusion Index</h3>

                  {/* Designer: 5 criteria */}
                  {preview.larp.inclusion_index.designer && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Evaluación del diseñador (5 criterios)</p>
                      <div className="space-y-2">
                        {Object.entries(preview.larp.inclusion_index.designer).map(([id, val]: [string, any]) => (
                          <div key={id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs font-bold text-indigo-600 w-16 flex-shrink-0">{id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              val.estado === 'cumple'    ? 'bg-green-100 text-green-700'
                              : val.estado === 'parcial'   ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                            }`}>{val.estado}</span>
                            <p className="text-xs text-gray-500 flex-1">{val.evidencia}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LLM: 22 criteria proposals */}
                  {preview.larp.inclusion_index.llm_proposal?.criteria && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Propuesta IA (22 criterios)</p>
                      <div className="space-y-1.5">
                        {Object.entries(preview.larp.inclusion_index.llm_proposal.criteria).map(([id, val]: [string, any]) => (
                          <div key={id} className="flex items-start gap-2">
                            <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0">{id}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                              val.estado === 'cumple'    ? 'bg-green-50 text-green-600'
                              : val.estado === 'parcial'   ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600'
                            }`}>{val.estado}</span>
                            {val.confianza != null && (
                              <span className="text-[10px] text-gray-300 flex-shrink-0">{Math.round(val.confianza * 100)}%</span>
                            )}
                            <p className="text-xs text-gray-400 flex-1">{val.evidencia}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LLM alerts */}
                  {preview.larp.inclusion_index.llm_proposal?.alerts?.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Alertas de inconsistencia</p>
                      {preview.larp.inclusion_index.llm_proposal.alerts.map((a: any, i: number) => (
                        <p key={i} className="text-xs text-amber-800"><strong>{a.criterio}:</strong> {a.mensaje}</p>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {(preview.larp.evaluacion || preview.larp.notas_docente) && (
                <section className="space-y-3">
                  {preview.larp.evaluacion && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Evaluación</h3>
                      <p className="text-sm text-gray-700">{preview.larp.evaluacion}</p>
                    </div>
                  )}
                  {preview.larp.notas_docente && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-blue-500 mb-1 uppercase tracking-wide">Notas para docentes</h3>
                      <p className="text-sm text-blue-800">{preview.larp.notas_docente}</p>
                    </div>
                  )}
                </section>
              )}

              <section className="border-t border-gray-100 pt-4">
                <label className="text-xs font-medium text-gray-500 block mb-2">Feedback para el equipo docente (opcional)</label>
                <textarea className="input h-20 resize-none text-sm" value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Comentarios o sugerencias antes de publicar..." />
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RECHAZO ── */}
      {motivoId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-medium text-sm mb-1">Motivo de rechazo</h3>
            <p className="text-xs text-gray-400 mb-3">Este mensaje se enviará al equipo docente autor de la actividad.</p>
            <textarea className="input h-24 resize-none mb-4" value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Los objetivos pedagógicos no están suficientemente definidos..." />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setMotivoId(null); setMotivo('') }} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={() => rechazar(motivoId, motivo)}
                className="btn-danger text-xs" disabled={!motivo.trim() || loading}>Enviar rechazo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
