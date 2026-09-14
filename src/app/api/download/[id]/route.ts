import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { checkDigitalAccess } from '@/lib/digital-access'
import { presignDownload } from '@/lib/r2'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/download/[id] — download the digital file for product `id`.
 *
 * Access is verified server-side; if (and only if) entitled, the request is
 * redirected (302) to a short-lived presigned R2 URL that forces an
 * attachment download. File bytes never flow through this server.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(_req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { product, entitled, reason, dealStatus } = await checkDigitalAccess(userId, id)

    if (!product) {
      return NextResponse.json({ success: false, error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
    }
    if (!entitled || !product.fileKey) {
      const message = reason === 'PAYMENT_PENDING'
        ? 'পেমেন্ট ভেরিফিকেশনের অপেক্ষায় — ভেরিফাই হলেই ডাউনলোড করতে পারবেন'
        : reason === 'NO_FILE'
          ? 'এই পণ্যের কোনো ফাইল নেই'
          : 'এই পণ্যটি আপনার এখনো কেনা নেই'
      return NextResponse.json(
        { success: false, error: message, reason, dealStatus },
        { status: 403 }
      )
    }

    // Record the grant (free claim / paid download) — best effort, unique per user+product
    db.productDownload.upsert({
      where: { productId_userId: { productId: product.id, userId } },
      create: { productId: product.id, userId },
      update: {},
    }).catch(() => {})

    const url = await presignDownload(product.fileKey, product.fileName || 'download', product.fileType)

    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[download] Failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'ডাউনলোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
