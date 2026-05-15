import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

// ── Tipos ──
interface Paralelo {
  narrativa: string
  mundo_real: string
  proposito?: string | null
}
interface Mision {
  titulo: string
  objetivo: string
  formato?: string | null
  duracion_min?: number | null
  problema_larp?: string | null
  problema_real?: string | null
  solucion?: string | null
  recursos?: string | null
}
interface Rol {
  nombre_rol: string
  nombre_habilidad?: string | null
  desc_habilidad: string
  uso_juego?: string | null
}
interface Carta {
  nombre: string
  tipo: string
  habilidad?: string | null
  lore?: string | null
}
interface Objetivo {
  tipo: string
  descripcion: string
}
export interface EduLarpData {
  nombre: string
  proyecto?: string | null
  descripcion: string
  storyboard: string
  storyboard_alt?: string | null
  nivel_educativo: string
  asignaturas: string
  duracion_min: number
  num_participantes: number
  materiales?: string | null
  evaluacion?: string | null
  notas_docente?: string | null
  competencias?: string[] | null
  tipo_version?: string | null
  idioma_original?: string | null
  veces_modificada?: number | null
  autor_nombre?: string | null
  creado_en?: string | null
  paralelos: Paralelo[]
  misiones: Mision[]
  roles: Rol[]
  cartas: Carta[]
  objetivos: Objetivo[]
}

// ── Constantes ──
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2

// Colors
const PURPLE = rgb(107 / 255, 33 / 255, 168 / 255)
const DARK = rgb(31 / 255, 41 / 255, 55 / 255)
const GRAY = rgb(107 / 255, 114 / 255, 128 / 255)
const WHITE = rgb(1, 1, 1)
const LIGHT_BG = rgb(243 / 255, 244 / 255, 246 / 255)
const PURPLE_LIGHT = rgb(245 / 255, 243 / 255, 255 / 255)
const TEAL_BG = rgb(240 / 255, 253 / 255, 250 / 255)
const TEAL_TEXT = rgb(13 / 255, 148 / 255, 136 / 255)
const ORANGE_BG = rgb(255 / 255, 247 / 255, 237 / 255)
const ORANGE_TEXT = rgb(194 / 255, 65 / 255, 12 / 255)
const COVER_LAVENDER = rgb(243 / 255, 232 / 255, 255 / 255)
const FOOTER_PURPLE = rgb(221 / 255, 214 / 255, 254 / 255)

type Color = ReturnType<typeof rgb>

// ── Helper class ──
class PDFWriter {
  doc: PDFDocument
  page!: PDFPage
  y: number = 0
  bold!: PDFFont
  regular!: PDFFont
  pages: PDFPage[] = []

  constructor(doc: PDFDocument, bold: PDFFont, regular: PDFFont) {
    this.doc = doc
    this.bold = bold
    this.regular = regular
  }

