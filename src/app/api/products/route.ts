import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

const VALID_CATEGORIES = [
  'design',
  'development',
  'content',
  'marketing',
  'education',
  'software',
  'social_media',
  'id',
  'other',
] as const

// GET /api/products — list all active products (public, no auth needed)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const where: Record<string, unknown> = { status: 'active' }
    if (category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      where.category = category
    }

    const products = await db.digitalProduct.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      image: p.image,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      seller: {
        id: p.seller.id,
        name: p.seller.name,
        imageLink: p.seller.imageLink,
        email: p.seller.email,
        whatsappNumber: p.seller.whatsappNumber,
      },
    }))

    return NextResponse.json({ success: true, products: formatted })
  } catch {
    return NextResponse.json(
      { success: false, error: 'পণ্য লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

// POST /api/products — create a new product (seller only)
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Verify the user is a seller
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true },
    })

    if (!user?.isSeller) {
      return NextResponse.json(
        { success: false, error: 'শুধুমাত্র বিক্রেতারা পণ্য তৈরি করতে পারেন' },
        { status: 403 }
      )
    }

    const { title, description, price, category, image } = await req.json()

    if (!title?.trim() || !description?.trim() || !price) {
      return NextResponse.json(
        { success: false, error: 'শিরোনাম, বিবরণ এবং মূল্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (price <= 0) {
      return NextResponse.json(
        { success: false, error: 'মূল্য অবশ্যই শূন্যের বেশি হতে হবে' },
        { status: 400 }
      )
    }

    const validCategory = category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
      ? category
      : 'other'

    const product = await db.digitalProduct.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        category: validCategory,
        image: image || null,
        sellerId: userId,
        status: 'pending',
      },
      include: {
        seller: {
          select: { name: true, imageLink: true, whatsappNumber: true },
        },
      },
    })

    return NextResponse.json(
      {
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
            whatsappNumber: product.seller.whatsappNumber,
          },
        },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'পণ্য তৈরিতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
