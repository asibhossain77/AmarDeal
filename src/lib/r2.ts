import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

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

  const url = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

  return { url, key }
}