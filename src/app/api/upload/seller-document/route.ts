import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2 } from '@/lib/r2'

/**
 * Seller document upload → Cloudflare R2.
 * Used by the Verified Business Seller application form to upload an
 * NID / trade licence document photo for admin review.
 *
 * FormData fields:
 *  - image: File (required) — JPEG/PNG/WebP/GIF, max 2MB (enforced by r2.ts)
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'ডকুমেন্টের ছবি প্রয়োজন' }, { status: 400 })
    }

    const result = await uploadToR2(file, 'seller-docs')

    return NextResponse.json({ success: true, url: result.url, key: result.key })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে'
    console.error('[seller-document:upload] Failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
