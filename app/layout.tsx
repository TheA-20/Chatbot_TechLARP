import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

const subpath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  title:       'TechLARP — Plataforma de actividades educativas',
  description: 'Plataforma de gestión, recomendación y personalización de actividades TechLARP para educadores STEM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        {/* Explicit icon links so basePath is applied correctly without ambiguity */}
        <link rel="icon" href={`${subpath}/TechLARP_Symbol.png`} type="image/png" />
        <link rel="apple-touch-icon" href={`${subpath}/TechLARP_Symbol.png`} />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* DEI watermark – plain img avoids Next.js Image auto-basePath interaction */}
        <div
          className="hidden md:block"
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${subpath}/logo_DEI_vectorial.png`}
            alt="DEI Interactive Systems Group"
            width={140}
            height={70}
            style={{ height: 'auto', maxWidth: '140px', mixBlendMode: 'multiply' }}
          />
        </div>
      </body>
    </html>
  )
}
