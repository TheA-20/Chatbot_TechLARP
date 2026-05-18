/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  basePath: isProd ? '/techlarp-chatbot' : '',
  assetPrefix: isProd ? '/techlarp-chatbot' : '',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '163.117.137.118',
        'dei.inf.uc3m.es',
      ],
    },
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  ...(isProd && {
    output: 'standalone',
  }),
}
module.exports = nextConfig
