import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import {
  digitalFileKey,
  ensureBucketCors,
  ownsFileKey,
  presignUpload,
  deleteFileByKey,
  validateDigitalFile,
} from '@/lib/r2'

/**
 * POST /api/upload/product-file — request a presigned upload URL for a
 * digital product file (PDF/ZIP/DOC…). The browser then uploads the file
 * DIRECTLY to Cloudflare R2 (no serverless body-size limit).
 *
 * Body: { fileName: string, fileSize: number, fileType?: string }
 * Returns: { key, uploadUrl, expiresIn }
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Seller only (matches /api/products POST)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true, sellerDisabled: true },
    })
    if (!user?.isSeller || user.sellerDisabled) {
      return NextResponse.json({ success: false, error: 'সেলার অ্যাকাউন্ট সক্রিয় নয়' }, { status: 403 })
    }

    const { fileName, fileSize, fileType } = await req.json()

    if (!fileName || typeof fileName !== 'string' || typeof fileSize !== 'number') {
      return NextResponse.json({ success: false, error: 'ফাইলের নাম ও সাইজ প্রয়োজন' }, { status: 400 })
    }
    if (fileName.length > 255) {
      return NextResponse.json({ success: false, error: 'ফাইলের নাম খুব বড়' }, { status: 400 })
    }

    try {
      validateDigitalFile(fileName, fileSize)
    } catch (err) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'অবৈধ ফাইল' }, { status: 400 })
    }

    const key = digitalFileKey(userId, fileName.split('.').pop()!.toLowerCase())

    // Make sure the bucket allows browser PUTs (idempotent, once per process).
    // corsOk=false ⇒ the presigned PUT will likely be CORS-blocked in the
    // browser; the UI falls back to the direct server route for ≤4MB files.
    const corsOk = await ensureBucketCors()

    const uploadUrl = await presignUpload(key)

    return NextResponse.json({
      success: true,
      key,
      uploadUrl,
      corsOk,
      expiresIn: 600,
      fileType: typeof fileType === 'string' ? fileType.slice(0, 100) : null,
    })
  } catch (err) {
    console.error('[upload:product-file] Failed:', err instanceof Error ? err.message : err)
    const msg = err instanceof Error && err.message.includes('R2 credentials')
      ? 'স্টোরেজ কনফিগার করা নেই — অ্যাডমিনের সাথে যোগাযোগ করুন'
      : 'আপলোড URL তৈরি করতে সমস্যা হয়েছে'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/upload/product-file — remove an uploaded (or attached) digital
 * file. Only the original uploader can delete it — ownership is enforced by
 * the `files/<userId>/…` key prefix.
 *
 * Body: { key: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { key } = await req.json()
    if (!key || typeof key !== 'string' || !ownsFileKey(key, userId)) {
      return NextResponse.json({ success: false, error: 'অবৈধ ফাইল কী' }, { status: 400 })
    }

    await deleteFileByKey(key)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'ফাইল মুছতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
