import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { DEFAULT_PRODUCT_QUANTITY, isMissingColumnError, isMissingProductOptionsSupportError } from '@/lib/prisma-column-safe'
import { normalizeProductType, validateOptions, priceRangeFromPrices } from '@/lib/product-options'
import { ownsFileKey, validateDigitalFile, MAX_DIGITAL_FILE_SIZE } from '@/lib/r2'

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
          options: {
            select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity') && !isMissingProductOptionsSupportError(err) && !isMissingColumnError(err, 'fileKey')) throw err
      // quantity/productType/ProductOption/file columns not migrated yet (production) — fall back without them
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

    const formatted = products.map((p) => {
      const options = ((p as { options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[] }).options) ?? []
      const isMulti = (p as { productType?: string }).productType === 'multi' && options.length > 0
      const availablePrices = options.filter((o) => o.isAvailable).map((o) => o.price)
      const range = priceRangeFromPrices(availablePrices.length > 0 ? availablePrices : options.map((o) => o.price))
      return {
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
        productType: isMulti ? 'multi' : ((p as { productType?: string }).productType === 'multi' ? 'multi' : 'single'),
        optionsCount: options.length,
        minPrice: isMulti ? range.min : p.price,
        maxPrice: isMulti ? range.max : p.price,
        isFree: (p as { isFree?: boolean }).isFree ?? false,
        // NOTE: fileKey is intentionally NOT exposed — only its metadata
        hasFile: !!(p as { fileName?: string | null }).fileName,
        fileName: (p as { fileName?: string | null }).fileName ?? null,
        fileSize: (p as { fileSize?: number | null }).fileSize ?? null,
        fileType: (p as { fileType?: string | null }).fileType ?? null,
        seller: {
          id: p.seller.id,
          name: p.seller.name,
          imageLink: p.seller.imageLink,
          email: p.seller.email,
          whatsappNumber: p.seller.whatsappNumber,
        },
      }
    })

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

    const { title, description, price, category, image, quantity, productType, options, isFree, fileKey, fileName, fileSize, fileType } = await req.json()

    const freeProduct = !!isFree

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, error: 'শিরোনাম এবং বিবরণ প্রদান করুন' },
        { status: 400 }
      )
    }

    // Free products are always single-price with price 0 — anyone can download them
    const type = freeProduct ? 'single' : normalizeProductType(productType)

    // ── Type-specific validation ──
    // single: one fixed price → price is required
    // multi:  price comes from options; DB price column stores the minimum option price
    let validatedOptions: { name: string; price: number; isAvailable: boolean; sortOrder: number }[] = []
    let effectivePrice = freeProduct ? 0 : Number(price)

    if (!freeProduct && type === 'multi') {
      const result = validateOptions(options)
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      validatedOptions = result.options
      effectivePrice = Math.min(...validatedOptions.map((o) => o.price))
    } else if (!freeProduct) {
      if (price === undefined || price === null || price === '') {
        return NextResponse.json(
          { success: false, error: 'শিরোনাম, বিবরণ এবং মূল্য প্রদান করুন' },
          { status: 400 }
        )
      }
      if (Number(price) <= 0) {
        return NextResponse.json(
          { success: false, error: 'মূল্য অবশ্যই শূন্যের বেশি হতে হবে' },
          { status: 400 }
        )
      }
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
      price: effectivePrice,
      category: validCategory,
      image: image || null,
      sellerId: userId,
      status: 'pending',
      quantity: quantityNum,
      productType: type,
      isFree: freeProduct,
    }

    // Digital file attachment — key must belong to this uploader
    if (fileKey) {
      if (typeof fileKey !== 'string' || !ownsFileKey(fileKey, userId)) {
        return NextResponse.json(
          { success: false, error: 'অবৈধ ফাইল কী' },
          { status: 400 }
        )
      }
      if (typeof fileName !== 'string' || typeof fileSize !== 'number') {
        return NextResponse.json(
          { success: false, error: 'ফাইলের মেটাডেটা প্রয়োজন' },
          { status: 400 }
        )
      }
      try {
        validateDigitalFile(fileName, fileSize)
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : 'অবৈধ ফাইল' },
          { status: 400 }
        )
      }
      createData.fileKey = fileKey
      createData.fileName = fileName.slice(0, 255)
      createData.fileSize = Math.min(Math.floor(fileSize), MAX_DIGITAL_FILE_SIZE)
      createData.fileType = typeof fileType === 'string' ? fileType.slice(0, 100) : null
    }

    let product
    try {
      product = await db.digitalProduct.create({
        data: {
          ...createData,
          ...(type === 'multi' ? { options: { create: validatedOptions } } : {}),
        } as never,
        include: {
          seller: { select: { name: true, imageLink: true, whatsappNumber: true } },
          options: { orderBy: { sortOrder: 'asc' } },
        },
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity') && !isMissingProductOptionsSupportError(err)) throw err
      // quantity/productType/ProductOption/file columns not migrated yet — raw INSERT without them
      delete createData.quantity
      delete createData.productType
      delete createData.isFree
      delete createData.fileKey
      delete createData.fileName
      delete createData.fileSize
      delete createData.fileType
      const optionsToInsert = validatedOptions
      delete createData.options
      const newId = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
      const now = new Date().toISOString()
      await db.$executeRawUnsafe(
        'INSERT INTO "DigitalProduct" ("id","title","description","price","category","image","sellerId","status","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?)',
        newId, createData.title as string, createData.description as string, effectivePrice,
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
      // Persist options best-effort (table exists but productType column may not)
      if (type === 'multi' && optionsToInsert.length > 0) {
        try {
          for (const opt of optionsToInsert) {
            await db.$executeRawUnsafe(
              'INSERT INTO "ProductOption" ("id","productId","name","price","isAvailable","sortOrder","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?)',
              'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12), newId, opt.name, opt.price, opt.isAvailable ? 1 : 0, opt.sortOrder, now, now
            )
          }
        } catch { /* ProductOption table not migrated yet — product stays single-price */ }
      }
    }

    const createdOptions = ((product as { options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[] }).options) ?? []
    const isMulti = (product as { productType?: string }).productType === 'multi' && createdOptions.length > 0
    const range = priceRangeFromPrices(createdOptions.length > 0 ? createdOptions.map((o) => o.price) : [product.price])

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
          productType: isMulti ? 'multi' : 'single',
          optionsCount: createdOptions.length,
          minPrice: isMulti ? range.min : product.price,
          maxPrice: isMulti ? range.max : product.price,
          isFree: (product as { isFree?: boolean }).isFree ?? false,
          hasFile: !!(product as { fileName?: string | null }).fileName,
          fileName: (product as { fileName?: string | null }).fileName ?? null,
          fileSize: (product as { fileSize?: number | null }).fileSize ?? null,
          fileType: (product as { fileType?: string | null }).fileType ?? null,
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
