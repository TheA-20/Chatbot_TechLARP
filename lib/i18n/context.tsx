'use client'
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getDictionary, type Locale, type Dict } from './dictionary'

interface I18nContextType {
  locale: Locale
  t: Dict
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  t: getDictionary('es'),
  setLocale: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')
  const [t, setT] = useState<Dict>(getDictionary('es'))

  useEffect(() => {
    const saved = localStorage.getItem('edularp-lang') as Locale | null
    if (saved && (saved === 'es' || saved === 'en')) {
      setLocaleState(saved)
      setT(getDictionary(saved))
    }
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    setT(getDictionary(l))
    localStorage.setItem('edularp-lang', l)
  }

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
