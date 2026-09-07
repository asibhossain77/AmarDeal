import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'

const VALID_CATEGORIES = [
  'design',
  'development',
  'content',
  'marketing',
  'education',
  'software',
  'other',
] as const

const VALID_STATUSES = ['active', 'inactive', 'sold'] as const

// GET /api/products/[id] — get single product with seller info (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await db.digitalProduct.findUnique({
      where: { id },
      include: {
        seller: {
          select: { name: true, imageLink: true },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        image: product.image,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        seller: {
          name: product.seller.name,
          imageLink: product.seller.imageLink,
        },
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'পণ্য লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}

// PATCH /api/products/[id] — update product (only own products)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const existing = await db.digitalProduct.findUnique({
      where: { id },
      select: { sellerId: true, image: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    if (existing.sellerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'আপনি এই পণ্য সম্পাদনা করতে পারবেন না' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { title, description, price, category, image, status } = body

    // Build update data with only provided fields
    const data: Record<string, unknown> = {}

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { success: false, error: 'শিরোনাম খালি হতে পারে না' },
          { status: 400 }
        )
      }
      data.title = title.trim()
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return NextResponse.json(
          { success: false, error: 'বিবরণ খালি হতে পারে না' },
          { status: 400 }
        )
      }
      data.description = description.trim()
    }

    if (price !== undefined) {
      if (price <= 0) {
        return NextResponse.json(
          { success: false, error: 'মূল্য অবশ্যই শূন্যের বেশি হতে হবে' },
          { status: 400 }
        )
      }
      data.price = Number(price)
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
        return NextResponse.json(
          { success: false, error: 'অবৈধ ক্যাটাগরি' },
          { status: 400 }
        )
      }
      data.category = category
    }

    if (image !== undefined) {
      const newImage = image || null
      data.image = newImage
      // If the image is being replaced/removed, delete the old file from R2
      if (existing.image && existing.image !== newImage) {
        const { deleteFromR2 } = await import('@/lib/r2')
        await deleteFromR2(existing.image).catch(() => {})
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: 'অবৈধ স্ট্যাটাস' },
          { status: 400 }
        )
      }
      data.status = status
    }

    const product = await db.digitalProduct.update({
      where: { id },
      data,
      include: {
        seller: {
          select: { name: true, imageLink: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        image: product.image,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        seller: {
          name: product.seller.name,
          imageLink: product.seller.imageLink,
        },
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'পণ্য আপডেট করতে সমস্যা' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] — delete product (only own products or admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const existing = await db.digitalProduct.findUnique({
      where: { id },
      select: { sellerId: true, image: true },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Check ownership or admin status
    const isOwner = existing.sellerId === userId
    const admin = await getAdminFromRequest(req)
    const isAdmin = !!admin

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'আপনি এই পণ্য মুছে ফেলতে পারবেন না' },
        { status: 403 }
      )
    }

    // Delete R2 image if exists
    if (existing.image) {
      const { deleteFromR2 } = await import('@/lib/r2')
      await deleteFromR2(existing.image)
    }

    await db.digitalProduct.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: 'পণ্য মুছে ফেলতে সমস্যা' },
      { status: 500 }
    )
  }
}
