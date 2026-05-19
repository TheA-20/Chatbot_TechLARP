'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function EvaluacionPage() {
  const router = useRouter()
  const [docenteId, setDocenteId] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleAcceso(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const id = docenteId.trim()
    if (!id) {
      setError('Por favor, introduce el ID del docente.')
      return
    }

    setCargando(true)
    try {
      const res = await fetch('/api/evaluacion/inicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docente_id: id }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'No se pudo iniciar la sesión.')
        return
      }

      // Guardar nombre del docente en sessionStorage para mostrarlo en el chat
      sessionStorage.setItem('eval_nombre', data.nombre ?? '')
      router.push('/evaluacion/chat')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/TechLARP_Symbol.png"
            alt="TechLARP"
            width={56}
            height={56}
            className="object-contain"
          />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
          Evaluación del Asistente TechLARP
        </h1>
        <p className="text-sm text-center text-gray-500 mb-8">
          Introduce el ID que se te ha proporcionado para iniciar la sesión de evaluación.
        </p>

        <form onSubmit={handleAcceso} className="space-y-5">
          <div>
            <label htmlFor="docente_id" className="block text-sm font-medium text-gray-700 mb-1">
              ID del docente experto
            </label>
            <input
              id="docente_id"
              type="text"
              value={docenteId}
              onChange={e => { setDocenteId(e.target.value); setError('') }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
              autoComplete="off"
              spellCheck={false}
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
            {cargando ? 'Verificando…' : 'Iniciar evaluación'}
          </button>
        </form>

        {/* Escenarios de referencia */}
        <details className="mt-8 text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800 select-none">
            Ver escenarios de evaluación
          </summary>
          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li><span className="font-medium text-gray-700">Selección guiada</span> — Busca una actividad para un contexto concreto (5.º Primaria, Matemáticas, participación femenina).</li>
            <li><span className="font-medium text-gray-700">Adaptación</span> — Parte de una actividad de Secundaria y pide adaptarla para 6.º de Primaria manteniendo el enfoque de inclusión.</li>
            <li><span className="font-medium text-gray-700">Apoyo formativo</span> — Solicita que el agente explique contenido técnico (programación, electrónica) que escapa a tu dominio.</li>
            <li><span className="font-medium text-gray-700">Fuera de alcance</span> — Realiza una consulta que probablemente no está en el repositorio para observar cómo el agente gestiona los límites.</li>
            <li><span className="font-medium text-gray-700">Conversación libre</span> — 10 minutos de interacción no guiada, como lo haría cualquier docente real.</li>
          </ol>
        </details>
      </div>

      {/* Marca DEI */}
      <p className="mt-6 text-xs text-gray-400">Plataforma TechLARP · DEI Interactive Systems Group</p>
    </div>
  )
}
