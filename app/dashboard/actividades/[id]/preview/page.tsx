import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import Image from 'next/image'
import { getDictionary } from '@/lib/i18n/dictionary'
import PreviewActions from './PreviewActions'

interface Props {
  params: { id: string }
  searchParams: { locale?: string }
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const locale = (searchParams.locale === 'en' || searchParams.locale === 'es') ? searchParams.locale : 'es'
  const t = getDictionary(locale)
  const rol = (session.user as any)?.rol ?? 'estudiante'
  const userId = (session.user as any)?.id ?? ''

  const [larp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${params.id} AND e.estado = 'publicado'
  `
  if (!larp) return redirect('/dashboard/actividades')

  let paralelos: any[] = [], misiones: any[] = [], roles: any[] = [], cartas: any[] = [], objetivos: any[] = []
  try {
    ;[paralelos, misiones, roles, cartas, objetivos] = await Promise.all([
      sql`SELECT * FROM paralelos_realidad WHERE edularp_id = ${params.id} ORDER BY orden`,
      sql`SELECT * FROM misiones WHERE edularp_id = ${params.id} ORDER BY orden`,
      sql`SELECT * FROM roles_participantes WHERE edularp_id = ${params.id} ORDER BY orden`,
      sql`SELECT * FROM cartas_juego WHERE edularp_id = ${params.id} ORDER BY orden`,
      sql`SELECT * FROM objetivos WHERE edularp_id = ${params.id}`,
    ])
  } catch (err) { console.error('[preview]', err) }

  const isAdmin = rol === 'admin'
  const isOwner = larp.autor_id === userId
  const esTraducida = larp.idioma_original && larp.idioma_original !== locale
  const veces: number = larp.veces_modificada ?? 0

  let inclusionScore: number | null = null
  if (larp.inclusion_index?.designer && Object.keys(larp.inclusion_index.designer).length > 0) {
    const vals = Object.values(larp.inclusion_index.designer) as any[]
    const pts = vals.reduce((acc: number, v: any) =>
      acc + (v?.estado === 'cumple' ? 1 : v?.estado === 'parcial' ? 0.5 : 0), 0)
    inclusionScore = Math.round((pts / vals.length) * 100)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-10 overflow-visible">
        <div className="max-w-4xl mx-auto grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <a href="/dashboard/actividades" className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
              {t.previewBackToActivities}
            </a>
            <div className="flex gap-1">
              <a href={`/dashboard/actividades/${params.id}/preview?locale=es`}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${locale === 'es' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}>
                ES
              </a>
              <a href={`/dashboard/actividades/${params.id}/preview?locale=en`}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${locale === 'en' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}>
                EN
              </a>
            </div>
          </div>
          <div className="flex justify-center pointer-events-none">
            <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
              alt="TechLARP" width={900} height={225}
              className="h-7 w-auto sm:h-48 sm:-my-[4.5rem]" priority />
          </div>
          <div className="flex items-center justify-end gap-2">
            <PreviewActions id={params.id} locale={locale} isAdmin={isAdmin} isOwner={isOwner}
              t={{ downloadPdf: t.previewDownloadPdf, reanalyze: t.previewReanalyze,
                   reanalyzing: t.previewReanalyzing, reanalyzed: t.previewReanalyzed,
                   editActivity: t.editActivity }} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Cover */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-8 text-white mb-8 shadow-lg">
          <h1 className="text-3xl font-bold mb-2">{larp.nombre}</h1>
          <p className="text-purple-100 mb-5 leading-relaxed">{larp.descripcion}</p>
          <div className="flex flex-wrap gap-2 text-sm mb-4">
            <span className="bg-white/20 px-3 py-1 rounded-full">📚 {larp.nivel_educativo}</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">⏱️ {larp.duracion_min} min</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">👥 {larp.num_participantes} {locale === 'en' ? 'participants' : 'participantes'}</span>
            {inclusionScore !== null && (
              <span className={`px-3 py-1 rounded-full font-semibold ${inclusionScore >= 80 ? 'bg-green-400/30' : inclusionScore >= 50 ? 'bg-amber-400/30' : 'bg-red-400/30'}`}>
                🏅 {locale === 'en' ? 'Inclusion' : 'Inclusión'} {inclusionScore}%
              </span>
            )}
            <span className="bg-white/20 px-3 py-1 rounded-full">
              {esTraducida ? t.previewVersionTranslated : veces > 0 ? t.previewVersionModified : t.previewVersionOriginal}
            </span>
          </div>
          {esTraducida && (
            <div className="bg-amber-400/20 border border-amber-300/40 rounded-xl px-4 py-3 flex gap-2 items-start mb-4">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <p className="text-xs text-amber-100 leading-relaxed">{t.previewTranslationDisclaimer}</p>
            </div>
          )}
          {larp.autor_nombre && (
            <p className="text-purple-200 text-sm">{t.previewLabelAuthor}: <span className="font-semibold text-white">{larp.autor_nombre}</span></p>
          )}
        </div>

        {larp.asignaturas && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-2">{t.previewSectionSubjects}</h2>
            <p className="text-sm text-gray-600">{larp.asignaturas}</p>
          </div>
        )}
        {larp.imagenes_urls && larp.imagenes_urls.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-3">{t.previewSectionImages}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {larp.imagenes_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden bg-gray-100 aspect-video hover:opacity-90">
                  <img src={url} alt={String(i+1)} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
        {larp.storyboard && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-3">{t.previewSectionNarrative}</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{larp.storyboard}</p>
          </div>
        )}
        {paralelos && paralelos.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionParallels}</h2>
            <div className="space-y-3">
              {paralelos.map((p: any) => (
                <div key={p.id} className="border-l-4 border-purple-300 pl-4 py-2">
                  <p className="text-sm font-medium text-purple-700">{p.narrativa}</p>
                  <p className="text-xs text-gray-600 mt-1">→ {p.mundo_real}</p>
                  {p.proposito && <p className="text-xs text-gray-500 mt-1 italic">{p.proposito}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {misiones && misiones.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionMissions}</h2>
            <div className="space-y-4">
              {misiones.map((m: any) => (
                <div key={m.id} className="border rounded-xl p-4 bg-gray-50">
                  <h3 className="font-semibold text-sm mb-2">{m.titulo}</h3>
                  <p className="text-xs text-gray-600 mb-1"><strong>{t.previewLabelObjective}:</strong> {m.objetivo}</p>
                  {m.duracion_min && <p className="text-xs text-gray-500 mb-2">⏱️ {m.duracion_min} min</p>}
                  {m.problema_larp && <div className="mt-2 p-2 bg-purple-50 rounded-lg text-xs"><strong>{t.previewLabelNarrativeProblem}:</strong> {m.problema_larp}</div>}
                  {m.problema_real && <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs"><strong>{t.previewLabelRealConnection}:</strong> {m.problema_real}</div>}
                  {m.solucion && <p className="text-xs mt-2"><strong>{t.previewLabelSolution}:</strong> {m.solucion}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {roles && roles.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionRoles}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((r: any) => (
                <div key={r.id} className="border rounded-xl p-3 bg-amber-50">
                  <p className="font-semibold text-sm">{r.nombre_rol}</p>
                  {r.nombre_habilidad && <p className="text-xs text-gray-600 mt-1"><strong>{t.previewLabelSkill}:</strong> {r.nombre_habilidad}</p>}
                  {r.desc_habilidad && <p className="text-xs text-gray-600 mt-1">{r.desc_habilidad}</p>}
                  {r.uso_juego && <p className="text-xs text-gray-500 mt-1 italic">{r.uso_juego}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {cartas && cartas.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionCards}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cartas.map((c: any) => (
                <div key={c.id} className="border rounded-xl p-3 bg-teal-50">
                  <p className="font-semibold text-sm">{c.nombre}</p>
                  <p className="text-xs text-gray-500 mb-1">{t.previewLabelType}: {c.tipo}</p>
                  {c.habilidad && <p className="text-xs text-gray-600"><strong>{t.previewLabelSkill}:</strong> {c.habilidad}</p>}
                  {c.lore && <p className="text-xs text-gray-600 mt-1">{c.lore}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {objetivos && objetivos.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionObjectives}</h2>
            <ul className="space-y-2">
              {objetivos.map((o: any) => (
                <li key={o.id} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 mt-0.5 flex-shrink-0">✓</span>
                  <div>
                    <p className="font-medium text-gray-700">{o.tipo}</p>
                    <p className="text-xs text-gray-600">{o.descripcion}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {larp.inclusion_index && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">{t.previewSectionInclusionIndex}</h2>
              {inclusionScore !== null && (
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${inclusionScore >= 80 ? 'bg-green-100 text-green-700' : inclusionScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{inclusionScore}%</span>
              )}
            </div>
            {larp.inclusion_index.designer && Object.keys(larp.inclusion_index.designer).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.previewSectionDesignerEval}</p>
                <div className="space-y-2">
                  {Object.entries(larp.inclusion_index.designer).map(([cid, val]: [string, any]) => (
                    <div key={cid} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-indigo-600 w-16 flex-shrink-0 pt-0.5">{cid}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${val.estado === 'cumple' ? 'bg-green-100 text-green-700' : val.estado === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{val.estado ?? '—'}</span>
                      <p className="text-xs text-gray-600 flex-1">{val.evidencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {larp.inclusion_index.llm_proposal?.criteria && Object.keys(larp.inclusion_index.llm_proposal.criteria).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.previewSectionAIAnalysis}</p>
                <div className="space-y-1.5">
                  {Object.entries(larp.inclusion_index.llm_proposal.criteria).map(([cid, val]: [string, any]) => (
                    <div key={cid} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0 pt-0.5">{cid}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${val.estado === 'cumple' ? 'bg-green-50 text-green-600' : val.estado === 'parcial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>{val.estado}</span>
                      {val.confianza != null && <span className="text-[10px] text-gray-300 flex-shrink-0 pt-0.5">{Math.round(val.confianza * 100)}%</span>}
                      <p className="text-xs text-gray-500 flex-1">{val.evidencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {larp.inclusion_index.llm_proposal?.alerts?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">{t.previewSectionAlerts}</p>
                <div className="space-y-1">
                  {larp.inclusion_index.llm_proposal.alerts.map((a: any, i: number) => (
                    <p key={i} className="text-xs text-amber-800"><strong>{a.criterio}:</strong> {a.mensaje}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {(larp.materiales || larp.evaluacion || larp.notas_docente) && (
          <div className="card mb-6">
            <h2 className="text-base font-semibold mb-4">{t.previewSectionAdditional}</h2>
            {larp.materiales && <div className="mb-3"><p className="text-xs font-semibold text-gray-500 mb-1">{t.previewLabelMaterials2}</p><p className="text-sm text-gray-700">{larp.materiales}</p></div>}
            {larp.evaluacion && <div className="mb-3"><p className="text-xs font-semibold text-gray-500 mb-1">{t.previewLabelEvaluation2}</p><p className="text-sm text-gray-700">{larp.evaluacion}</p></div>}
            {larp.notas_docente && <div><p className="text-xs font-semibold text-gray-500 mb-1">{t.previewLabelTeacherNotes}</p><p className="text-sm text-gray-700">{larp.notas_docente}</p></div>}
          </div>
        )}
        <div className="text-center text-xs text-gray-300 py-8">© TechLARP · Erasmus+ KA201</div>
      </main>
    </div>
  )
}
