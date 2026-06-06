import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// Magic-byte signatures for each allowed MIME type.
// Checked against the actual file bytes to prevent MIME-type spoofing.
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header; WEBP at offset 8 checked separately
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
]

function matchesMagicBytes(buf: Buffer, mime: string): boolean {
  const sig = MAGIC_BYTES.find(m => m.mime === mime)
  if (!sig) return false
  const offset = sig.offset ?? 0
  if (buf.length < offset + sig.bytes.length) return false
  const match = sig.bytes.every((b, i) => buf[offset + i] === b)
  if (mime === 'image/webp') {
    // Also verify WEBP marker at offset 8
    return match && buf.length >= 12 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  }
  return match
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG, WebP o GIF' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo no puede superar 5 MB' }, { status: 400 })
  }

  // Read bytes early so we can validate magic bytes before writing to disk
  const bytes = await file.arrayBuffer()
  const buf = Buffer.from(bytes)

  // Validate actual file content against magic bytes (prevents MIME spoofing)
  if (!matchesMagicBytes(buf, file.type)) {
    return NextResponse.json({ error: 'El contenido del archivo no coincide con el tipo declarado' }, { status: 400 })
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const filename = `${randomUUID()}.${ext}`
  const uploadsDir = join(process.cwd(), 'public', 'uploads')

  await mkdir(uploadsDir, { recursive: true })
  await writeFile(join(uploadsDir, filename), buf)

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  return NextResponse.json({ url: `${basePath}/uploads/${filename}` })
}
