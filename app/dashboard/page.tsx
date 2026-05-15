import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const rol    = (session.user as any).rol

  const [stats] = await sql`
    SELECT
      COUNT(*)::int                                        AS total,
      COUNT(*) FILTER (WHERE estado='borrador')::int       AS borradores,
      COUNT(*) FILTER (WHERE estado='revision')::int       AS en_revision,
      COUNT(*) FILTER (WHERE estado='publicado')::int      AS publicados,
      COUNT(*) FILTER (WHERE estado='rechazado')::int      AS rechazados
    FROM edularp
  `

  const latestLarps = await sql`
    SELECT id, nombre, nivel_educativo, asignaturas, estado, creado_en
    FROM edularp
    WHERE estado = 'publicado'
    ORDER BY creado_en DESC
    LIMIT 5
  `

  const notifs = await sql`
    SELECT n.*, e.nombre AS edularp_nombre
    FROM notificaciones n
    LEFT JOIN edularp e ON e.id = n.edularp_id
    WHERE n.usuario_id = ${userId} AND n.leida = false
    ORDER BY n.creado_en DESC
    LIMIT 5
  `

  return (
    <DashboardClient
      userName={session.user?.name ?? ''}
      rol={rol}
      stats={stats as any}
      misLarps={latestLarps}
      notifs={notifs}
    />
  )
}
