import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'

interface Props {
  params: { id: string }
  searchParams: { locale?: string }
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const locale = (searchParams.locale === 'en' || searchParams.locale === 'es') ? searchParams.locale : 'es'

  const [larp] = await sql`
    SELECT e.*, u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.id = ${params.id} AND e.estado = 'publicado'
  `

  if (!larp) return redirect('/dashboard/actividades')

  const [paralelos] = await Promise.all([
    sql`SELECT * FROM paralelos_realidad WHERE edularp_id = ${params.id} ORDER BY orden`
  ])

  const [misiones] = await Promise.all([
    sql`SELECT * FROM misiones WHERE edularp_id = ${params.id} ORDER BY orden`
  ])

  const [roles] = await Promise.all([
    sql`SELECT * FROM roles_participantes WHERE edularp_id = ${params.id} ORDER BY orden`
  ])

  const [cartas] = await Promise.all([
    sql`SELECT * FROM cartas_juego WHERE edularp_id = ${params.id} ORDER BY orden`
  ])

  const [objetivos] = await Promise.all([
    sql`SELECT * FROM objetivos WHERE edularp_id = ${params.id}`
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard/actividades" className="text-xs text-gray-400 hover:text-gray-600">
            ← Volver a actividades
          </Link>
          <div className="flex justify-center flex-1">
            <Image src="/TechLARP-logo-02.png" alt="TechLARP" width={900} height={225} className="h-20 w-auto" />
          </div>
          <div className="w-32"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Cover Section */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-8 text-white mb-8">
          <h1 className="text-3xl font-bold mb-2">{larp.nombre}</h1>
          <p className="text-purple-100 mb-4">{larp.descripcion}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded">📚 {larp.nivel_educativo}</span>
            <span className="bg-white/20 px-3 py-1 rounded">⏱️ {larp.duracion_min} min</span>
            <span className="bg-white/20 px-3 py-1 rounded">👥 {larp.num_participantes} participantes</span>
            {/* Version badge: show 'traducida' when viewed in a different language than the original */}
            {(() => {
              const esTraducida = larp.idioma_original && larp.idioma_original !== locale
              const veces: number = larp.veces_modificada ?? 0
              const versionLabel = esTraducida
                ? '🌐 Traducida'
                : veces > 0 ? '✏️ Modificada' : '✓ Original'
              const modLabel = veces > 0
                ? (locale === 'en'
                    ? (veces === 1 ? `modified ${veces} time` : `modified ${veces} times`)
                    : (veces === 1 ? `modificada ${veces} vez` : `modificada ${veces} veces`))
                : null
              return (
                <>
                  <span className="bg-white/20 px-3 py-1 rounded">{versionLabel}</span>
                  {modLabel && <span className="bg-white/10 px-3 py-1 rounded text-purple-100">{modLabel}</span>}
                </>
              )
            })()}
          </div>
          {/* Translation disclaimer */}
          {larp.idioma_original && larp.idioma_original !== locale && (
            <div className="mt-4 bg-amber-400/20 border border-amber-300/40 rounded-lg px-3 py-2 flex gap-2 items-start">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <p className="text-xs text-amber-100 leading-relaxed">
                {locale === 'en'
                  ? 'This activity was created in another language. This is an automatic translation that may alter to some extent the inclusive and narrative coherence of the original design.'
                  : 'Esta actividad fue creada en otro idioma. La versión que ves es una traducción automática que puede alterar en cierta medida la coherencia inclusiva y narrativa del diseño original.'}
              </p>
            </div>
          )}
          {larp.autor_nombre && (
            <p className="text-purple-100 mt-4 text-sm">
              Autor: <span className="font-semibold">{larp.autor_nombre}</span>
            </p>
          )}
        </div>

        {/* Subjects */}
        {larp.asignaturas && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-3">Asignaturas</h2>
            <p className="text-sm text-gray-600">{larp.asignaturas}</p>
          </div>
        )}

        {/* Images Gallery */}
        {larp.imagenes_urls && larp.imagenes_urls.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-3">Imágenes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {larp.imagenes_urls.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden bg-gray-100 aspect-video hover:opacity-90 transition-opacity">
                  <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Storyboard */}
        {larp.storyboard && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-3">Narrativa</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{larp.storyboard}</p>
          </div>
        )}