  newPage(): PDFPage {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = PAGE_H - MARGIN
    return this.page
  }

  ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) this.newPage()
  }

  rect(x: number, y: number, w: number, h: number, color: Color) {
    this.page.drawRectangle({ x, y, width: w, height: h, color })
  }

  drawText(text: string, opts: {
    x?: number; font?: PDFFont; size?: number; color?: Color;
    maxWidth?: number; lineHeight?: number
  } = {}): number {
    const {
      x = MARGIN, font = this.regular, size = 10,
      color = DARK, maxWidth = CONTENT_W, lineHeight = size * 1.4,
    } = opts

    const lines = this.wrapText(text, font, size, maxWidth)
    for (const line of lines) {
      this.ensureSpace(lineHeight + 4)
      this.page.drawText(line, { x, y: this.y, size, font, color })
      this.y -= lineHeight
    }
    return lines.length * lineHeight
  }

  wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    if (!text) return []
    // Sanitize: remove characters that Helvetica can't encode
    const safe = text.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, (ch) => {
      // Map common characters to ASCII equivalents
      const map: Record<string, string> = {
        '\u2014': '--', '\u2013': '-', '\u2018': "'", '\u2019': "'",
        '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u2022': '*',
        '\u00BF': '?', '\u00A1': '!',
      }
      return map[ch] ?? ''
    })
    const paragraphs = safe.split('\n')
    const allLines: string[] = []

    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean)
      if (words.length === 0) { allLines.push(''); continue }

      let currentLine = words[0]
      for (let i = 1; i < words.length; i++) {
        const test = currentLine + ' ' + words[i]
        try {
          const w = font.widthOfTextAtSize(test, size)
          if (w <= maxWidth) {
            currentLine = test
          } else {
            allLines.push(currentLine)
            currentLine = words[i]
          }
        } catch {
          allLines.push(currentLine)
          currentLine = words[i]
        }
      }
      allLines.push(currentLine)
    }
    return allLines
  }

  sectionTitle(title: string) {
    this.ensureSpace(40)
    this.rect(MARGIN, this.y - 20, CONTENT_W, 28, PURPLE)
    this.page.drawText(title.toUpperCase(), {
      x: MARGIN + 10, y: this.y - 14, size: 12, font: this.bold, color: WHITE,
    })
    this.y -= 36
  }

  labelValue(label: string, value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') return
    this.ensureSpace(28)
    this.page.drawText(label, {
      x: MARGIN, y: this.y, size: 9, font: this.bold, color: GRAY,
    })
    this.y -= 14
    this.drawText(String(value), { size: 10 })
    this.y -= 4
  }

  drawCenteredText(text: string, opts: {
    font?: PDFFont; size?: number; color?: Color
  } = {}) {
    const { font = this.regular, size = 10, color = DARK } = opts
    const safe = text.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
    try {
      const w = font.widthOfTextAtSize(safe, size)
      const x = (PAGE_W - w) / 2
      this.ensureSpace(size * 1.5)
      this.page.drawText(safe, { x, y: this.y, size, font, color })
    } catch {
      this.page.drawText(safe, { x: MARGIN, y: this.y, size, font, color })
    }
    this.y -= size * 1.5
  }

  divider() {
    this.y -= 4
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      color: rgb(229 / 255, 231 / 255, 235 / 255),
      thickness: 0.5,
    })
    this.y -= 8
  }
}

