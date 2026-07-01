'use client'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { edularpSchema, type EduLarpForm } from '@/lib/schemas/edularp.schema'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { bp } from '@/lib/base-path'

interface Props { larp: any }

function coerceInt(v: any, fallback: number): number {
  const n = parseInt(v)
  return isNaN(n) ? fallback : n
}

function buildDefaultValues(larp: any): EduLarpForm {
  return {
    nombre:           larp.nombre ?? '',
    descripcion:      larp.descripcion ?? '',
    storyboard:       larp.storyboard ?? '',
    storyboard_alt:   larp.storyboard_alt ?? '',
    status:           larp.status ?? 'borrador',
    tipo_version:     larp.tipo_version ?? 'original',
    nivel_educativo:  (larp.nivel_educativo ?? 'Secundaria') as 'Primaria' | 'Secundaria',
    asignaturas:      larp.asignaturas ?? '',
    duracion_min:     coerceInt(larp.duracion_min, 60),
    num_participantes:coerceInt(larp.num_participantes, 20),
    materiales:       larp.materiales ?? '',
    evaluacion:       larp.evaluacion ?? '',
    notas_docente:    larp.notas_docente ?? '',
    competencias:     larp.competencias ?? [],
    idioma_original:  larp.idioma_original ?? 'es',
    proyecto:         larp.proyecto ?? '',
    inclusion_index:  larp.inclusion_index ?? null,
    recursos_globales:larp.recursos_globales ?? null,
    imagenes_urls:    larp.imagenes_urls ?? [],
    paralelos: (larp.paralelos ?? []).map((p: any) => ({
      narrativa:  p.narrativa ?? '',
      mundo_real: p.mundo_real ?? '',
      proposito:  p.proposito ?? '',
    })),
    misiones: (larp.misiones ?? []).map((m: any) => ({
      titulo:        m.titulo ?? '',
      objetivo:      m.objetivo ?? '',
      duracion_min:  m.duracion_min ?? undefined,
      formato:       m.formato ?? '',
      problema_larp: m.problema_larp ?? '',
      problema_real: m.problema_real ?? '',
      solucion:      m.solucion ?? '',
      recursos:      m.recursos ?? '',
    })),
    roles: (larp.roles ?? []).map((r: any) => ({
      nombre_rol:       r.nombre_rol ?? '',
      nombre_habilidad: r.nombre_habilidad ?? '',
      desc_habilidad:   r.desc_habilidad ?? '',
      uso_juego:        r.uso_juego ?? '',
    })),
    cartas: (larp.cartas ?? []).map((c: any) => ({
      nombre:      c.nombre ?? '',
      tipo:        (c.tipo ?? 'otro') as 'personaje' | 'habilidad' | 'objeto' | 'evento' | 'figura_historica' | 'otro',
      habilidad:   c.habilidad ?? '',
      lore:        c.lore ?? '',
      descripcion: c.descripcion ?? '',
    })),
    objetivos: (larp.objetivos ?? []).map((o: any) => ({
      tipo:        o.tipo ?? '',
      descripcion: o.descripcion ?? '',
    })),
  }
}

