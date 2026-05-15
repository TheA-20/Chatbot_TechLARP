import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import AdminRevisionClient from './client'

export default async function AdminRevisionPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).rol !== 'admin') redirect('/dashboard')

  const [pendientes, docentes, stats] = await Promise.all([
    sql`
      SELECT e.id, e.nombre, e.descripcion, e.nivel_educativo, e.asignaturas,
             e.duracion_min, e.num_participantes, e.estado, e.creado_en,
             u.nombre AS autor_nombre, u.email AS autor_email,
             (SELECT COUNT(*) FROM roles_participantes r WHERE r.edularp_id = e.id)::int AS num_roles
      FROM edularp e
      LEFT JOIN usuarios u ON u.id = e.autor_id
      WHERE e.estado IN ('revision','rechazado','pending_review','lm_analyzed','under_review')
      ORDER BY e.creado_en ASC
    `,
    sql`
      SELECT id, nombre, email, estado, creado_en, ultimo_acceso,
             (SELECT COUNT(*) FROM edularp WHERE autor_id = usuarios.id)::int AS num_larps
      FROM usuarios WHERE rol = 'docente' ORDER BY creado_en DESC
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE estado IN ('revision','pending_review','lm_analyzed','under_review')) AS pendientes,
        COUNT(*) FILTER (WHERE estado='publicado') AS publicados,
        COUNT(*) FILTER (WHERE estado='rechazado') AS rechazados,
        (SELECT COUNT(*) FROM usuarios WHERE rol='docente') AS docentes
      FROM edularp
    `,
  ])

  return <AdminRevisionClient
    pendientes={pendientes}
    docentes={docentes}
    stats={stats[0]}
  />
}
