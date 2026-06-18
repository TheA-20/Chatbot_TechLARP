/** @type {import('next').NextConfig} */
// Pre-load .env files so safety checks below can read them.
// next.config.js is evaluated before Next.js normally runs loadEnvConfig,
// so we call it explicitly here.
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info: () => {}, error: () => {} })

const isProd = process.env.NODE_ENV === 'production'

// Startup safety checks — fail fast rather than silently misbehave in production
if (isProd) {
  if (!process.env.ALLOWED_ORIGINS) {
    throw new Error(
      '[next.config] ALLOWED_ORIGINS is not set. Server Actions will reject all production ' +
      'requests with 403. Set ALLOWED_ORIGINS=your-domain.com in .env.production.'
    )
  }
  if (!process.env.NEXTAUTH_SECURE || process.env.NEXTAUTH_SECURE !== 'true') {
    throw new Error(
      '[next.config] NEXTAUTH_SECURE is not set to "true". Session/CSRF/callback cookies will ' +
      'be issued without the Secure flag. Set NEXTAUTH_SECURE=true in .env.production.'
    )
  }
}
const useSubpath = process.env.USE_SUBPATH === 'true'
const subpathValue = (isProd && useSubpath) ? '/techlarp-chatbot' : ''

// Security headers applied to every response
const securityHeaders = [
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-inline/eval required by Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  basePath: subpathValue,
  assetPrefix: subpathValue,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
      ],
    },
  },
  images: {
    unoptimized: true,
    // Avoid using hostname:'**' which turns Next.js into an open image proxy.
    // Only allow images served from the application's own origin.
    remotePatterns: [],
  },
  ...(isProd && {
    output: 'standalone',
  }),
}
module.exports = nextConfig
