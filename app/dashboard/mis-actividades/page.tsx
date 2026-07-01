import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import MisActividadesClient from './MisActividadesClient'

export default async function MisActividadesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const rol    = (session.user as any).rol

  const actividades = rol === 'admin'
    ? await sql`
        SELECT e.id, e.nombre, e.estado, e.nivel_educativo, e.asignaturas,
               e.duracion_min, e.creado_en, e.actualizado_en,
               e.inclusion_index,
               u.nombre AS autor_nombre,
               (SELECT n.mensaje FROM notificaciones n
                WHERE n.edularp_id = e.id AND n.tipo IN ('rechazo','feedback','rechazado')
                ORDER BY n.creado_en DESC LIMIT 1) AS ultimo_feedback
        FROM edularp e
        LEFT JOIN usuarios u ON u.id = e.autor_id
        ORDER BY e.actualizado_en DESC NULLS LAST, e.creado_en DESC
      `
    : await sql`
        SELECT e.id, e.nombre, e.estado, e.nivel_educativo, e.asignaturas,
               e.duracion_min, e.creado_en, e.actualizado_en,
               e.inclusion_index,
               (SELECT n.mensaje FROM notificaciones n
                WHERE n.edularp_id = e.id AND n.tipo IN ('rechazo','feedback','rechazado')
                ORDER BY n.creado_en DESC LIMIT 1) AS ultimo_feedback
        FROM edularp e
        WHERE e.autor_id = ${userId}
        ORDER BY e.actualizado_en DESC NULLS LAST, e.creado_en DESC
      `

  return <MisActividadesClient actividades={actividades} isAdmin={rol === 'admin'} />
}
