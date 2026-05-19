'use client'
import { useState, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { edularpSchema, type EduLarpForm } from '@/lib/schemas/edularp.schema'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import Image from 'next/image'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { bp } from '@/lib/base-path'

const AI_PROMPT_ES = `Actúa como una docente experta en educación STEM con amplia experiencia en pedagogía inclusiva y diseño de actividades de juego de rol educativo (LARP). Conoces profundamente la metodología TechLARP: una práctica pedagógica que combina narrativa fantástica inmersiva con aprendizaje curricular STEM real mediante juego de rol en vivo. Las y los estudiantes asumen personajes con habilidades especiales y resuelven misiones que conectan la ficción con ciencias, tecnología, ingeniería o matemáticas.

CONTEXTO DE LA ACTIVIDAD:
Esta actividad está dirigida principalmente a estudiantes mujeres y personas no binarias. Tu diseño debe visibilizar referentes femeninos, potenciar la agencia de las estudiantes y usar lenguaje inclusivo en toda la narrativa.

Tu tarea: generar una actividad TechLARP COMPLETA rellenando la plantilla JSON que se adjunta al final. TODOS los campos de texto deben estar completos, coherentes entre sí y listos para usar en el aula sin edición adicional.

REGLAS DE DISEÑO:
1. ROLES Y PERSONAJES
   - Los roles protagonistas deben estar orientados a mujeres y con perspectiva femenina, pero son completamente libres: pueden ser guerreras, hechiceras, exploradoras del cosmos, ingeniadoras del futuro, guardianas de conocimiento antiguo… cualquier arquetipo fantástico es válido
   - No es necesario basar los roles en figuras históricas o científicas reales; la creatividad narrativa no tiene límites siempre que los personajes sean femeninos o no binarios
   - Las cartas de tipo "figura_historica" sí deben mencionar mujeres reales destacadas en STEM cuando el tipo de carta lo justifique, pero no es obligatorio usar ese tipo de carta
   - Usa lenguaje inclusivo en nombres y descripciones (p. ej. "la Archivista", "la Forjadora de Códigos", "la Oraculista")
   - Los nombres en inglés de roles y cartas deben seguir la convención TechLARP (evocadores, fantásticos)

2. INCLUSION INDEX (campo "inclusion_index" — rellenar SIEMPRE)
   - Evalúa los 5 criterios del Gender Inclusion Index v1.0 con perspectiva de diseñadora:
     * IT-01: Imaginería masculinizada — indica si el LARP la evita (cumple/parcial/no_cumple) y evidencia concreta mín. 30 car.
     * IT-02: Barreras interseccionales (lengua, discapacidad, clase, cultura) — mismo formato
     * IM-04: Cultura maker / artesanía integrada — mismo formato
     * LARP-10: Storyboard inclusivo, chicas STEM protagonistas con agencia real — mismo formato
     * LARP-11: Mujeres científicas o profesionales STEM en roles narrativos clave — mismo formato
   - Para cada criterio usa: "estado": "cumple" | "parcial" | "no_cumple" y "evidencia": texto de mínimo 30 caracteres

3. RECURSOS Y MATERIALES
   - Adecua los materiales al área STEM de la actividad: si es programación o electrónica, incluye componentes como LEDs, cables, botones, microcontroladores o placas de prueba; si es química, incluye materiales de laboratorio básico (tubos de ensayo, indicadores de pH, vinagre, bicarbonato, etc.); si es biología o ciencias naturales, incluye lupas, muestras, fichas de clasificación
   - Los materiales no necesitan ser inmediatos ni fáciles de conseguir en el momento: el o la docente puede prepararlos con antelación; planifica recursos que valga la pena conseguir y que aporten valor práctico real a la actividad
   - Busca el equilibrio entre experiencia autentica y viabilidad escolar: evita equipos industriales o de alta precisión, pero no renuncies a materiales que hagan la experiencia STEM genuina e inmersiva
   - Indica siempre en el campo correspondiente qué materiales son fungibles, cuáles son reutilizables y cuáles pueden sustituirse con alternativas más económicas

4. COHERENCIA NARRATIVA
   - El storyboard debe ser inmersivo, motivador y apropiado para el nivel educativo indicado
   - Los paralelos realidad ↔ narrativa deben ser claros y directamente utilizables en el debriefing
   - El mundo fantástico debe reflejar diversidad de género, culturas y capacidades de forma natural

5. TIEMPO Y NÚMERO DE PARTICIPANTES
   - Distribuye el tiempo total entre misiones de forma realista (suma de duraciones ≤ duración total indicada)
   - Cada misión debe poder ejecutarse con el número de participantes indicado; especifica agrupaciones
   - Si el grupo es grande (>20), diseña misiones que funcionen en equipos paralelos

6. COMPLETITUD DEL JSON
   - NO dejes ningún campo de texto vacío ni con el valor de ejemplo de la plantilla
   - Rellena todos los arrays con al menos los elementos mínimos recomendados
   - Los valores numéricos deben ser coherentes con el contexto indicado

7. FORMATO DE RESPUESTA
   - Responde ÚNICAMENTE con el JSON válido y completo
   - Sin texto introductorio, explicaciones ni bloques de código markdown (no uses \`\`\`json)
   - El JSON debe poder guardarse directamente como archivo .json e importarse en el formulario

DESCRIPCIÓN DE MI CLASE:
[Escribe aquí: asignatura y tema, nivel educativo (Primaria/Secundaria), número de participantes, duración disponible total en minutos, y cualquier necesidad especial de inclusión, accesibilidad o contexto cultural]

PLANTILLA JSON A RELLENAR:
[Pega aquí el contenido completo del archivo techlarp-template.json que descargaste]`

const AI_PROMPT_EN = `Act as an expert STEM educator with extensive experience in inclusive pedagogy and educational live-action role-playing (LARP) design. You have deep knowledge of the TechLARP methodology: a pedagogical practice that combines immersive fantasy narrative with real STEM curriculum learning through live role-play. Students take on characters with special abilities and complete missions that connect fiction with science, technology, engineering, or mathematics.

ACTIVITY CONTEXT:
This activity is designed primarily for girls and non-binary students. Your design must highlight female role models, foster student agency, and use inclusive language throughout the narrative.

Your task: generate a COMPLETE TechLARP activity by filling in the JSON template attached at the end. ALL text fields must be complete, coherent with each other, and ready to use in the classroom without further editing.

DESIGN RULES:
1. ROLES AND CHARACTERS
   - Protagonist roles must be female-oriented and designed with a feminine perspective, but are completely free in terms of fantasy archetype: warriors, sorceresses, cosmic explorers, future engineers, guardians of ancient knowledge… any fantastical archetype is valid
   - Roles do NOT need to be based on historical or real scientific figures; narrative creativity has no limits as long as characters are female or non-binary
   - Cards of type "figura_historica" may reference real women who excelled in STEM when the card type justifies it, but this type is not mandatory
   - Use inclusive language in names and descriptions (e.g. "the Archivist", "the Code Forger", "the Oraclist")
   - English role and card names must follow the TechLARP convention (evocative, fantastical)

2. INCLUSION INDEX ("inclusion_index" field — ALWAYS fill in)
   - Evaluate the 5 Gender Inclusion Index v1.0 criteria from the designer’s perspective:
     * IT-01: Male-coded imagery — state whether the LARP avoids it (cumple/parcial/no_cumple) and concrete evidence min. 30 chars
     * IT-02: Intersectional barriers (language, disability, class, culture) — same format
     * IM-04: Maker culture / crafting integrated — same format
     * LARP-10: Inclusive storyboard, girls in STEM as protagonists with real agency — same format
     * LARP-11: Women scientists or STEM professionals in key narrative roles — same format
   - For each criterion use: "estado": "cumple" | "parcial" | "no_cumple" and "evidencia": at least 30 characters of text

3. RESOURCES AND MATERIALS
   - Tailor materials to the STEM area of the activity: if it is programming or electronics, include hands-on components such as LEDs, wires, buttons, microcontrollers, or breadboards; if it is chemistry, include basic lab materials (test tubes, pH indicators, vinegar, baking soda, etc.); if it is biology or natural sciences, include magnifying glasses, samples, or classification sheets
   - Materials do not need to be immediately at hand or easy to source on the day: the teacher can prepare them in advance; plan resources that are worth acquiring and that add genuine practical value to the activity
   - Strike a balance between authentic STEM experience and school viability: avoid industrial or high-precision equipment, but do not sacrifice materials that make the STEM experience genuine and immersive
   - Always indicate in the relevant field which materials are consumable, which are reusable, and which can be substituted with more affordable alternatives

4. NARRATIVE COHERENCE
   - The storyboard must be immersive, motivating, and appropriate for the indicated education level
   - Reality ↔ narrative parallels must be clear and directly usable in the debriefing
   - The fantasy world must naturally reflect gender, cultural, and ability diversity

5. TIME AND NUMBER OF PARTICIPANTS
   - Distribute total time across missions realistically (sum of durations ≤ total duration indicated)
   - Each mission must work with the indicated number of participants; specify groupings
   - For large groups (>20), design missions that can run in parallel teams

6. JSON COMPLETENESS
   - Do NOT leave any text field empty or with the template's placeholder value
   - Fill all arrays with at least the recommended minimum number of elements
   - Numerical values must be coherent with the indicated context

7. RESPONSE FORMAT
   - Reply ONLY with the complete, valid JSON
   - No introductory text, explanations, or markdown code blocks (do not use \`\`\`json)
   - The JSON must be saveable directly as a .json file and importable into the form

DESCRIPTION OF MY CLASS:
[Write here: subject and topic, education level (Primary/Secondary), number of participants, total available duration in minutes, and any special inclusion, accessibility, or cultural context needs]

JSON TEMPLATE TO FILL IN:
[Paste the full content of the techlarp-template.json file you downloaded here]`

export default function FormularioPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()
  const { t, locale } = useI18n()
  const PASOS = t.formSteps
  const [paso, setPaso]       = useState(0)
  const [enviado, setEnviado] = useState(false)
  const [error, setError]     = useState('')
  const [jsonStatus, setJsonStatus] = useState<'idle'|'ok'|'error'>('idle')
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [helpTab, setHelpTab] = useState<'instructions' | 'ai'>('instructions')
  const [promptCopied, setPromptCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef  = useRef<HTMLInputElement>(null)

  // ── Inclusion Index local state ──
  type CriterioEstado = 'cumple' | 'parcial' | 'no_cumple'
  type CriterioData = { estado?: CriterioEstado; evidencia?: string }
  const [inclusionIndex, setInclusionIndex] = useState<Record<string, CriterioData>>({})
  const [iiIncompletos, setIiIncompletos] = useState<string[]>([])

  // The 5 designer criteria (designer evaluates these; LLM proposes the remaining 22)
  const DESIGNER_CRITERIA = [
    { id: 'IT-01',   textIdx: 0 },
    { id: 'IT-02',   textIdx: 1 },
    { id: 'IM-04',   textIdx: 2 },
    { id: 'LARP-10', textIdx: 3 },
    { id: 'LARP-11', textIdx: 4 },
  ] as const

  function setIIEstado(id: string, estado: CriterioEstado) {
    setInclusionIndex(prev => ({ ...prev, [id]: { ...prev[id], estado } }))
    setIiIncompletos(prev => prev.filter(i => i !== id))
  }
  function setIIEvidencia(id: string, evidencia: string) {
    setInclusionIndex(prev => ({ ...prev, [id]: { ...prev[id], evidencia } }))
  }

  // Criteria that are missing estado OR have < 30 chars evidence (used by stepper + submit)
  const iiMissingRequired = DESIGNER_CRITERIA.map(c => c.id).filter(id =>
    !inclusionIndex[id]?.estado ||
    !inclusionIndex[id]?.evidencia ||
    (inclusionIndex[id].evidencia?.length ?? 0) < 30
  )

  const { register, control, handleSubmit, getValues, setValue, watch, trigger, reset,
    formState: { errors } } = useForm<EduLarpForm>({
    resolver: zodResolver(edularpSchema),
    defaultValues: {
      paralelos: [{ narrativa:'', mundo_real:'', proposito:'' }, { narrativa:'', mundo_real:'', proposito:'' }],
      misiones:  [{ titulo:'', objetivo:'', formato:'' }],
      roles:     [{ nombre_rol:'', nombre_habilidad:'', desc_habilidad:'' }],
      cartas:    [{ nombre:'', tipo:'personaje', habilidad:'', lore:'', descripcion:'' }],
      objetivos: [{ tipo:'Histórico', descripcion:'' }],
      competencias: [],
      recursos_globales: {
        materiales_impresos: '', kits_circuitos: '', materiales_craft: '',
        herramientas_facilitacion: '', cartas_roles: '',
        descripcion_facilitador: '', materiales_demostracion: '',
      },
      imagenes_urls: [],
      tipo_version: 'original',
      status: 'borrador',
    },
  })

  const paralelos = useFieldArray({ control, name: 'paralelos' })
  const misiones  = useFieldArray({ control, name: 'misiones' })
  const roles     = useFieldArray({ control, name: 'roles' })
  const cartas    = useFieldArray({ control, name: 'cartas' })
  const objetivos = useFieldArray({ control, name: 'objetivos' })

  // Campos a validar por paso
  const camposPorPaso: (keyof EduLarpForm)[][] = [
    ['nombre','descripcion','storyboard','nivel_educativo','asignaturas','duracion_min','num_participantes'],
    ['paralelos'],
    ['misiones'],
    ['roles'],
    ['objetivos'],
    [],
    [], // Inclusion Index — validación al submit
    [], // Revisión
  ]

  async function siguiente() {
    const campos = camposPorPaso[paso]
    if (campos.length > 0) {
      const ok = await trigger(campos as (keyof EduLarpForm)[])
      if (!ok) return
    }
    setPaso(p => Math.min(p + 1, 7))
  }

  function onFormError(errs: Record<string, unknown>) {
    const primerPasoConError = camposPorPaso.findIndex(campos =>
      campos.some(campo => (errs as any)[campo])
    )
    if (primerPasoConError >= 0) setPaso(primerPasoConError)
    setError('Hay campos obligatorios sin completar. Revisa los pasos anteriores.')
  }

  function handleJsonUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target?.result as string)
        if (typeof raw !== 'object' || raw === null) throw new Error()
        reset({
          paralelos:    [{ narrativa:'', mundo_real:'', proposito:'' }, { narrativa:'', mundo_real:'', proposito:'' }],
          misiones:     [{ titulo:'', objetivo:'', formato:'' }],
          roles:        [{ nombre_rol:'', nombre_habilidad:'', desc_habilidad:'' }],
          cartas:       [],
          objetivos:    [{ tipo:'Histórico', descripcion:'' }],
          competencias: [],
          recursos_globales: {},
          imagenes_urls: [],
          tipo_version: 'original',
          status: 'borrador',
          ...raw,
        })
        if (raw.inclusion_index && typeof raw.inclusion_index === 'object') {
          // Sanitize: keep only the 5 valid criterion IDs, strip _nota/_criterio/etc.
          const VALID_IDS = ['IT-01','IT-02','IM-04','LARP-10','LARP-11']
          const sanitized: Record<string, CriterioData> = {}
          for (const id of VALID_IDS) {
            const val = (raw.inclusion_index as any)[id]
            if (val && typeof val === 'object') {
              sanitized[id] = {
                estado:   val.estado   ?? undefined,
                evidencia: val.evidencia ?? '',
              }
            }
          }
          setInclusionIndex(sanitized)
        } else {
          setInclusionIndex({})
        }
        setJsonStatus('ok')
        setPaso(0)
      } catch {
        setJsonStatus('error')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${bp}/api/upload`, { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); setUploadError(d.error ?? t.imageUploadError); return }
      const { url } = await res.json()
      const current = getValues('imagenes_urls') ?? []
      setValue('imagenes_urls', [...current, url])
    } catch { setUploadError(t.imageUploadError) }
    finally { setUploading(false); e.target.value = '' }
  }

  // Maps a field name returned by the API to the wizard step index
  const CAMPO_A_PASO: Record<string, number> = {
    nombre: 0, descripcion: 0, storyboard: 0, nivel_educativo: 0,
    asignaturas: 0, duracion_min: 0, num_participantes: 0,
    paralelos: 1,
    misiones: 2,
    roles: 3, cartas: 3,
    objetivos: 4, competencias: 4, evaluacion: 4, notas_docente: 4,
    recursos_globales: 5, imagenes_urls: 5,
    inclusion_index: 6,
  }

  async function onSubmit(data: EduLarpForm) {
    setError('')
    // Validate 5 designer criteria before sending
    const missing = DESIGNER_CRITERIA.map(c => c.id).filter(id =>
      !inclusionIndex[id]?.estado ||
      !inclusionIndex[id]?.evidencia ||
      (inclusionIndex[id].evidencia?.length ?? 0) < 30
    )
    if (missing.length > 0) {
      setIiIncompletos(missing)
      setPaso(6)
      return
    }
    setIiIncompletos([])
    try {
      // tipo_version is always 'original' on first submission regardless of language.
      // 'modificada' is set server-side by the PATCH endpoint when editing a published activity.
      // idioma_original captures the language the docente used when creating the activity.
      // status is always 'borrador' on first submission.
      const payload = {
        ...data,
        tipo_version: 'original',
        idioma_original: locale,
        status: 'borrador',
        inclusion_index: { designer: inclusionIndex, rubric_version: '1.0' },
      }
      const res = await fetch(`${bp}/api/edularp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        // If the server returns field-level validation errors, navigate to the right step
        if (res.status === 422 && d.detalles?.fieldErrors) {
          const failedFields = Object.keys(d.detalles.fieldErrors)
          const targetPaso = failedFields.reduce<number | null>((found, field) => {
            if (found !== null) return found
            return CAMPO_A_PASO[field] ?? null
          }, null)
          if (targetPaso !== null) setPaso(targetPaso)
          const fieldMsgs = failedFields
            .flatMap((f: string) => (d.detalles.fieldErrors[f] as string[]).map((m: string) => `· ${f}: ${m}`))
            .join('\n')
          setError(`Datos incompletos:\n${fieldMsgs}`)
        } else {
          setError(d.error ?? 'Error al enviar')
        }
        return
      }
      setEnviado(true)
    } catch { setError(t.networkError) }
  }

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-gray-400">{t.loading}</p></div>
  if (status === 'unauthenticated') { router.push('/login'); return null }

  if (enviado) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-medium mb-2">{t.formSuccess}</h2>
        <p className="text-sm text-gray-500 mb-5">{t.formSuccessDesc}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setEnviado(false); setPaso(0) }} className="btn-secondary text-xs">{t.uploadAnother}</button>
          <Link href="/dashboard" className="btn-primary text-xs">{t.goToPanel}</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-50 overflow-visible">
        <div className="grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <Image src="/TechLARP_Symbol.png" alt="" width={28} height={28} className="h-7 w-7" />
            <h1 className="text-sm font-medium">{t.formTitle}</h1>
          </div>
          <div className="flex justify-center pointer-events-none">
            <Image src="/TechLARP-logo-02.png" alt="TechLARP" width={900} height={225} className="h-48 w-auto -my-[4.5rem]" priority />
          </div>
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        {/* JSON Import */}
        <div className="mb-6 border border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800">{t.jsonImport}</p>
                  <button
                    type="button"
                    onClick={() => { setShowHelp(true); setHelpTab('instructions') }}
                    title={t.helpBtn}
                    className="w-5 h-5 rounded-full bg-purple-200 hover:bg-purple-300 text-purple-700 text-xs font-bold flex items-center justify-center transition-colors flex-shrink-0"
                  >?</button>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{t.jsonImportDesc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="/techlarp-template.json"
                download="techlarp-template.json"
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t.jsonDownloadTemplate}
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs"
              >
                {t.jsonImportBtn}
              </button>
            </div>
          </div>
          {jsonStatus === 'ok' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="flex-1">{t.jsonImportSuccess}</span>
              <button type="button" onClick={() => setJsonStatus('idle')} className="text-green-600 hover:text-green-800">✕</button>
            </div>
          )}
          {jsonStatus === 'error' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="flex-1">{t.jsonImportError}</span>
              <button type="button" onClick={() => setJsonStatus('idle')} className="text-red-600 hover:text-red-800">✕</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleJsonUpload}
          />
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {PASOS.map((nombre, i) => {
            const isInclusionStep = i === 6
            const hasWarning = isInclusionStep && iiMissingRequired.length > 0 && i <= paso
            return (
              <div key={i} className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setPaso(i)}>
                <div className="relative flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                    ${i < paso
                      ? isInclusionStep && iiMissingRequired.length > 0 ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'
                      : i === paso
                        ? isInclusionStep ? 'bg-indigo-600 text-white' : 'bg-primary text-white'
                        : 'bg-gray-200 text-gray-400'}`}>
                    {i < paso ? (isInclusionStep && iiMissingRequired.length > 0 ? '!' : '✓') : i + 1}
                  </div>
                  {hasWarning && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full border border-white" />
                  )}
                </div>
                <span className={`text-xs hidden sm:block ${i === paso ? (isInclusionStep ? 'text-indigo-700 font-medium' : 'text-gray-900 font-medium') : 'text-gray-400'} hover:text-primary`}>{nombre}</span>
                {i < PASOS.length - 1 && <div className={`flex-1 h-px ${i < paso ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit, onFormError)}>
          {/* ── PASO 0: STORYBOARD ── */}
          {paso === 0 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-medium">{t.generalInfo}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t.larpName}</label>
                  <input className={`input ${errors.nombre ? 'input-error' : ''}`} {...register('nombre')} placeholder={t.larpNamePlaceholder} />
                  {errors.nombre && <p className="error-msg">{errors.nombre.message}</p>}
                </div>
                <div>
                  <label className="label">{t.project}</label>
                  <input className="input" {...register('proyecto')} placeholder={t.projectPlaceholder} />
                </div>
              </div>
              <div>
                <label className="label">{t.briefDescription}</label>
                <textarea className={`input h-20 resize-none ${errors.descripcion ? 'input-error' : ''}`} {...register('descripcion')} placeholder={t.briefDescriptionPlaceholder} />
                {errors.descripcion && <p className="error-msg">{errors.descripcion.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">{t.educationLevel}</label>
                  <select className={`input ${errors.nivel_educativo ? 'input-error' : ''}`} {...register('nivel_educativo')}>
                    <option value="">{t.selectOption}</option>
                    {t.levelOptions.map(n =>
                      <option key={n}>{n}</option>
                    )}
                  </select>
                  {errors.nivel_educativo && <p className="error-msg">{errors.nivel_educativo.message}</p>}
                </div>
                <div>
                  <label className="label">{t.duration}</label>
                  <input className={`input ${errors.duracion_min ? 'input-error' : ''}`} type="number" min={30} max={300} {...register('duracion_min', { valueAsNumber: true })} placeholder="120" />
                  <p className="hint">{t.durationMax}</p>
                  {errors.duracion_min && <p className="error-msg">{errors.duracion_min.message}</p>}
                </div>

              </div>
              <div>
                <label className="label">{t.participants}</label>
                <input className={`input ${errors.num_participantes ? 'input-error' : ''}`} type="number" min={2} max={40} {...register('num_participantes', { valueAsNumber: true })} placeholder="25" />
                <p className="hint">{t.participantsMax}</p>
                {errors.num_participantes && <p className="error-msg">{errors.num_participantes.message}</p>}
              </div>
              <div>
                <label className="label">{t.subjects}</label>
                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-lg ${errors.asignaturas ? 'border-red-300' : 'border-gray-200'}`}>
                  {t.stemOptions.map((stem) => {
                    const current = watch('asignaturas') || ''
                    const selected = current.split(',').map(s => s.trim()).filter(Boolean)
                    const isChecked = selected.includes(stem)
                    return (
                      <label key={stem} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1">
                        <input type="checkbox" className="accent-primary w-4 h-4" checked={isChecked}
                          onChange={(e) => {
                            const cur = watch('asignaturas') || ''
                            let arr = cur.split(',').map(s => s.trim()).filter(Boolean)
                            if (e.target.checked) { arr.push(stem) }
                            else { arr = arr.filter(a => a !== stem) }
                            setValue('asignaturas', arr.join(', '), { shouldValidate: true })
                          }}
                        />
                        <span>{stem}</span>
                      </label>
                    )
                  })}
                </div>
                {errors.asignaturas && <p className="error-msg">{errors.asignaturas.message}</p>}
              </div>
              <div>
                <label className="label">{t.storyboard}</label>
                <textarea className={`input h-36 resize-none ${errors.storyboard ? 'input-error' : ''}`} {...register('storyboard')} placeholder={t.storyboardPlaceholder} />
                {errors.storyboard && <p className="error-msg">{errors.storyboard.message}</p>}
              </div>
              <div>
                <label className="label">{t.storyboardAlt}</label>
                <textarea className="input h-20 resize-none" {...register('storyboard_alt')} placeholder={t.storyboardAltPlaceholder} />
              </div>
            </div>
          )}

          {/* ── PASO 1: PARALELOS ── */}
          {paso === 1 && (
            <div className="card space-y-4">
              <div>
                <h2 className="text-sm font-medium">{t.parallels}</h2>
                <p className="text-xs text-gray-400 mt-1">{t.parallelsDesc}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-400">
                <span>{t.narrativeColumn}</span><span>{t.realEquivalent}</span><span>{t.pedagogicPurpose}</span>
              </div>
              {paralelos.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-3 gap-2">
                  <input className="input text-xs" {...register(`paralelos.${i}.narrativa`)} placeholder={t.narrativePlaceholder} />
                  <input className="input text-xs" {...register(`paralelos.${i}.mundo_real`)} placeholder={t.realEquivalentPlaceholder} />
                  <div className="flex gap-2">
                    <input className="input text-xs flex-1" {...register(`paralelos.${i}.proposito`)} placeholder={t.purposePlaceholder} />
                    {i >= 2 && <button type="button" onClick={() => paralelos.remove(i)} className="text-red-400 hover:text-red-600 text-xs px-2">✕</button>}
                  </div>
                </div>
              ))}
              {errors.paralelos && <p className="error-msg">{(errors.paralelos as any).message ?? t.minParallels}</p>}
              <button type="button" onClick={() => paralelos.append({ narrativa:'', mundo_real:'', proposito:'' })}
                className="text-xs text-primary hover:underline">{t.addParallel}</button>
            </div>
          )}

          {/* ── PASO 2: MISIONES ── */}
          {paso === 2 && (
            <div className="card space-y-5">
              <h2 className="text-sm font-medium">{t.missions}</h2>
              {misiones.fields.map((f, i) => (
                <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500">{t.missionN} {i + 1}</span>
                    {i > 0 && <button type="button" onClick={() => misiones.remove(i)} className="text-xs text-red-400">{t.delete}</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="label">{t.missionTitle}</label>
                      <input className="input" {...register(`misiones.${i}.titulo`)} placeholder={t.missionTitlePlaceholder} />
                    </div>
                    <div>
                      <label className="label">{t.format}</label>
                      <select className="input" {...register(`misiones.${i}.formato`)}>
                        <option value="">{t.selectOption}</option>
                        {t.formatOptions.map(f =>
                          <option key={f}>{f}</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">{t.objective}</label>
                    <textarea className="input h-16 resize-none" {...register(`misiones.${i}.objetivo`)} placeholder={t.objectivePlaceholder} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t.problemLarp}</label>
                      <textarea className="input h-20 resize-none text-xs" {...register(`misiones.${i}.problema_larp`)} placeholder={t.problemLarpPlaceholder} />
                    </div>
                    <div>
                      <label className="label">{t.problemReal}</label>
                      <textarea className="input h-20 resize-none text-xs" {...register(`misiones.${i}.problema_real`)} placeholder={t.problemRealPlaceholder} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t.solution}</label>
                    <textarea className="input h-20 resize-none text-xs" {...register(`misiones.${i}.solucion`)} placeholder={t.solutionPlaceholder} />
                  </div>
                  <div>
                    <label className="label">{t.resources}</label>
                    <textarea className="input h-14 resize-none text-xs" {...register(`misiones.${i}.recursos`)} placeholder={t.resourcesPlaceholder} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t.missionDuration}</label>
                      <input className="input" type="number" min={10} max={300} {...register(`misiones.${i}.duracion_min`, { valueAsNumber: true })} placeholder="30" />
                    </div>
                  </div>
                </div>
              ))}
              {errors.misiones && <p className="error-msg">{t.minMissions}</p>}
              <button type="button" onClick={() => misiones.append({ titulo:'', objetivo:'', formato:'' })}
                className="text-xs text-primary hover:underline">{t.addMission}</button>
            </div>
          )}

          {/* ── PASO 3: PERSONAJES Y CARTAS ── */}
          {paso === 3 && (
            <div className="card space-y-5">
              <h2 className="text-sm font-medium">{t.roles}</h2>
              {roles.fields.map((f, i) => (
                <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium text-gray-500">{t.roleN} {i + 1}</span>
                    {i > 0 && <button type="button" onClick={() => roles.remove(i)} className="text-xs text-red-400">{t.delete}</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t.roleName}</label>
                      <input className="input" {...register(`roles.${i}.nombre_rol`)} placeholder={t.roleNamePlaceholder} />
                    </div>
                    <div>
                      <label className="label">{t.abilityName}</label>
                      <input className="input" {...register(`roles.${i}.nombre_habilidad`)} placeholder={t.abilityNamePlaceholder} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t.abilityDesc}</label>
                    <textarea className="input h-16 resize-none" {...register(`roles.${i}.desc_habilidad`)} placeholder={t.abilityDescPlaceholder} />
                  </div>
                  <div>
                    <label className="label">{t.abilityUsage}</label>
                    <textarea className="input h-14 resize-none" {...register(`roles.${i}.uso_juego`)} placeholder={t.abilityUsagePlaceholder} />
                  </div>
                </div>
              ))}
              {errors.roles && <p className="error-msg">{t.minRoles}</p>}
              <button type="button" onClick={() => roles.append({ nombre_rol:'', nombre_habilidad:'', desc_habilidad:'' })}
                className="text-xs text-primary hover:underline mb-4">{t.addRole}</button>

              <h2 className="text-sm font-medium pt-2 border-t border-gray-100">{t.gameCards}</h2>
              {cartas.fields.map((f, i) => (
                <div key={f.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-medium text-gray-500">{t.cardN} {i + 1}</span>
                    {i > 0 && <button type="button" onClick={() => cartas.remove(i)} className="text-xs text-red-400">{t.delete}</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">{t.cardName}</label>
                      <input className="input" {...register(`cartas.${i}.nombre`)} placeholder={t.cardNamePlaceholder} />
                    </div>
                    <div>
                      <label className="label">{t.cardType}</label>
                      <select className="input" {...register(`cartas.${i}.tipo`)}>
                        {t.cardTypeOptions.map(ct => <option key={ct}>{ct}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t.cardAbility}</label>
                      <input className="input" {...register(`cartas.${i}.habilidad`)} placeholder={t.cardAbilityPlaceholder} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t.cardLore}</label>
                    <textarea className="input h-20 resize-none text-xs" {...register(`cartas.${i}.lore`)} placeholder={t.cardLorePlaceholder} />
                  </div>
                  <div>
                    <label className="label">{t.cardDescription}</label>
                    <textarea className="input h-16 resize-none text-xs" {...register(`cartas.${i}.descripcion`)} placeholder={t.cardDescPlaceholder} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => cartas.append({ nombre:'', tipo:'personaje', habilidad:'', lore:'' })}
                className="text-xs text-primary hover:underline">{t.addCard}</button>
            </div>
          )}

          {/* ── PASO 4: OBJETIVOS ── */}
          {paso === 4 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-medium">{t.learningObjectives}</h2>
              {objetivos.fields.map((f, i) => (
                <div key={f.id} className="flex gap-3 items-start">
                  <select className="input w-44 flex-shrink-0" {...register(`objetivos.${i}.tipo`)}>
                    {t.objectiveTypes.map(ot =>
                      <option key={ot}>{ot}</option>
                    )}
                  </select>
                  <textarea className="input flex-1 h-16 resize-none" {...register(`objetivos.${i}.descripcion`)} placeholder={t.objectiveDescPlaceholder} />
                  {i > 0 && <button type="button" onClick={() => objetivos.remove(i)} className="text-red-400 hover:text-red-600 mt-2 text-xs">✕</button>}
                </div>
              ))}
              {errors.objetivos && <p className="error-msg">{t.minObjectives}</p>}
              <button type="button" onClick={() => objetivos.append({ tipo: t.objectiveTypes[0] as any, descripcion:'' })}
                className="text-xs text-primary hover:underline">{t.addObjective}</button>
              <div className="pt-2 border-t border-gray-100">
                <label className="label">{t.evaluationCriteria}</label>
                <textarea className="input h-20 resize-none" {...register('evaluacion')} placeholder={t.evaluationPlaceholder} />
              </div>
              <div>
                <label className="label">{t.teacherNotes}</label>
                <textarea className="input h-20 resize-none" {...register('notas_docente')} placeholder={t.teacherNotesPlaceholder} />
              </div>
            </div>
          )}

          {/* ── PASO 5: RECURSOS E IMÁGENES ── */}
          {paso === 5 && (
            <div className="card space-y-6">
              <div>
                <h2 className="text-sm font-medium">{t.resourcesSection}</h2>
                <p className="text-xs text-gray-400 mt-1">{t.resourcesSectionDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">{t.recPrintedMaterials}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.materiales_impresos')} placeholder={t.recPrintedPlaceholder} />
                </div>
                <div>
                  <label className="label">{t.recCircuitKits}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.kits_circuitos')} placeholder={t.recCircuitPlaceholder} />
                </div>
                <div>
                  <label className="label">{t.recCraftMaterials}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.materiales_craft')} placeholder={t.recCraftPlaceholder} />
                </div>
                <div>
                  <label className="label">{t.recFacilitationTools}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.herramientas_facilitacion')} placeholder={t.recFacilitationPlaceholder} />
                </div>
                <div>
                  <label className="label">{t.recRoleCards}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.cartas_roles')} placeholder={t.recRoleCardsPlaceholder} />
                </div>
                <div>
                  <label className="label">{t.recFacilitatorDesc}</label>
                  <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.descripcion_facilitador')} placeholder={t.recFacilitatorPlaceholder} />
                </div>
              </div>
              <div>
                <label className="label">{t.recDemoMaterials}</label>
                <textarea className="input h-20 resize-none text-xs" {...register('recursos_globales.materiales_demostracion')} placeholder={t.recDemoPlaceholder} />
              </div>

              {/* Imágenes */}
              <div className="border-t border-gray-100 pt-4">
                <h2 className="text-sm font-medium">{t.imagesSection}</h2>
                <p className="text-xs text-gray-400 mt-1 mb-3">{t.imagesSectionDesc}</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  {(watch('imagenes_urls') ?? []).map((url, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          const curr = getValues('imagenes_urls') ?? []
                          setValue('imagenes_urls', curr.filter((_, idx) => idx !== i))
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => imgInputRef.current?.click()}
                    disabled={uploading}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="text-xs">{t.uploadingImage}</span>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs">{t.uploadImage}</span>
                      </>
                    )}
                  </button>
                </div>
                {uploadError && <p className="error-msg">{uploadError}</p>}
                <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
              </div>
            </div>
          )}

          {/* ── PASO 6: INCLUSION INDEX ── */}
          {paso === 6 && (
            <div className="space-y-5">
              {/* Header + Transparency panel */}
              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{t.iiStepTitle}</h2>
                    <p className="text-xs text-gray-500">{t.iiStepSubtitle}</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-800 leading-relaxed">
                  ℹ️ {t.iiTransparencyPanel}
                </div>
                {iiIncompletos.length > 0 && (
                  <div className="bg-red-50 rounded-lg px-4 py-3 text-xs text-red-700 leading-relaxed">
                    ⚠️ {t.iiValidationError}
                    <span className="ml-1 font-mono text-[10px]">({iiIncompletos.join(', ')})</span>
                  </div>
                )}
              </div>

              {/* Status selector */}
              <div className="card space-y-2">
                <label className="label">{t.iiStatusLabel}</label>
                <select className="input" {...register('status')}>
                  {(t.iiStatusOptions as string[]).map((val, i) => (
                    <option key={val} value={val}>{(t.iiStatusLabels as string[])[i]}</option>
                  ))}
                </select>
              </div>

              {/* 5 designer criteria */}
              {DESIGNER_CRITERIA.map((criterion) => {
                const estado   = inclusionIndex[criterion.id]?.estado
                const evidencia = inclusionIndex[criterion.id]?.evidencia ?? ''
                const isIncompleto = iiIncompletos.includes(criterion.id)
                const placeholder = estado === 'cumple' ? t.iiPlaceholderCumple
                  : estado === 'parcial' ? t.iiPlaceholderParcial
                  : t.iiPlaceholderNoCumple
                return (
                  <div key={criterion.id}
                    className={`card space-y-3 ${isIncompleto ? 'ring-2 ring-red-300' : ''}`}>
                    {/* Criterion header */}
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {criterion.id}
                      </span>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {(t.iiDesignerCriteriaTexts as string[])[criterion.textIdx]}
                      </p>
                    </div>
                    {/* Estado buttons */}
                    <div className="flex gap-2">
                      {(['cumple','parcial','no_cumple'] as const).map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setIIEstado(criterion.id, e)}
                          className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                            estado === e
                              ? e === 'cumple'    ? 'bg-green-500 border-green-500 text-white'
                              : e === 'parcial'   ? 'bg-amber-400 border-amber-400 text-white'
                              :                     'bg-red-500 border-red-500 text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {e === 'cumple' ? t.iiCumpleLabel : e === 'parcial' ? t.iiParcialLabel : t.iiNoCumpleLabel}
                        </button>
                      ))}
                    </div>
                    {/* Evidence textarea */}
                    {estado && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label mb-0">{t.iiEvidenciaLabel}</label>
                          <span className={`text-[10px] ${evidencia.length >= 30 ? 'text-green-600' : 'text-amber-500'}`}>
                            {evidencia.length} {t.iiCharCount} ({t.iiCharMin})
                          </span>
                        </div>
                        <textarea
                          value={evidencia}
                          onChange={e => setIIEvidencia(criterion.id, e.target.value)}
                          className="input h-20 resize-none text-xs"
                          placeholder={placeholder}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PASO 7: REVISIÓN ── */}
          {paso === 7 && (
            <div className="card space-y-4">
              <h2 className="text-sm font-medium">{t.finalReview}</h2>
              {(() => {
                const v = getValues()
                return (
                  <div className="space-y-4 text-sm">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium mb-1">{v.nombre || '—'}</p>
                      <p className="text-xs text-gray-500">{v.descripcion?.slice(0, 120)}{(v.descripcion?.length ?? 0) > 120 ? '…' : ''}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[v.nivel_educativo, v.asignaturas, `${v.duracion_min} min`, `${v.num_participantes} ${t.participantsLabel}`]
                          .filter(Boolean).map((tag, i) => (
                          <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">{t.reviewParallels} ({v.paralelos?.filter(p => p.narrativa).length})</p>
                      <div className="flex flex-wrap gap-2">{v.paralelos?.filter(p => p.narrativa).map((p, i) => (
                        <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{p.narrativa}</span>
                      ))}</div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">{t.reviewMissions} ({v.misiones?.filter(m => m.titulo).length})</p>
                      {v.misiones?.filter(m => m.titulo).map((m, i) => (
                        <p key={i} className="text-xs text-gray-600">· {m.titulo}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">{t.reviewRoles} ({v.roles?.filter(r => r.nombre_rol).length})</p>
                      <div className="flex flex-wrap gap-2">{v.roles?.filter(r => r.nombre_rol).map((r, i) => (
                        <span key={i} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{r.nombre_rol}</span>
                      ))}</div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 mb-2">{t.reviewObjectives} ({v.objetivos?.filter(o => o.descripcion).length})</p>
                      {v.objetivos?.filter(o => o.descripcion).map((o, i) => (
                        <p key={i} className="text-xs text-gray-600">· [{o.tipo}] {o.descripcion.slice(0, 80)}…</p>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {/* Inclusion Index summary */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t.iiSummaryTitle}</p>
                  <button type="button" onClick={() => setPaso(6)} className="text-xs text-indigo-600 hover:underline">{t.iiEditStep}</button>
                </div>
                <div className="space-y-2">
                  {DESIGNER_CRITERIA.map(c => {
                    const d = inclusionIndex[c.id]
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-500 w-16 flex-shrink-0">{c.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          d?.estado === 'cumple'    ? 'bg-green-50 text-green-700'
                          : d?.estado === 'parcial'   ? 'bg-amber-50 text-amber-700'
                          : d?.estado === 'no_cumple' ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-400'
                        }`}>
                          {d?.estado === 'cumple'    ? t.iiCumpleLabel
                            : d?.estado === 'parcial'   ? t.iiParcialLabel
                            : d?.estado === 'no_cumple' ? t.iiNoCumpleLabel
                            : t.iiNotEvaluated}
                        </span>
                        <p className="text-xs text-gray-500 flex-1 truncate">
                          {(t.iiDesignerCriteriaTexts as string[])[c.textIdx]}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {iiMissingRequired.length > 0 && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                    ⚠️ <strong>{iiMissingRequired.length}</strong> {t.iiWarning}
                  </div>
                )}
              </div>
              <div className="bg-amber-50 rounded-lg p-3 flex gap-2 text-xs text-amber-700">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {t.reviewInfo.split('**').map((s, i) => i % 2 === 1 ? <strong key={i} className="font-medium mx-1">{s}</strong> : s)}
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Error al enviar
                  </p>
                  {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Navegación */}
          {error && paso !== 7 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
              <p className="font-semibold">⚠ Error al enviar — revisa este paso</p>
              {error.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
          <div className="flex justify-between mt-4">
            <button type="button" onClick={() => setPaso(p => Math.max(0, p - 1))}
              disabled={paso === 0} className="btn-secondary disabled:opacity-40">{t.previous}</button>
            {paso < 7
              ? <button type="button" onClick={siguiente} className="btn-primary">{t.next}</button>
              : <button type="submit" className="btn-success">{t.submitReview}</button>
            }
          </div>
        </form>
      </main>

      {/* ── Help Modal ── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-900">{t.helpModalTitle}</h2>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setHelpTab('instructions')}
                className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${helpTab === 'instructions' ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t.helpTabInstructions}
              </button>
              <button
                type="button"
                onClick={() => setHelpTab('ai')}
                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${helpTab === 'ai' ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                ✨ {t.helpTabAi}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* Instructions tab */}
              {helpTab === 'instructions' && (
                <div className="space-y-5">
                  {([
                    { num: '1', title: t.helpStep1Title, desc: t.helpStep1Desc, color: 'bg-blue-100 text-blue-700' },
                    { num: '2', title: t.helpStep2Title, desc: t.helpStep2Desc, color: 'bg-amber-100 text-amber-700' },
                    { num: '3', title: t.helpStep3Title, desc: t.helpStep3Desc, color: 'bg-purple-100 text-purple-700' },
                    { num: '4', title: t.helpStep4Title, desc: t.helpStep4Desc, color: 'bg-green-100 text-green-700' },
                  ] as const).map(step => (
                    <div key={step.num} className="flex gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${step.color}`}>
                        {step.num}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{step.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100">
                    <a
                      href="/techlarp-template.json"
                      download="techlarp-template.json"
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t.jsonDownloadTemplate}
                    </a>
                    <p className="text-xs text-gray-400 mt-2">{t.jsonImportDesc}</p>
                  </div>
                </div>
              )}

              {/* Create with AI tab */}
              {helpTab === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t.helpAiTitle}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.helpAiDesc}</p>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-blue-800">{t.helpAiHowTitle}</p>
                    {t.helpAiHow.map((step, i) => (
                      <div key={i} className="flex gap-2.5 text-xs text-blue-700">
                        <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <textarea
                      readOnly
                      value={locale === 'en' ? AI_PROMPT_EN : AI_PROMPT_ES}
                      className="w-full h-52 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-3 resize-none text-gray-700 focus:outline-none leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(locale === 'en' ? AI_PROMPT_EN : AI_PROMPT_ES)
                        setPromptCopied(true)
                        setTimeout(() => setPromptCopied(false), 2500)
                      }}
                      className={`mt-2 w-full text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                        promptCopied
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-primary hover:bg-primary/90 text-white'
                      }`}
                    >
                      {promptCopied ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t.helpAiCopied}
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t.helpAiCopyBtn}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
