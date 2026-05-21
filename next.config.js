/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const useSubpath = process.env.USE_SUBPATH === 'true'
const subpathValue = (isProd && useSubpath) ? '/techlarp-chatbot' : ''
const nextConfig = {
  basePath: subpathValue,
  assetPrefix: subpathValue,
  env: {
    NEXT_PUBLIC_BASE_PATH: subpathValue,
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
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  ...(isProd && {
    output: 'standalone',
  }),
}
module.exports = nextConfig
