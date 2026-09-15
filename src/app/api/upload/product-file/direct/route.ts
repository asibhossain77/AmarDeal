import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import {
  digitalFileKey,
  putDigitalFile,
  validateDigitalFile,
} from '@/lib/r2'

/**
 * POST /api/upload/product-file/direct — server-side digital file upload
 * (multipart, field name "file"). FALLBACK for the presigned browser→R2
 * flow: server→R2 PUTs need NO bucket CORS, so this path keeps small
 * uploads working even when the R2 token cannot manage bucket CORS.
 *
 * Limited to 4MB (Vercel serverless request body limit ≈ 4.5MB).
 * Larger files must use the presigned PUT path (needs bucket CORS).
 *
 * Returns: { success, key }
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Seller only (matches /api/upload/product-file)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true, sellerDisabled: true },
    })
    if (!user?.isSeller || user.sellerDisabled) {
      return NextResponse.json({ success: false, error: 'সেলার অ্যাকাউন্ট সক্রিয় নয়' }, { status: 403 })
    }

    // Reject oversized uploads BEFORE buffering the body
    const declaredSize = Number(req.headers.get('content-length') || 0)
    if (declaredSize > 4.5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'সরাসরি আপলোডে ফাইল সর্বোচ্চ ৪MB হতে পারবে — বড় ফাইলের জন্য অ্যাডমিনকে R2 CORS ঠিক করতে বলুন' },
        { status: 413 },
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'ফাইল পাওয়া যায়নি' }, { status: 400 })
    }

    let ext: string
    try {
      ext = validateDigitalFile(file.name, file.size).ext
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'অবৈধ ফাইল' },
        { status: 400 },
      )
    }

    const key = digitalFileKey(userId, ext)
    const buffer = Buffer.from(await file.arrayBuffer())
    await putDigitalFile(buffer, key, file.type || null)

    return NextResponse.json({ success: true, key })
  } catch (err) {
    console.error('[upload:product-file:direct] Failed:', err instanceof Error ? err.message : err)
    const msg = err instanceof Error && err.message.includes('R2 credentials')
      ? 'স্টোরেজ কনফিগার করা নেই — অ্যাডমিনের সাথে যোগাযোগ করুন'
      : 'ফাইল আপলোড করতে সমস্যা হয়েছে'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
