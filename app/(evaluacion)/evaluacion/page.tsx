'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { evalDict, type EvalLocale } from '@/lib/i18n/eval-dict'
import { bp } from '@/lib/base-path'

export default function EvaluacionPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [lang, setLang] = useState<EvalLocale>('es')

  useEffect(() => {
    const saved = sessionStorage.getItem('eval_lang')
    if (saved === 'en' || saved === 'es') setLang(saved)
  }, [])

  function changeLang(l: EvalLocale) {
    setLang(l)
    sessionStorage.setItem('eval_lang', l)
  }

  const L = evalDict[lang]

  async function handleAcceso(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const n = nombre.trim()
    if (!n || n.length < 2) {
      setError(L.accessErrorMin)
      return
    }

    setCargando(true)
    try {
      const res = await fetch(`${bp}/api/evaluacion/inicio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: n }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? L.accessErrorConn)
        return
      }

      sessionStorage.setItem('eval_nombre', data.nombre ?? '')
      sessionStorage.setItem('eval_retorno', data.esRetorno ? '1' : '0')
      sessionStorage.setItem('eval_lang', lang)
      router.push('/evaluacion/chat')
    } catch {
      setError(L.accessErrorConn)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo + lang toggle */}
        <div className="flex justify-between items-start mb-6">
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
            alt="TechLARP"
            width={220}
            height={55}
            className="object-contain"
            priority
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => changeLang('es')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${lang === 'es' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >ES</button>
            <button
              onClick={() => changeLang('en')}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${lang === 'en' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >EN</button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
          {L.accessTitle}
        </h1>
        <p className="text-sm text-center text-gray-500 mb-8">
          {L.accessSubtitle}
        </p>

        <form onSubmit={handleAcceso} className="space-y-5">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              {L.accessNameLabel}
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError('') }}
              placeholder={L.accessNamePlaceholder}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {cargando ? L.accessLoading : L.accessButton}
          </button>
        </form>

        {/* Escenarios de referencia */}
        <details className="mt-8 text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800 select-none">
            {L.accessScenariosTitle}
          </summary>
          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li><span className="font-medium text-gray-700">{L.accessScenario1Title}</span> — {L.accessScenario1Desc}</li>
            <li><span className="font-medium text-gray-700">{L.accessScenario2Title}</span> — {L.accessScenario2Desc}</li>
            <li><span className="font-medium text-gray-700">{L.accessScenario3Title}</span> — {L.accessScenario3Desc}</li>
            <li><span className="font-medium text-gray-700">{L.accessScenario4Title}</span> — {L.accessScenario4Desc}</li>
            <li><span className="font-medium text-gray-700">{L.accessScenario5Title}</span> — {L.accessScenario5Desc}</li>
          </ol>
        </details>
      </div>

      <p className="mt-6 text-xs text-gray-400">{L.accessFooter}</p>
    </div>
  )
}
