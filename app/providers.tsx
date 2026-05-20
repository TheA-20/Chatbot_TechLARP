'use client'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/lib/i18n/context'

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={`${bp}/api/auth`}>
      <I18nProvider>{children}</I18nProvider>
    </SessionProvider>
  )
}
