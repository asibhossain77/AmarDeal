import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { DEFAULT_PRODUCT_QUANTITY, isMissingColumnError } from '@/lib/prisma-column-safe'

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

    let products
    try {
      products = await db.digitalProduct.findMany({
        where,
        include: {
          seller: {
            select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity')) throw err
      // quantity column not migrated yet (production) — fall back without it
      products = await db.digitalProduct.findMany({
        where,
        select: {
          id: true, title: true, description: true, price: true, category: true, image: true,
          status: true, createdAt: true, updatedAt: true,
          seller: { select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    const formatted = products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      image: p.image,
      quantity: (p as { quantity?: number }).quantity ?? DEFAULT_PRODUCT_QUANTITY,
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
  } catch (err) {
    console.error('[products:GET] Failed:', err instanceof Error ? err.message : err)
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

    const { title, description, price, category, image, quantity } = await req.json()

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

    const quantityNum = quantity === undefined || quantity === null || quantity === ''
      ? DEFAULT_PRODUCT_QUANTITY
      : Math.floor(Number(quantity))
    if (Number.isNaN(quantityNum) || quantityNum < 1) {
      return NextResponse.json(
        { success: false, error: 'কোয়ান্টিটি অবশ্যই ১ বা তার বেশি হতে হবে' },
        { status: 400 }
      )
    }

    const createData: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      category: validCategory,
      image: image || null,
      sellerId: userId,
      status: 'pending',
      quantity: quantityNum,
    }

    let product
    try {
      product = await db.digitalProduct.create({ data: createData, include: { seller: { select: { name: true, imageLink: true, whatsappNumber: true } } } })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity')) throw err
      // quantity column not migrated yet — raw INSERT without quantity (new client
      // always includes schema defaults in CREATE, so Prisma create cannot be used)
      delete createData.quantity
      const newId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
      const now = new Date().toISOString()
      await db.$executeRawUnsafe(
        'INSERT INTO "DigitalProduct" ("id","title","description","price","category","image","sellerId","status","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)',
        newId, createData.title as string, createData.description as string, createData.price as number,
        createData.category as string, (createData.image as string | null) ?? null, userId, 'pending', now, now
      )
      product = await db.digitalProduct.findUnique({
        where: { id: newId },
        select: {
          id: true, title: true, description: true, price: true, category: true, image: true,
          status: true, createdAt: true, updatedAt: true,
          seller: { select: { name: true, imageLink: true, whatsappNumber: true } },
        },
      })
    }

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
          quantity: (product as { quantity?: number }).quantity ?? DEFAULT_PRODUCT_QUANTITY,
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
