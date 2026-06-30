/** @type {import('next').NextConfig} */
const fs   = require('fs')
const path = require('path')

// Read a single key from .env files WITHOUT using @next/env's loadEnvConfig.
// Calling loadEnvConfig here would mark the .env files as already-loaded,
// preventing Next.js's own internal loadEnvConfig call from reporting the
// NEXT_PUBLIC_* vars it needs to populate webpack's DefinePlugin — which is
// what actually injects them into the client bundle.
function readEnvVar(key) {
  if (process.env[key] !== undefined) return process.env[key]
  for (const f of ['.env.local', '.env.production', '.env']) {
    try {
      const line = fs.readFileSync(path.join(__dirname, f), 'utf8')
        .split('\n').find(l => l.startsWith(key + '='))
      if (line) return line.slice(key.length + 1).replace(/^["']|["']$/g, '').trim()
    } catch {}
  }
  return undefined
}

const isProd = process.env.NODE_ENV === 'production'

// Startup safety checks — fail fast rather than silently misbehave in production
if (isProd) {
  if (!readEnvVar('ALLOWED_ORIGINS')) {
    throw new Error(
      '[next.config] ALLOWED_ORIGINS is not set. Server Actions will reject all production ' +
      'requests with 403. Set ALLOWED_ORIGINS=your-domain.com in .env.production.'
    )
  }
}
const useSubpath = readEnvVar('USE_SUBPATH') === 'true'
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
  // Injects NEXT_PUBLIC_BASE_PATH into webpack's DefinePlugin so the client
  // bundle has the correct value. process.env alone is not enough — Next.js
  // only injects NEXT_PUBLIC_* vars into the browser bundle if they appear in
  // nextConfig.env or were loaded by its own internal @next/env call.
  env: {
    NEXT_PUBLIC_BASE_PATH: subpathValue,
  },
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
        ...(readEnvVar('ALLOWED_ORIGINS') ? readEnvVar('ALLOWED_ORIGINS').split(',') : []),
      ],
    },
  },
  images: {
    unoptimized: true,
    // Avoid using hostname:'**' which turns Next.js into an open image proxy.
    // Only allow images served from the application's own origin.
    remotePatterns: [],
  },
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
  ...(isProd && {
    output: 'standalone',
  }),
}
module.exports = nextConfig
