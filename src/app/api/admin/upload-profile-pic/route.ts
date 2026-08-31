import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { deleteFromR2, R2_BUCKET } from '@/lib/r2'
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

/** Compress image for profile: max 400x400, WebP, target ~250-400 KB */
async function compressForProfile(file: File): Promise<{ buffer: Buffer; ext: string; mimeType: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  let compressed = await sharp(bytes)
    .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer()

  if (compressed.length > 400 * 1024) {
    compressed = await sharp(bytes)
      .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer()
  }

  return { buffer: compressed, ext: 'webp', mimeType: 'image/webp' }
}

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

  return { url: `/cdn/${key}`, key }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('profile') as File | null

    if (!file) {
      return NextResponse.json({ error: 'প্রোফাইল ছবি প্রদান করুন' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ছবি সর্বোচ্চ 5MB হতে পারে' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'শুধুমাত্র ছবি ফাইল আপলোড করুন' }, { status: 400 })
    }

    console.error('[Upload] Admin profile pic upload, file:', file.name, 'original size:', file.size)

    const old = await db.platformSetting.findUnique({ where: { key: 'admin_image_url' } })
    if (old?.value) {
      await deleteFromR2(old.value)
    }

    const { buffer, ext, mimeType } = await compressForProfile(file)
    const result = await uploadCompressedToR2(buffer, ext, mimeType, 'profiles')
    console.error('[Upload] R2 upload result URL:', result.url, 'compressed size:', buffer.length)

    const upserted = await db.platformSetting.upsert({
      where: { key: 'admin_image_url' },
      update: { value: result.url },
      create: { key: 'admin_image_url', value: result.url },
    })
    console.error('[Upload] DB upserted. admin_image_url:', upserted.value)

    return NextResponse.json({
      success: true,
      imageUrl: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'প্রোফাইল ছবি আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Admin profile pic upload FAILED:', message)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
