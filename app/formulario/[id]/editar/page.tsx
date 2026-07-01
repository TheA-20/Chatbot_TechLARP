import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import EditarFormularioClient from './EditarFormularioClient'

interface Props { params: { id: string } }

export default async function EditarPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const rol    = (session.user as any).rol

  // Solo el autor o un admin puede editar
  const [larp] = await sql`
    SELECT e.*, 
      (SELECT array_agg(row_to_json(p.*) ORDER BY p.orden) FROM paralelos_realidad p WHERE p.edularp_id = e.id) AS paralelos,
      (SELECT array_agg(row_to_json(m.*) ORDER BY m.orden) FROM misiones m WHERE m.edularp_id = e.id) AS misiones,
      (SELECT array_agg(row_to_json(r.*) ORDER BY r.orden) FROM roles_participantes r WHERE r.edularp_id = e.id) AS roles,
      (SELECT array_agg(row_to_json(c.*) ORDER BY c.orden) FROM cartas_juego c WHERE c.edularp_id = e.id) AS cartas,
      (SELECT array_agg(row_to_json(o.*)) FROM objetivos o WHERE o.edularp_id = e.id) AS objetivos
    FROM edularp e
    WHERE e.id = ${params.id}
      AND (e.autor_id = ${userId} OR ${rol} = 'admin')
      AND e.estado IN ('borrador', 'rechazado', 'modificaciones')
  `

  if (!larp) {
    // No existe, no tiene permiso, o no está en estado editable
    redirect('/dashboard/mis-actividades')
  }

  return <EditarFormularioClient larp={larp} />
}
