/**
 * Next.js basePath exposed as a public env variable.
 * Empty string in development; '/techlarp-chatbot' in production with USE_SUBPATH=true.
 * Use as prefix for all client-side fetch('/api/...') calls.
 */
export const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
