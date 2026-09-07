import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { db } from '@/lib/db'

/**
 * Seller product image upload → Cloudflare R2.
 * (Restored — route was accidentally removed in commit b5d1277 while the
 * frontend still posts to it, causing 404s on every product image upload.)
 *
 * FormData fields:
 *  - image: File (required) — JPEG/PNG/WebP/GIF, max 2MB (enforced by r2.ts)
 *  - oldImage: string (optional) — previous URL to delete after success
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    // Parse form data FIRST (before DB call — avoids body stream issues)
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    const oldImage = formData.get('oldImage') as string | null

    if (!file) {
      return NextResponse.json({ error: 'ছবি প্রদান করুন' }, { status: 400 })
    }

    // Seller check (after formData parsing)
    const user = await db.user.findUnique({
      where: { id: guard.userId },
      select: { id: true, isSeller: true, sellerDisabled: true },
    })
    if (!user?.isSeller || user.sellerDisabled) {
      return NextResponse.json({ error: 'সেলার অ্যাকাউন্ট সক্রিয় নয়' }, { status: 403 })
    }

    // Delete old image if re-uploading
    if (oldImage) {
      await deleteFromR2(oldImage).catch(() => {})
    }

    const result = await uploadToR2(file, 'products')

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'আপলোডে সমস্যা হয়েছে'
    console.error('[Upload] Product image upload FAILED:', message, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
