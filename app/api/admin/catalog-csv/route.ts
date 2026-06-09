import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sql from '@/lib/db'

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function focoInclusivo(inclusionIndex: any): 'si' | 'no' {
  const designer = inclusionIndex?.designer
  if (!designer || typeof designer !== 'object') return 'no'
  const criteria = Object.values(designer) as any[]
  if (criteria.length < 5) return 'no'
  return criteria.every((c) => c?.estado === 'cumple') ? 'si' : 'no'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if ((session.user as any).rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const larps = await sql`
    SELECT id, nombre, nivel_educativo, asignaturas, duracion_min,
           num_participantes, inclusion_index
    FROM edularp
    WHERE estado = 'publicado'
    ORDER BY nombre
  `

  const header = ['id', 'titulo', 'nivel_educativo', 'area_stem', 'duracion_min', 'tamaño_grupo', 'foco_inclusivo'].join(',')

  const rows = larps.map((l: any) => [
    escapeCsv(l.id),
    escapeCsv(l.nombre),
    escapeCsv(l.nivel_educativo),
    escapeCsv(l.asignaturas),
    escapeCsv(l.duracion_min),
    escapeCsv(l.num_participantes),
    focoInclusivo(l.inclusion_index),
  ].join(','))

  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="techlarp-catalog-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
