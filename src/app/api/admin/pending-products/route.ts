import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { isMissingColumnError } from '@/lib/prisma-column-safe'
import { isMissingProductOptionsSupportError } from '@/lib/prisma-column-safe'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    let products
    try {
      products = await db.digitalProduct.findMany({
        where: { status: 'pending' },
        include: {
          seller: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
          options: {
            select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      if (isMissingColumnError(err, 'fileKey')) {
        // Digital-file columns not migrated yet — same shape minus file scalars
        products = await db.digitalProduct.findMany({
          where: { status: 'pending' },
          select: {
            id: true, title: true, description: true, price: true, category: true, image: true,
            productType: true, createdAt: true,
            seller: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
            options: {
              select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      } else if (isMissingProductOptionsSupportError(err)) {
        // ProductOption support not migrated yet — plain include
        products = await db.digitalProduct.findMany({
          where: { status: 'pending' },
          include: {
            seller: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      } else {
        throw err
      }
    }

    // Flatten for frontend
    const flat = products.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      image: p.image,
      productType: (p as { productType?: string }).productType || 'single',
      options: ((p as { options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[] }).options) || [],
      sellerName: p.seller?.name || '',
      createdAt: p.createdAt,
    }))

    return NextResponse.json({ products: flat })
  } catch {
    return NextResponse.json({ error: 'ফেইল হয়েছে' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { productId, action, rejectionReason } = await req.json()
    if (!productId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
    }

    // ── Phase 9: moderation lifecycle via the shared helper ──
    // approve → active / reject → rejected. The helper stores the rejection
    // reason on the product (seller-visible), notifies the seller and writes
    // an append-only audit log entry. The old destructive image deletion on
    // reject is gone: rejected listings must stay intact so the seller can
    // fix the issue and resubmit for review (Phase 9 "require changes" loop).
    const { moderateProduct } = await import('@/lib/marketplace-moderation')
    const result = await moderateProduct(
      productId,
      action === 'approve' ? 'approve' : 'reject',
      rejectionReason,
      guard.admin,
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'পণ্য অনুমোদিত হয়েছে' : 'পণ্য বাতিল হয়েছে',
    })
  } catch {
    return NextResponse.json({ error: 'ফেইল হয়েছে' }, { status: 500 })
  }
}
