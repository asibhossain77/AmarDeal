import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

/**
 * Upload a payment-gateway footer badge icon.
 * formData: icon (File), previousUrl (optional — deleted from R2 after success)
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('icon') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Icon file required' }, { status: 400 })
    }

    const result = await uploadToR2(file, 'payment-icons')

    // Best-effort cleanup of the replaced icon (never touches bundled
    // /payment/* defaults — those are local paths R2 can't resolve).
    const previousUrl = formData.get('previousUrl')
    if (typeof previousUrl === 'string' && previousUrl.startsWith('http')) {
      await deleteFromR2(previousUrl)
    }

    return NextResponse.json({
      success: true,
      iconUrl: result.url,
      message: 'Icon uploaded successfully',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Icon upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
