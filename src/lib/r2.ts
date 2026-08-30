import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'midman-storage'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

/** Validate that R2 is properly configured. Call at the start of upload APIs. */
export function assertR2Configured(): void {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('R2 credentials are not configured')
  }
  if (!R2_PUBLIC_URL) {
    console.error('[R2] WARNING: R2_PUBLIC_URL is not set. Uploaded files will not be publicly accessible.')
  }
}

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function uploadToR2(
  file: File,
  prefix: string = 'products'
): Promise<{ url: string; key: string }> {
  assertR2Configured()

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('আপলোডের জন্য JPEG, PNG, WebP অথবা GIF ফাইল হতে হবে')
  }

  if (file.size > MAX_SIZE) {
    throw new Error('ফাইল সর্বোচ্চ 2MB হতে পারবে')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const key = `${prefix}/${timestamp}-${random}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  if (!R2_PUBLIC_URL) {
    throw new Error('R2 public URL is not configured. Set R2_PUBLIC_URL environment variable.')
  }

  const url = `${R2_PUBLIC_URL}/${key}`
  console.error('[R2] Upload success:', url)

  return { url, key }
}

/** Extract R2 key from a public URL like https://cdn.midman.bd/profiles/123.jpg */
function urlToKey(url: string): string | null {
  const base = R2_PUBLIC_URL || ''
  if (base && url.startsWith(base + '/')) {
    return url.slice(base.length + 1)
  }
  return null
}

/** Delete a file from R2 by its public URL. Silently ignores if not found. */
export async function deleteFromR2(url: string): Promise<void> {
  const key = urlToKey(url)
  if (!key) return
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  } catch {
    // ignore — DB cleanup is the source of truth
  }
}
