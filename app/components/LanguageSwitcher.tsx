'use client'
import { useI18n } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/dictionary'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <select
      value={locale}
      onChange={e => setLocale(e.target.value as Locale)}
      className={`text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 cursor-pointer ${className}`}
    >
      <option value="es">🇪🇸 {t.spanish}</option>
      <option value="en">🇬🇧 {t.english}</option>
    </select>
  )
}
