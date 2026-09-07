import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

/**
 * Admin marketplace banner image upload → Cloudflare R2.
 * (Restored — route was accidentally removed in commit 69255e7 while the
 * admin marketplace panel still posts to it, causing 404s.)
 *
 * FormData fields:
 *  - image: File (required) — JPEG/PNG/WebP/GIF, max 2MB (enforced by r2.ts)
 *  - oldImage: string (optional) — previous URL to delete after success
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const oldImage = formData.get('oldImage') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'ছবি ফাইল দিন' }, { status: 400 })
    }

    const result = await uploadToR2(file, 'banners')

    // Old banner image is removed only after the new upload succeeded
    if (oldImage) {
      await deleteFromR2(oldImage).catch(() => {})
    }

    return NextResponse.json({ success: true, url: result.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
