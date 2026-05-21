'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import Image from 'next/image'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email, password, redirect: false,
    })

    if (res?.error) {
      setError(t.loginError)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`} alt="TechLARP" width={900} height={225} className="h-44 w-auto" priority /></div>
          <p className="text-sm text-gray-500 mt-1">{t.loginSubtitle}</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-medium">{t.loginTitle}</h2>
            <LanguageSwitcher />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">{t.email}</label>
              <input id="email" type="email" className="input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder} required autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="password">{t.password}</label>
              <input id="password" type="password" className="input"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder} required />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t.loginLoading : t.loginButton}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">
            {t.noAccount}{' '}
            <a href="/registro" className="text-primary hover:underline">{t.requestAccess}</a>
          </p>
        </div>
      </div>
    </div>
  )
}
