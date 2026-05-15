import { z } from 'zod'

// ── Subesquemas reutilizables ──────────────────────────────

export const paraleloSchema = z.object({
  narrativa:   z.string().min(2, 'Campo obligatorio'),
  mundo_real:  z.string().min(2, 'Campo obligatorio'),
  proposito:   z.string().optional(),
})

export const misionSchema = z.object({
  titulo:          z.string().min(3, 'El título es obligatorio'),
  objetivo:        z.string().min(10, 'El objetivo es obligatorio'),
  duracion_min:    z.number().min(10).max(300).optional(),
  formato:         z.string().optional(),
  problema_larp:   z.string().optional(),
  problema_real:   z.string().optional(),
  solucion:        z.string().optional(),
  recursos:        z.string().optional(),
})

export const rolSchema = z.object({
  nombre_rol:       z.string().min(2, 'El nombre del rol es obligatorio'),
  nombre_habilidad: z.string().optional(),
  desc_habilidad:   z.string().min(5, 'Describe la habilidad'),
  uso_juego:        z.string().optional(),
})

export const cartaSchema = z.object({
  nombre:      z.string().min(2, 'El nombre de la carta es obligatorio'),
  tipo:        z.enum(['personaje','habilidad','objeto','evento','figura_historica','otro']),
  habilidad:   z.string().optional(),
  lore:        z.string().optional(),
  descripcion: z.string().optional(),
})

export const objetivoSchema = z.object({
  tipo: z.enum([
    'Histórico','Técnico','Narrativo / diseño',
    'Colaborativo','Actitudinal','Competencial','Otro'
  ]),
  descripcion: z.string().min(10, 'Describe el objetivo'),
})

// ── Inclusion Index ────────────────────────────────────────

/** Designer evaluates exactly 5 criteria. Estado + evidence are required at submit time. */
export const criterioDesignerSchema = z.object({
  estado:    z.enum(['cumple', 'parcial', 'no_cumple']),
  evidencia: z.string().min(30, 'La evidencia debe tener al menos 30 caracteres'),
})

export type CriterioEstadoVal = 'cumple' | 'parcial' | 'no_cumple'

/**
 * 3-level inclusion index stored in edularp.inclusion_index (JSONB):
 *   designer     – 5 criteria filled by the designer before submit
 *   llm_proposal – 22 criteria proposed by the LLM after submit (fire-and-forget)
 *   final        – validated values set by admin/researcher
 *   rubric_version – version tag for reproducibility
 */
export const inclusionIndexSchema = z.object({
  designer:       z.record(z.any()).optional(),
  llm_proposal:   z.any().optional(),
  final:          z.any().optional(),
  rubric_version: z.string().default('1.0'),
}).optional()

// ── Esquema principal EduLARP ──────────────────────────────

export const edularpSchema = z.object({
  // Paso 1 — Storyboard
  nombre:            z.string().min(5,   'El nombre es obligatorio (mín. 5 caracteres)'),
  proyecto:          z.string().optional(),
  descripcion:       z.string().min(30,  'Describe la actividad (mín. 30 caracteres)'),
  storyboard:        z.string().min(100, 'El storyboard es obligatorio (mín. 100 caracteres)'),
  storyboard_alt:    z.string().optional(),
  nivel_educativo:   z.enum(['Primaria','Secundaria']),
  asignaturas:       z.string().min(2,  'Indica al menos un área'),
  duracion_min:      z.number().min(30).max(300),
  num_participantes: z.number().min(2).max(40),
  materiales:        z.string().optional(),
  tipo_version:      z.enum(['original','modificada']).default('original'),
  idioma_original:   z.enum(['es','en']).default('es'),
  status:            z.enum(['borrador','piloto','validado']).optional().default('borrador'),
  // Paso 2 — Paralelos
  paralelos: z.array(paraleloSchema).min(2, 'Añade al menos 2 paralelos'),

  // Paso 3 — Misiones
  misiones: z.array(misionSchema).min(1, 'Define al menos una misión'),

  // Paso 4 — Personajes y cartas
  roles:  z.array(rolSchema).min(1, 'Define al menos un rol'),
  cartas: z.array(cartaSchema).optional().default([]),

  // Paso 4 — Objetivos
  objetivos:    z.array(objetivoSchema).min(1, 'Define al menos un objetivo'),
  competencias: z.array(z.string()).optional().default([]),
  evaluacion:   z.string().optional(),
  notas_docente: z.string().optional(),

  // Paso 5 — Recursos e Imágenes
  recursos_globales: z.object({
    materiales_impresos:       z.string().optional(),
    kits_circuitos:            z.string().optional(),
    materiales_craft:          z.string().optional(),
    herramientas_facilitacion: z.string().optional(),
    cartas_roles:              z.string().optional(),
    descripcion_facilitador:   z.string().optional(),
    materiales_demostracion:   z.string().optional(),
  }).optional(),
  imagenes_urls: z.array(z.string()).optional().default([]),

  // Paso 6 — Inclusion Index
  inclusion_index: inclusionIndexSchema,
})

export type EduLarpForm = z.infer<typeof edularpSchema>