// ── Main generator ──
export async function generateEduLarpPDF(data: EduLarpData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(data.nombre)
  doc.setAuthor(data.autor_nombre ?? 'TechLARP')
  doc.setSubject('TechLARP Activity')
  doc.setCreator('TechLARP Platform')

  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  const w = new PDFWriter(doc, bold, regular)

  // ════════════════ COVER PAGE ════════════════
  const cover = w.newPage()

  // Gradient background
  const steps = 20
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps
    const r = (107 + (255 - 107) * ratio) / 255
    const g = (33 + (255 - 33) * ratio) / 255
    const b = (168 + (255 - 168) * ratio) / 255
    const h = PAGE_H / steps
    cover.drawRectangle({
      x: 0, y: PAGE_H - (i + 1) * h, width: PAGE_W, height: h + 1,
      color: rgb(r, g, b),
    })
  }

  // Logo
  try {
    const logoPath = path.join(process.cwd(), 'public', 'TechLARP-logo-02.png')
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath)
      const logoImage = await doc.embedPng(logoBytes)
      const scale = 240 / logoImage.width
      cover.drawImage(logoImage, {
        x: (PAGE_W - 240) / 2,
        y: PAGE_H - 200,
        width: 240,
        height: logoImage.height * scale,
      })
    }
  } catch { /* logo optional */ }

  // Title
  w.y = PAGE_H - 340
  const titleLines = w.wrapText(data.nombre, bold, 28, CONTENT_W)
  for (const line of titleLines) {
    try {
      const tw = bold.widthOfTextAtSize(line, 28)
      cover.drawText(line, {
        x: (PAGE_W - tw) / 2, y: w.y, size: 28, font: bold, color: WHITE,
      })
    } catch {
      cover.drawText(line, {
        x: MARGIN, y: w.y, size: 28, font: bold, color: WHITE,
      })
    }
    w.y -= 36
  }

  // Subtitles
  w.y -= 10
  w.drawCenteredText(data.asignaturas, { size: 14, color: COVER_LAVENDER })
  w.y -= 4
  w.drawCenteredText(
    `${data.nivel_educativo}  -  ${data.duracion_min} min  -  ${data.num_participantes} participantes`,
    { size: 12, color: COVER_LAVENDER }
  )

  if (data.proyecto) {
    w.y -= 4
    w.drawCenteredText(data.proyecto, { size: 11, color: COVER_LAVENDER })
  }

  // Author / date
  const meta: string[] = []
  if (data.autor_nombre) meta.push(data.autor_nombre)
  if (data.creado_en) meta.push(new Date(data.creado_en).toLocaleDateString('es-ES'))
  if (meta.length > 0) {
    w.y = MARGIN + 40
    w.drawCenteredText(meta.join('  -  '), { size: 10, color: FOOTER_PURPLE })
  }

  // ════════════════ FICHA TECNICA ════════════════
  w.newPage()
  w.sectionTitle('Ficha tecnica')
  w.labelValue('Nombre', data.nombre)
  w.labelValue('Descripcion', data.descripcion)
  w.labelValue('Nivel educativo', data.nivel_educativo)
  w.labelValue('Asignaturas', data.asignaturas)
  w.labelValue('Duracion', `${data.duracion_min} minutos`)
  w.labelValue('Participantes', `${data.num_participantes}`)
  if (data.tipo_version) {
    const tipoLabel = data.tipo_version === 'original' ? 'Original' : 'Modificada'
    w.labelValue('Tipo de actividad', tipoLabel)
  }
  if (data.veces_modificada && data.veces_modificada > 0) {
    const veces = data.veces_modificada
    w.labelValue('Historial de cambios', veces === 1 ? `Modificada ${veces} vez` : `Modificada ${veces} veces`)
  }
  if (data.autor_nombre) w.labelValue('Autor', data.autor_nombre)
  if (data.materiales) w.labelValue('Materiales', data.materiales)
  if (data.competencias?.length) w.labelValue('Competencias', data.competencias.join(', '))

  // ════════════════ STORYBOARD ════════════════
  w.y -= 10
  w.sectionTitle('Storyboard - Narrativa fantastica')
  w.drawText(data.storyboard)
  if (data.storyboard_alt) {
    w.y -= 8
    w.drawText('Storyboard alternativo', { font: bold, size: 9, color: GRAY })
    w.y -= 4
    w.drawText(data.storyboard_alt)
  }

  // ════════════════ PARALELOS ════════════════
  if (data.paralelos.length > 0) {
    w.newPage()
    w.sectionTitle('Paralelos con la realidad')

    const colW = [CONTENT_W * 0.33, CONTENT_W * 0.33, CONTENT_W * 0.34]
    w.rect(MARGIN, w.y - 14, CONTENT_W, 20, PURPLE)
    const headers = ['Narrativa fantastica', 'Equivalente real', 'Proposito pedagogico']
    let xPos = MARGIN
    for (let i = 0; i < headers.length; i++) {
      w.page.drawText(headers[i], {
        x: xPos + 4, y: w.y - 10, size: 8, font: bold, color: WHITE,
      })
      xPos += colW[i]
    }
    w.y -= 24

    for (let idx = 0; idx < data.paralelos.length; idx++) {
      const p = data.paralelos[idx]
      w.ensureSpace(32)
      const bgColor = idx % 2 === 0 ? WHITE : LIGHT_BG
      w.rect(MARGIN, w.y - 22, CONTENT_W, 28, bgColor)
      xPos = MARGIN
      const texts = [p.narrativa || '', p.mundo_real || '', p.proposito || '']
      for (let i = 0; i < texts.length; i++) {
        const cellText = texts[i].slice(0, 50).replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
        try {
          w.page.drawText(cellText, {
            x: xPos + 4, y: w.y - 14, size: 8.5, font: regular, color: DARK,
          })
        } catch { /* skip unrenderable */ }
        xPos += colW[i]
      }
      w.y -= 30
    }
  }

  // ════════════════ MISIONES ════════════════
  if (data.misiones.length > 0) {
    w.newPage()
    w.sectionTitle('Misiones')

    for (let i = 0; i < data.misiones.length; i++) {
      const m = data.misiones[i]
      w.ensureSpace(80)

      w.rect(MARGIN, w.y - 16, CONTENT_W, 24, PURPLE_LIGHT)
      const mTitle = `Mision ${i + 1}: ${m.titulo}`.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
      try {
        w.page.drawText(mTitle, {
          x: MARGIN + 8, y: w.y - 10, size: 11, font: bold, color: PURPLE,
        })
      } catch { /* skip */ }
      w.y -= 30

      if (m.formato) w.labelValue('Formato', m.formato)
      if (m.duracion_min) w.labelValue('Duracion', `${m.duracion_min} min`)
      w.labelValue('Objetivo', m.objetivo)
      if (m.problema_larp) w.labelValue('Problema (mundo LARP)', m.problema_larp)
      if (m.problema_real) w.labelValue('Problema (mundo real)', m.problema_real)
      if (m.solucion) w.labelValue('Solucion / descripcion', m.solucion)
      if (m.recursos) w.labelValue('Recursos', m.recursos)

      w.y -= 8
      if (i < data.misiones.length - 1) w.divider()
    }
  }

  // ════════════════ ROLES ════════════════
  if (data.roles.length > 0) {
    w.newPage()
    w.sectionTitle('Roles de participantes')

    for (let i = 0; i < data.roles.length; i++) {
      const r = data.roles[i]
      w.ensureSpace(60)

      const rolName = r.nombre_rol.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
      w.rect(MARGIN, w.y - 14, CONTENT_W, 22, TEAL_BG)
      try {
        w.page.drawText(rolName, {
          x: MARGIN + 8, y: w.y - 10, size: 10, font: bold, color: TEAL_TEXT,
        })
      } catch { /* skip */ }
      w.y -= 28

      if (r.nombre_habilidad) w.labelValue('Habilidad', r.nombre_habilidad)
      w.labelValue('Descripcion', r.desc_habilidad)
      if (r.uso_juego) w.labelValue('Uso en el juego', r.uso_juego)

      w.y -= 6
      if (i < data.roles.length - 1) w.divider()
    }
  }

  // ════════════════ CARTAS ════════════════
  if (data.cartas.length > 0) {
    w.newPage()
    w.sectionTitle('Cartas del juego')

    for (let i = 0; i < data.cartas.length; i++) {
      const c = data.cartas[i]
      w.ensureSpace(50)

      const cardTitle = `${c.nombre}  (${c.tipo})`.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
      w.rect(MARGIN, w.y - 14, CONTENT_W, 22, ORANGE_BG)
      try {
        w.page.drawText(cardTitle, {
          x: MARGIN + 8, y: w.y - 10, size: 10, font: bold, color: ORANGE_TEXT,
        })
      } catch { /* skip */ }
      w.y -= 28

      if (c.habilidad) w.labelValue('Habilidad / efecto', c.habilidad)
      if (c.lore) w.labelValue('Lore', c.lore)

      w.y -= 4
      if (i < data.cartas.length - 1) w.divider()
    }
  }

  // ════════════════ OBJETIVOS ════════════════
  if (data.objetivos.length > 0) {
    w.ensureSpace(80)
    w.y -= 10
    w.sectionTitle('Objetivos de aprendizaje')

    for (const o of data.objetivos) {
      w.ensureSpace(24)
      const tag = `[${o.tipo}]  `
      try {
        w.page.drawText(tag, {
          x: MARGIN, y: w.y, size: 9, font: bold, color: PURPLE,
        })
        const tagW = bold.widthOfTextAtSize(tag, 9)
        w.drawText(o.descripcion, { x: MARGIN + tagW, size: 10, maxWidth: CONTENT_W - tagW })
      } catch {
        w.drawText(`${o.tipo}: ${o.descripcion}`, { size: 10 })
      }
      w.y -= 4
    }
  }

  // ════════════════ GUIA DOCENTE ════════════════
  if (data.evaluacion || data.notas_docente) {
    w.ensureSpace(80)
    w.y -= 10
    w.sectionTitle('Guia docente')
    if (data.evaluacion) {
      w.drawText('Criterios de evaluacion', { font: bold, size: 9, color: GRAY })
      w.y -= 4
      w.drawText(data.evaluacion)
      w.y -= 8
    }
    if (data.notas_docente) {
      w.drawText('Notas para el docente', { font: bold, size: 9, color: GRAY })
      w.y -= 4
      w.drawText(data.notas_docente)
    }
  }

  // ════════════════ PAGE FOOTERS ════════════════
  const totalPages = w.pages.length
  for (let i = 1; i < totalPages; i++) {
    const p = w.pages[i]
    const footerText = `${data.nombre} -- TechLARP - ${i}/${totalPages - 1}`
    const safe = footerText.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
    try {
      const fw = regular.widthOfTextAtSize(safe, 8)
      p.drawText(safe, {
        x: (PAGE_W - fw) / 2, y: 25, size: 8, font: regular, color: GRAY,
      })
    } catch { /* skip footer if text fails */ }
  }

  return doc.save()
}
