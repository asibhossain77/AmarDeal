import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

/**
 * Generic admin image upload → Cloudflare R2.
 * Used by the payment methods panel (gateway logo + QR/instruction image)
 * and any other admin UI that needs a one-off image upload.
 *
 * FormData fields:
 *  - image: File (required) — JPEG/PNG/WebP/GIF, max 2MB (enforced by r2.ts)
 *  - oldImage: string (optional) — previous proxied/CDN URL to delete after success
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'ইমেজ ফাইল প্রয়োজন' }, { status: 400 })
    }

    const result = await uploadToR2(file, 'payment')

    // Best-effort cleanup of the replaced file (ignore failures)
    const oldImage = formData.get('oldImage') as string | null
    if (oldImage && oldImage !== result.url) {
      await deleteFromR2(oldImage).catch(() => {})
    }

    return NextResponse.json({ success: true, url: result.url, key: result.key })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
