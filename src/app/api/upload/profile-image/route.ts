import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2, deleteFromR2, R2_BUCKET } from '@/lib/r2'
import { db } from '@/lib/db'
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

/** Compress image for profile: max 400x400, quality ~80, WebP output, target ~250-400 KB */
async function compressForProfile(file: File): Promise<{ buffer: Buffer; ext: string; mimeType: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  const compressed = await sharp(bytes)
    .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer()

  // If still over 400KB, reduce quality further
  if (compressed.length > 400 * 1024) {
    const recompressed = await sharp(bytes)
      .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer()
    return { buffer: recompressed, ext: 'webp', mimeType: 'image/webp' }
  }

  return { buffer: compressed, ext: 'webp', mimeType: 'image/webp' }
}

/** Upload compressed buffer directly to R2 */
async function uploadCompressedToR2(
  buffer: Buffer,
  ext: string,
  mimeType: string,
  prefix: string
): Promise<{ url: string; key: string }> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const key = `${prefix}/${timestamp}-${random}.${ext}`

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))

  const proxyUrl = `/cdn/${key}`
  console.error('[Upload] Profile compressed upload:', key, 'size:', buffer.length, 'bytes')
  return { url: proxyUrl, key }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ছবি ফাইল দিন' },
        { status: 400 }
      )
    }

    // Accept up to 5MB input, will compress to ~250-400KB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'ছবি সর্বোচ্চ 5MB হতে পারে' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'শুধুমাত্র ছবি ফাইল আপলোড করুন' },
        { status: 400 }
      )
    }

    console.error('[Upload] Profile image upload for user:', userId, 'file:', file.name, 'original size:', file.size)

    // Delete old image from R2
    const user = await db.user.findUnique({ where: { id: userId }, select: { imageLink: true } })
    if (user?.imageLink) {
      await deleteFromR2(user.imageLink)
    }

    // Compress then upload
    const { buffer, ext, mimeType } = await compressForProfile(file)
    const result = await uploadCompressedToR2(buffer, ext, mimeType, 'profiles')
    console.error('[Upload] R2 upload result URL:', result.url, 'compressed size:', buffer.length)

    const updated = await db.user.update({
      where: { id: userId },
      data: { imageLink: result.url },
    })
    console.error('[Upload] DB updated. New imageLink:', updated.imageLink)

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Profile image upload FAILED:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    )
  }
}
