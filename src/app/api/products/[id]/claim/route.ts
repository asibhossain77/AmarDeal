import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { isMissingColumnError } from '@/lib/prisma-column-safe'
import { notifyUser } from '@/lib/push'

/**
 * POST /api/products/[id]/claim — claim a FREE digital product.
 * Creates a ProductDownload grant so the buyer gets a download page —
 * no deal, no payment needed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    let product
    try {
      product = await db.digitalProduct.findUnique({
        where: { id },
        select: { id: true, title: true, status: true, isFree: true, sellerId: true, fileName: true },
      })
    } catch (err) {
      // Columns not migrated yet → product cannot be a digital/free one
      if (isMissingColumnError(err, 'isFree') || isMissingColumnError(err, 'fileKey')) {
        return NextResponse.json({ success: false, error: 'এই পণ্যটি ফ্রি নয়' }, { status: 400 })
      }
      throw err
    }

    if (!product || product.status !== 'active') {
      return NextResponse.json({ success: false, error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
    }

    if (!product.isFree) {
      return NextResponse.json({ success: false, error: 'এই পণ্যটি ফ্রি নয় — ডিলের মাধ্যমে অর্ডার করুন' }, { status: 400 })
    }

    // Upsert grant (unique per user+product) — idempotent re-claims
    await db.productDownload.upsert({
      where: { productId_userId: { productId: id, userId } },
      create: { productId: id, userId },
      update: {},
    })

    // Notify the seller (best effort)
    if (product.sellerId !== userId) {
      notifyUser({
        userId: product.sellerId,
        type: 'free_download',
        title: 'ফ্রি ডাউনলোড',
        message: `কেউ আপনার ফ্রি পণ্য "${product.title}" ডাউনলোড করেছে।`,
        pushUrl: '/dashboard/seller-products',
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, redirect: `/download/${id}` })
  } catch (err) {
    console.error('[claim] Failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'ক্লেইম করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
