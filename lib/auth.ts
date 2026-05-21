import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

// NextAuth v4 detrás de proxy SSL (UC3M): Node.js corre en HTTP interno.
// El prefijo __Secure- requiere el atributo Secure=true, incompatible con
// terminación SSL en nginx. Usamos prefijo vacío + secure:false.
const cookiePrefix = ''
const useSecure    = false  // El proxy SSL de la UC3M termina HTTPS; internamente es HTTP

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: useSecure },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: useSecure },
    },
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: useSecure },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
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
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
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
