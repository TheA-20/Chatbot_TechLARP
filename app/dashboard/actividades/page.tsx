import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import ActividadesClient from './ActividadesClient'

export default async function ActividadesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const rol = (session.user as any).rol

  const larps = await sql`
    SELECT e.id, e.nombre, e.nivel_educativo, e.asignaturas, e.duracion_min,
           e.num_participantes, e.estado, e.creado_en,
           e.imagenes_urls, e.inclusion_index,
           e.idioma_original, e.autor_id, e.veces_modificada,
           u.nombre AS autor_nombre
    FROM edularp e
    LEFT JOIN usuarios u ON u.id = e.autor_id
    WHERE e.estado = 'publicado'
    ORDER BY e.creado_en DESC
  `

  const userId = (session.user as any).id as string
  return <ActividadesClient larps={larps} isAdmin={rol === 'admin'} userId={userId} />
}
