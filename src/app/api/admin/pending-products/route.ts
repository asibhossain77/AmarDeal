import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const products = await db.digitalProduct.findMany({
      where: { status: 'pending' },
      include: {
        seller: { select: { id: true, name: true, email: true, phone: true, imageLink: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ products })
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

    const product = await db.digitalProduct.findUnique({ where: { id: productId } })
    if (!product || product.status !== 'pending') {
      return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected'
    await db.digitalProduct.update({
      where: { id: productId },
      data: { status: newStatus },
    })

    // If rejected and has image, delete from R2
    if (action === 'reject' && product.image) {
      const { deleteFromR2 } = await import('@/lib/r2')
      await deleteFromR2(product.image)
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'পণ্য অনুমোদিত হয়েছে' : 'পণ্য বাতিল হয়েছে',
    })
  } catch {
    return NextResponse.json({ error: 'ফেইল হয়েছে' }, { status: 500 })
  }
}
