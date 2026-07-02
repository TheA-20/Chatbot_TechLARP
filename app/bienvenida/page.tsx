'use client'
import Image from 'next/image'
import Link from 'next/link'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { useI18n } from '@/lib/i18n/context'

export default function BienvenidaPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg text-center">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/TechLARP-logo-02.png`}
            alt="TechLARP"
            width={900}
            height={225}
            className="h-40 w-auto"
            priority
          />
        </div>

        {/* Subtítulo */}
        <p className="text-gray-500 text-sm mb-2">{t.loginSubtitle}</p>

        {/* Descripción */}
        <p className="text-gray-600 text-base mb-10 max-w-md mx-auto leading-relaxed">
          {t.welcomeDescription}
        </p>

        {/* Botones de acceso */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-base px-8 py-3 rounded-xl inline-block">
            {t.welcomeAccess}
          </Link>
          <Link
            href="/invitado/chat"
            className="text-base px-8 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 inline-block text-center"
          >
            {t.tryWithoutAccount}
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          <Link href="/registro" className="hover:underline text-primary">
            {t.noAccountFree}
          </Link>
        </p>

        <div className="mt-8">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
