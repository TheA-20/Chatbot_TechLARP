/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Registrar la IP del servidor en producción
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),
}
module.exports = nextConfig