        {/* Paralelos */}
        {paralelos && paralelos.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Paralelismo Narrativa ↔ Realidad</h2>
            <div className="space-y-3">
              {paralelos.map((p: any) => (
                <div key={p.id} className="border-l-4 border-purple-300 pl-4 py-2">
                  <p className="text-sm font-medium text-purple-700">{p.narrativa}</p>
                  <p className="text-xs text-gray-600 mt-1">→ {p.mundo_real}</p>
                  {p.proposito && (
                    <p className="text-xs text-gray-500 mt-1 italic">{p.proposito}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missions */}
        {misiones && misiones.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Misiones</h2>
            <div className="space-y-4">
              {misiones.map((m: any) => (
                <div key={m.id} className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-sm mb-2">{m.titulo}</h3>
                  <p className="text-xs text-gray-600 mb-2"><strong>Objetivo:</strong> {m.objetivo}</p>
                  {m.duracion_min && <p className="text-xs text-gray-500">⏱️ {m.duracion_min} min</p>}
                  {m.problema_larp && (
                    <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                      <strong>Narrativa:</strong> {m.problema_larp}
                    </div>
                  )}
                  {m.problema_real && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <strong>Pedagógica:</strong> {m.problema_real}
                    </div>
                  )}
                  {m.solucion && <p className="text-xs mt-2"><strong>Solución:</strong> {m.solucion}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roles */}
        {roles && roles.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Roles de Participantes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((r: any) => (
                <div key={r.id} className="border rounded-lg p-3 bg-amber-50">
                  <p className="font-semibold text-sm">{r.nombre_rol}</p>
                  {r.nombre_habilidad && <p className="text-xs text-gray-600 mt-1"><strong>Habilidad:</strong> {r.nombre_habilidad}</p>}
                  <p className="text-xs text-gray-600 mt-1">{r.desc_habilidad}</p>
                  {r.uso_juego && <p className="text-xs text-gray-500 mt-1 italic">{r.uso_juego}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Cards */}
        {cartas && cartas.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Cartas de Juego</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cartas.map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 bg-teal-50">
                  <p className="font-semibold text-sm">{c.nombre}</p>
                  <p className="text-xs text-gray-500 mb-1">Tipo: {c.tipo}</p>
                  {c.habilidad && <p className="text-xs text-gray-600"><strong>Habilidad:</strong> {c.habilidad}</p>}
                  {c.lore && <p className="text-xs text-gray-600 mt-1">{c.lore}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Objectives */}
        {objetivos && objetivos.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Objetivos de Aprendizaje</h2>
            <ul className="space-y-2">
              {objetivos.map((o: any) => (
                <li key={o.id} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 mt-1">✓</span>
                  <div>
                    <p className="font-medium text-gray-700">{o.tipo}</p>
                    <p className="text-xs text-gray-600">{o.descripcion}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inclusion Index */}
        {larp.inclusion_index && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Inclusion Index</h2>

            {/* Designer — 5 criteria */}
            {larp.inclusion_index.designer && Object.keys(larp.inclusion_index.designer).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evaluación del diseñador</p>
                <div className="space-y-2">
                  {Object.entries(larp.inclusion_index.designer).map(([id, val]: [string, any]) => (
                    <div key={id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold text-indigo-600 w-16 flex-shrink-0 pt-0.5">{id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                        val.estado === 'cumple'  ? 'bg-green-100 text-green-700'
                        : val.estado === 'parcial' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>{val.estado ?? '—'}</span>
                      <p className="text-xs text-gray-600 flex-1">{val.evidencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM Proposal — up to 22 criteria */}
            {larp.inclusion_index.llm_proposal?.criteria &&
              Object.keys(larp.inclusion_index.llm_proposal.criteria).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Análisis IA</p>
                <div className="space-y-1.5">
                  {Object.entries(larp.inclusion_index.llm_proposal.criteria).map(([id, val]: [string, any]) => (
                    <div key={id} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-gray-400 w-16 flex-shrink-0 pt-0.5">{id}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        val.estado === 'cumple'  ? 'bg-green-50 text-green-600'
                        : val.estado === 'parcial' ? 'bg-amber-50 text-amber-600'
                        : 'bg-red-50 text-red-600'
                      }`}>{val.estado}</span>
                      {val.confianza != null && (
                        <span className="text-[10px] text-gray-300 flex-shrink-0 pt-0.5">{Math.round(val.confianza * 100)}%</span>
                      )}
                      <p className="text-xs text-gray-500 flex-1">{val.evidencia}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM alerts */}
            {larp.inclusion_index.llm_proposal?.alerts?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">⚠ Alertas de inconsistencia</p>
                <div className="space-y-1">
                  {larp.inclusion_index.llm_proposal.alerts.map((a: any, i: number) => (
                    <p key={i} className="text-xs text-amber-800"><strong>{a.criterio}:</strong> {a.mensaje}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Info */}
        {larp.materiales || larp.evaluacion || larp.notas_docente ? (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-4">Información Adicional</h2>
            {larp.materiales && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Materiales:</p>
                <p className="text-sm text-gray-700">{larp.materiales}</p>
              </div>
            )}
            {larp.evaluacion && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Evaluación:</p>
                <p className="text-sm text-gray-700">{larp.evaluacion}</p>
              </div>
            )}
            {larp.notas_docente && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Notas del Docente:</p>
                <p className="text-sm text-gray-700">{larp.notas_docente}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-8">
          <p>© TechLARP - Proyecto Erasmus+ KA201</p>
        </div>
      </main>
    </div>
  )
}
