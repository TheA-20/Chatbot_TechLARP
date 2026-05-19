import type { Metadata } from 'next'
import Image from 'next/image'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title:       'TechLARP — Plataforma de actividades educativas',
  description: 'Plataforma de gestión, recomendación y personalización de actividades TechLARP para educadores STEM',
  icons: {
    icon: '/TechLARP_Symbol.png',
    apple: '/TechLARP_Symbol.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Logo DEI – grupo de trabajo desarrollador de la plataforma */}
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 9999,
            opacity: 0.18,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <Image
            src="/logo_DEI_vectorial.png"
            alt="DEI Interactive Systems Group"
            width={140}
            height={70}
            style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
            priority={false}
          />
        </div>
      </body>
    </html>
  )
}
