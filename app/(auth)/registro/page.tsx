'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import Image from 'next/image'
import Link from 'next/link'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { bp } from '@/lib/base-path'

export default function RegistroPage() {
  const router  = useRouter()
  const { t } = useI18n()
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmar) { setError(t.passwordMismatch); return }
    if (form.password.length < 8) { setError(t.passwordTooShort); return }

    setLoading(true)
    const res = await fetch(`${bp}/api/admin/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: form.nombre, email: form.email, password: form.password }),
    })

    if (res.ok) {
      setSuccess(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error')
    }
    setLoading(false)
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-medium mb-2">{t.requestSent}</h2>
        <p className="text-sm text-gray-500 mb-4">{t.requestSentDesc}</p>
        <Link href="/login" className="btn-primary inline-block">{t.backToLogin}</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`} alt="TechLARP" width={900} height={225} className="h-44 w-auto" priority /></div>
          <p className="text-sm text-gray-500 mt-1">{t.registerTitle}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium">{t.registerTitle}</span>
            <LanguageSwitcher />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t.fullName}</label>
              <input className="input" type="text" placeholder={t.fullNamePlaceholder}
                value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
            </div>
            <div>
              <label className="label">{t.institutionalEmail}</label>
              <input className="input" type="email" placeholder={t.institutionalEmailPlaceholder}
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="label">{t.password}</label>
              <input className="input" type="password" placeholder={t.minPassword}
                value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div>
              <label className="label">{t.confirmPassword}</label>
              <input className="input" type="password" placeholder={t.confirmPasswordPlaceholder}
                value={form.confirmar} onChange={e => set('confirmar', e.target.value)} required />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t.registerLoading : t.registerButton}
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">
            {t.hasAccount}{' '}
            <Link href="/login" className="text-primary hover:underline">{t.goToLogin}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
