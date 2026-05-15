import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const [user] = await sql`
          SELECT id, nombre, email, password_hash, rol, estado
          FROM usuarios
          WHERE email = ${credentials.email}
        `
        if (!user) return null
        if (user.estado !== 'activo') return null

        const ok = await bcrypt.compare(credentials.password, user.password_hash)
        if (!ok) return null

        // Actualizar último acceso
        await sql`
          UPDATE usuarios SET ultimo_acceso = now() WHERE id = ${user.id}
        `

        return { id: user.id, name: user.nombre, email: user.email, rol: user.rol }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id  = user.id
        token.rol = (user as any).rol
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id  = token.id
        ;(session.user as any).rol = token.rol
      }
      return session
    },
  },
  pages: {
    signIn:  '/login',
    error:   '/login',
  },
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24 horas
}