export default function EditarFormularioClient({ larp }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando]   = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  const { register, control, handleSubmit, formState: { errors } } = useForm<EduLarpForm>({
    resolver: zodResolver(edularpSchema),
    defaultValues: buildDefaultValues(larp),
  })

  const { fields: paralelos, append: addParalelo, remove: removeParalelo } = useFieldArray({ control, name: 'paralelos' })
  const { fields: misiones,  append: addMision,   remove: removeMision   } = useFieldArray({ control, name: 'misiones'  })
  const { fields: roles,     append: addRol,      remove: removeRol      } = useFieldArray({ control, name: 'roles'     })
  const { fields: cartas,    append: addCarta,    remove: removeCarta    } = useFieldArray({ control, name: 'cartas'    })
  const { fields: objetivos, append: addObjetivo, remove: removeObjetivo } = useFieldArray({ control, name: 'objetivos' })

  async function guardarBorrador(data: EduLarpForm) {
    setGuardando(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${bp}/api/edularp/${larp.id}/editar`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, estado: 'borrador' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')
      setSuccess('Borrador guardado correctamente.')
    } catch (e: any) {
      setError(e.message)
    }
    setGuardando(false)
  }

  async function enviarARevision(data: EduLarpForm) {
    setEnviando(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`${bp}/api/edularp/${larp.id}/editar`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, estado: 'pending_review' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al enviar')
      setSuccess('Actividad enviada a revisión. El equipo de TechLARP la revisará pronto.')
      setTimeout(() => router.push('/dashboard/mis-actividades'), 1500)
    } catch (e: any) {
      setError(e.message)
    }
    setEnviando(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/mis-actividades"
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Mis actividades
            </Link>
            <h1 className="text-sm font-semibold text-gray-900">
              Editar: {larp.nombre}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              larp.estado === 'rechazado' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {larp.estado === 'rechazado' ? 'Rechazada' : 'Borrador'}
            </span>
          </div>
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
            alt="TechLARP" width={600} height={150} className="h-7 w-auto" priority
          />
        </div>
      </header>

      {larp.estado === 'rechazado' && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <p className="font-semibold mb-1">Esta actividad fue rechazada</p>
            <p className="text-xs text-red-600">
              Corrige los problemas indicados y vuelve a enviarla a revisión.
            </p>
          </div>
        </div>
      )}

      <form className="max-w-4xl mx-auto px-6 py-6 space-y-8">

        {/* Mensajes de estado */}
        {error   && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{success}</div>}

        {/* Información básica */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Información básica</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre de la actividad *</label>
            <input {...register('nombre')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nivel educativo *</label>
              <input {...register('nivel_educativo')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Asignaturas *</label>
              <input {...register('asignaturas')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Duración (minutos) *</label>
              <input type="number" {...register('duracion_min', { valueAsNumber: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Num. participantes *</label>
              <input type="number" {...register('num_participantes', { valueAsNumber: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descripción *</label>
            <textarea {...register('descripcion')} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Storyboard *</label>
            <textarea {...register('storyboard')} rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Materiales</label>
            <textarea {...register('materiales')} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Evaluación</label>
            <textarea {...register('evaluacion')} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notas para docentes</label>
            <textarea {...register('notas_docente')} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>
        </section>

        {/* Paralelos */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Realidades paralelas ({paralelos.length})</h2>
            <button type="button" onClick={() => addParalelo({ narrativa: '', mundo_real: '', proposito: '' })}
              className="text-xs text-primary hover:underline">+ Añadir</button>
          </div>
          {paralelos.map((f, i) => (
            <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
              <button type="button" onClick={() => removeParalelo(i)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs">✕</button>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Ficción (LARP)</label>
                <textarea {...register(`paralelos.${i}.narrativa`)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Realidad (aula)</label>
                <textarea {...register(`paralelos.${i}.mundo_real`)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              </div>
            </div>
          ))}
        </section>

        {/* Misiones */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Misiones ({misiones.length})</h2>
            <button type="button" onClick={() => addMision({ titulo: '', objetivo: '', duracion_min: undefined, formato: '', problema_larp: '', problema_real: '', solucion: '', recursos: '' })}
              className="text-xs text-primary hover:underline">+ Añadir</button>
          </div>
          {misiones.map((f, i) => (
            <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
              <button type="button" onClick={() => removeMision(i)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs">✕</button>
              <input {...register(`misiones.${i}.titulo`)} placeholder="Título de la misión" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium" />
              <textarea {...register(`misiones.${i}.objetivo`)} rows={2} placeholder="Objetivo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <textarea {...register(`misiones.${i}.problema_larp`)} rows={2} placeholder="Problema en el LARP" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
                <textarea {...register(`misiones.${i}.problema_real`)} rows={2} placeholder="Problema real (aula)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              </div>
              <textarea {...register(`misiones.${i}.solucion`)} rows={2} placeholder="Solución" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
            </div>
          ))}
        </section>

        {/* Roles */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Roles ({roles.length})</h2>
            <button type="button" onClick={() => addRol({ nombre_rol: '', nombre_habilidad: '', desc_habilidad: '', uso_juego: '' })}
              className="text-xs text-primary hover:underline">+ Añadir</button>
          </div>
          {roles.map((f, i) => (
            <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
              <button type="button" onClick={() => removeRol(i)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs">✕</button>
              <div className="grid grid-cols-2 gap-3">
                <input {...register(`roles.${i}.nombre_rol`)} placeholder="Nombre del rol" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                <input {...register(`roles.${i}.nombre_habilidad`)} placeholder="Nombre habilidad" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
              </div>
              <textarea {...register(`roles.${i}.desc_habilidad`)} rows={2} placeholder="Descripción de habilidad" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
              <textarea {...register(`roles.${i}.uso_juego`)} rows={2} placeholder="Uso en el juego" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
            </div>
          ))}
        </section>

        {/* Cartas */}
        <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Cartas ({cartas.length})</h2>
            <button type="button" onClick={() => addCarta({ nombre: '', tipo: 'otro' as const, habilidad: '', lore: '', descripcion: '' })}
              className="text-xs text-primary hover:underline">+ Añadir</button>
          </div>
          {cartas.map((f, i) => (
            <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3 relative">
              <button type="button" onClick={() => removeCarta(i)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs">✕</button>
              <div className="grid grid-cols-2 gap-3">
                <input {...register(`cartas.${i}.nombre`)} placeholder="Nombre" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                <input {...register(`cartas.${i}.tipo`)} placeholder="Tipo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
              </div>
              <input {...register(`cartas.${i}.habilidad`)} placeholder="Habilidad" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" />
              <textarea {...register(`cartas.${i}.lore`)} rows={2} placeholder="Lore / Trasfondo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none" />
            </div>
          ))}
        </section>

        {/* Botones de acción */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 -mx-6 flex gap-3 justify-end">
          <Link href="/dashboard/mis-actividades"
            className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancelar
          </Link>
          <button type="button"
            onClick={handleSubmit(guardarBorrador)}
            disabled={guardando}
            className="text-sm px-4 py-2 rounded-xl border border-primary text-primary hover:bg-primary/5 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button type="button"
            onClick={handleSubmit(enviarARevision)}
            disabled={enviando}
            className="btn-primary text-sm px-5 py-2 rounded-xl disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Enviar a revisión'}
          </button>
        </div>
      </form>
    </div>
  )
}
