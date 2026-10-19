import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { withSchemaHeal } from '@/lib/ensure-schema'
import { DEFAULT_PRODUCT_QUANTITY, isMissingColumnError, isMissingProductOptionsSupportError } from '@/lib/prisma-column-safe'
import { normalizeProductType, validateOptions, priceRangeFromPrices } from '@/lib/product-options'
import { ownsFileKey, validateDigitalFile, MAX_DIGITAL_FILE_SIZE } from '@/lib/r2'
import { isValidProductCategory } from '@/lib/product-categories'
import { normalizeItemType, isItemCondition, sanitizeShippingInfo } from '@/lib/product-item-type'

/* PRODUCT_CATEGORIES lives in src/lib/product-categories.ts — single source of
   truth shared with PATCH /api/products/[id] so edits always accept every
   category create allows (Task 40 drift fix). */

// GET /api/products — list all active products (public, no auth needed)
// Wrapped in withSchemaHeal: on schema-drift failure (production Turso
// missing new tables/columns) the schema heals once and the load retries;
// the internal fallbacks stay as a second line of defense.
async function loadProducts(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const where: Record<string, unknown> = { status: 'active' }
    if (category && isValidProductCategory(category)) {
      where.category = category
    }

    let products
    try {
      products = await db.digitalProduct.findMany({
        where,
        include: {
          seller: {
            select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true, admin: { select: { userId: true } } },
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
        // Item type + physical-only attributes (Task 82). Missing column /
        // legacy rows → non_physical (old listings are never reclassified).
        itemType: (p as { itemType?: string }).itemType === 'physical' ? 'physical' : 'non_physical',
        condition: (p as { condition?: string | null }).condition ?? null,
        shippingInfo: (p as { shippingInfo?: string | null }).shippingInfo ?? null,
        // Admin-sold (platform-owned) products keep their direct-order flow
        isPlatformOwned: !!(p.seller as { admin?: { userId: string } | null } | undefined)?.admin,
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
    // Rethrow so the outer withSchemaHeal wrapper can heal + retry once
    throw err
  }
}

export async function GET(req: NextRequest) {
  const res = await withSchemaHeal(() => loadProducts(req))
  if (res) return res
  return NextResponse.json(
    { success: false, error: 'পণ্য লোড করতে সমস্যা হয়েছে' },
    { status: 500 }
  )
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

    const { title, description, price, category, image, quantity, productType, options, isFree, fileKey, fileName, fileSize, fileType, itemType, condition, shippingInfo } = await req.json()

    const freeProduct = !!isFree

    // ── Item type (Task 82): physical vs the existing non-physical kinds ──
    const itemKind = normalizeItemType(itemType)
    if (!itemKind) {
      return NextResponse.json(
        { success: false, error: 'অবৈধ পণ্যের ধরন' },
        { status: 400 }
      )
    }
    const isPhysical = itemKind === 'physical'

    // Physical items: no pricing packages, no free giveaway, no digital file
    if (isPhysical) {
      if (freeProduct) {
        return NextResponse.json(
          { success: false, error: 'ফিজিক্যাল পণ্য ফ্রি হিসেবে দেওয়া যাবে না' },
          { status: 400 }
        )
      }
      if (fileKey) {
        return NextResponse.json(
          { success: false, error: 'ফিজিক্যাল পণ্যে ডিজিটাল ফাইল যুক্ত করা যাবে না' },
          { status: 400 }
        )
      }
    }

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, error: 'শিরোনাম এবং বিবরণ প্রদান করুন' },
        { status: 400 }
      )
    }

    // Free products are always single-price with price 0 — anyone can download them.
    // Physical items are always single fixed price (stock-based, no option packages).
    const type = freeProduct || isPhysical ? 'single' : normalizeProductType(productType)
    if (isPhysical && normalizeProductType(productType) === 'multi') {
      return NextResponse.json(
        { success: false, error: 'ফিজিক্যাল পণ্যে একাধিক মূল্য-অপশন থাকতে পারে না' },
        { status: 400 }
      )
    }

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

    const validCategory = isValidProductCategory(category) && category
      ? category
      : 'other'

    // quantity doubles as STOCK for physical items — required and explicit there;
    // non-physical products keep the historical default behaviour untouched.
    if (isPhysical && (quantity === undefined || quantity === null || quantity === '')) {
      return NextResponse.json(
        { success: false, error: 'ফিজিক্যাল পণ্যের স্টক পরিমাণ প্রদান করুন' },
        { status: 400 }
      )
    }
    const quantityNum = quantity === undefined || quantity === null || quantity === ''
      ? DEFAULT_PRODUCT_QUANTITY
      : Math.floor(Number(quantity))
    if (Number.isNaN(quantityNum) || quantityNum < 1) {
      return NextResponse.json(
        { success: false, error: 'স্টক অবশ্যই ১ বা তার বেশি হতে হবে' },
        { status: 400 }
      )
    }

    // Physical-only optional attributes — always null for non-physical items
    let conditionValue: string | null = null
    if (isPhysical && condition !== undefined && condition !== null && condition !== '') {
      if (!isItemCondition(condition)) {
        return NextResponse.json(
          { success: false, error: 'অবৈধ পণ্যের অবস্থা' },
          { status: 400 }
        )
      }
      conditionValue = condition
    }
    const shippingValue = isPhysical ? sanitizeShippingInfo(shippingInfo) : null

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
      itemType: itemKind,
      condition: conditionValue,
      shippingInfo: shippingValue,
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
      delete createData.itemType
      delete createData.condition
      delete createData.shippingInfo
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
          itemType: (product as { itemType?: string }).itemType ?? 'non_physical',
          condition: (product as { condition?: string | null }).condition ?? null,
          shippingInfo: (product as { shippingInfo?: string | null }).shippingInfo ?? null,
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
