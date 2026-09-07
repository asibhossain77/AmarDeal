import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

/**
 * Logged-in user profile photo upload → Cloudflare R2.
 * (Restored — route was accidentally removed in commit b5d1277 while the
 * dashboard profile panel still posts to it, causing 404s.)
 *
 * FormData fields:
 *  - image: File (required) — JPEG/PNG/WebP/GIF, max 2MB (enforced by r2.ts)
 *  - oldImage: string (optional) — previous URL to delete after success
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const oldImage = formData.get('oldImage') as string | null

    if (!file) {
      return NextResponse.json({ error: 'ছবি প্রদান করুন' }, { status: 400 })
    }

    // Delete old image if re-uploading
    if (oldImage) {
      await deleteFromR2(oldImage).catch(() => {})
    }

    const result = await uploadToR2(file, 'profiles')

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Profile image upload FAILED:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
