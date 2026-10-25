import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { DEFAULT_PRODUCT_QUANTITY, isMissingColumnError, isMissingProductOptionsSupportError } from '@/lib/prisma-column-safe'
import { validateOptions, priceRangeFromPrices } from '@/lib/product-options'
import { ownsFileKey, validateDigitalFile, deleteFileByKey, MAX_DIGITAL_FILE_SIZE } from '@/lib/r2'
import { isValidProductCategory } from '@/lib/product-categories'
import { isItemCondition, sanitizeShippingInfo } from '@/lib/product-item-type'
import { withSellerRoleColumns } from '@/lib/seller-verify'
import { notifyAdmins } from '@/lib/push'
import {
  VALID_DIGITAL_KINDS,
  isVerifiedBusinessSeller,
  sanitizeProductImages,
  parseStoredImages,
  sanitizeListingText,
} from '@/lib/product-listing'

const SESSION_COOKIE = 'midman_session'

const VALID_STATUSES = ['active', 'inactive', 'sold'] as const

const OPTIONS_SELECT = {
  select: { id: true, name: true, price: true, isAvailable: true, sortOrder: true },
  orderBy: { sortOrder: 'asc' as const },
}

// GET /api/products/[id] — get single product with seller info (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // withSellerRoleColumns: public endpoint must never crash with P2022 on a
    // legacy production DB missing the two-seller-roles columns.
    let product = await withSellerRoleColumns(async () => {
    try {
      return await db.digitalProduct.findUnique({
        where: { id },
        include: {
          seller: {
            select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true, sellerRole: true, businessVerified: true, sellerDisabled: true, admin: { select: { userId: true } } },
          },
          options: OPTIONS_SELECT,
        },
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity') && !isMissingProductOptionsSupportError(err) && !isMissingColumnError(err, 'fileKey')) throw err
      // quantity/productType/ProductOption/file columns not migrated yet (production) — fall back without them
      return await db.digitalProduct.findUnique({
        where: { id },
        select: {
          id: true, title: true, description: true, price: true, category: true, image: true,
          status: true, createdAt: true, updatedAt: true, sellerId: true,
          seller: { select: { id: true, name: true, imageLink: true, email: true, whatsappNumber: true, sellerRole: true, businessVerified: true, sellerDisabled: true } },
        },
      })
    }
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // ── Session identity — needed for private fields AND moderation gating ──
    const sessionId = req.cookies.get(SESSION_COOKIE)?.value
    const isOwner = !!sessionId && sessionId === product.sellerId

    // ── Phase 9: moderated listings are not public ──
    // pending / rejected / unpublished / removed listings are visible only to
    // the owner and administrators — everyone else gets the same 404 as a
    // missing product (no information leak about moderated content).
    const MODERATED_STATUSES = ['pending', 'rejected', 'unpublished', 'removed']
    if (MODERATED_STATUSES.includes(product.status) && !isOwner) {
      const admin = sessionId ? await getAdminFromRequest(req) : null
      if (!admin) {
        return NextResponse.json(
          { success: false, error: 'পণ্য পাওয়া যায়নি' },
          { status: 404 }
        )
      }
    }

    // ── Phase 2: private deliveryDetails — owner or admin only ──
    let canSeeDeliveryDetails = isOwner
    if (!canSeeDeliveryDetails && sessionId) {
      const admin = await getAdminFromRequest(req)
      canSeeDeliveryDetails = !!admin
    }

    const options = ((product as { options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[] }).options) ?? []
    const isMulti = (product as { productType?: string }).productType === 'multi' && options.length > 0
    const availablePrices = options.filter((o) => o.isAvailable).map((o) => o.price)
    const range = priceRangeFromPrices(availablePrices.length > 0 ? availablePrices : (options.length > 0 ? options.map((o) => o.price) : [product.price]))

    return NextResponse.json({
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
        options: isMulti ? options : [],
        optionsCount: options.length,
        minPrice: isMulti ? range.min : product.price,
        maxPrice: isMulti ? range.max : product.price,
        isFree: (product as { isFree?: boolean }).isFree ?? false,
        // NOTE: fileKey is intentionally NOT exposed — only its metadata
        hasFile: !!(product as { fileName?: string | null }).fileName,
        fileName: (product as { fileName?: string | null }).fileName ?? null,
        fileSize: (product as { fileSize?: number | null }).fileSize ?? null,
        fileType: (product as { fileType?: string | null }).fileType ?? null,
        // Item type + physical-only attributes (Task 82); legacy rows → non_physical
        itemType: (product as { itemType?: string }).itemType === 'physical' ? 'physical' : 'non_physical',
        condition: (product as { condition?: string | null }).condition ?? null,
        shippingInfo: (product as { shippingInfo?: string | null }).shippingInfo ?? null,
        // Phase 2: digital classification + gallery
        digitalKind: (product as { digitalKind?: string | null }).digitalKind ?? null,
        images: parseStoredImages((product as { images?: string | null }).images),
        // PRIVATE — owner/admin views only, never exposed publicly
        ...(canSeeDeliveryDetails
          ? { deliveryDetails: (product as { deliveryDetails?: string | null }).deliveryDetails ?? null }
          : {}),
        isPlatformOwned: !!(product.seller as { admin?: { userId: string } | null } | undefined)?.admin,
        seller: {
          id: product.seller.id,
          name: product.seller.name,
          imageLink: product.seller.imageLink,
          email: product.seller.email,
          whatsappNumber: product.seller.whatsappNumber,
          sellerRole: (product.seller as { sellerRole?: string }).sellerRole ?? 'personal',
          businessVerified: (product.seller as { businessVerified?: boolean }).businessVerified ?? false,
          // Phase 8: suspended sellers cannot take orders — the UI hides the
          // order action and the order route enforces it server-side.
          isActive: (product.seller as { sellerDisabled?: boolean }).sellerDisabled !== true,
        },
      },
    })
  } catch (err) {
    console.error('[products:GET:id] Failed:', err instanceof Error ? err.message : err)
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
      select: { sellerId: true, image: true, title: true, productType: true, price: true, isFree: true, fileKey: true, fileName: true, itemType: true, images: true, status: true },
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

    // ── Phase 9: admin-removed listings are read-only ──
    // (deletion stays an admin or owner choice for everything else).
    if (existing.status === 'removed') {
      return NextResponse.json(
        { success: false, error: 'প্ল্যাটফর্ম নীতিমালার ভিত্তিতে সরানো পণ্য সম্পাদনা করা যাবে না — সাপোর্টে যোগাযোগ করুন' },
        { status: 403 }
      )
    }
    // Moderation closed loop: rejected / unpublished listings return to the
    // pending queue when the seller edits them ("require changes" flow —
    // the moderation note tells the seller what to fix).
    const reSubmitForReview = existing.status === 'rejected' || existing.status === 'unpublished'

    // ── Phase 2: seller role drives publish/unpublish + business listing fields ──
    const owner = await withSellerRoleColumns(async () =>
      db.user.findUnique({
        where: { id: userId },
        select: { isSeller: true, sellerDisabled: true, sellerRole: true, businessVerified: true },
      })
    )
    const businessSeller = isVerifiedBusinessSeller(owner)

    // ── Phase 9: a suspended seller can no longer modify listings ──
    if (owner?.sellerDisabled) {
      return NextResponse.json(
        { success: false, error: 'আপনার সেলার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে — পণ্য সম্পাদনা করতে পারবেন না' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { title, description, price, category, image, status, quantity, productType, options, isFree, fileKey, fileName, fileSize, fileType, itemType, condition, shippingInfo, digitalKind, deliveryDetails, images } = body

    // Item type is locked after creation (same rule as productType) — a
    // physical product can never silently become digital/service or back.
    const savedItemType = existing.itemType === 'physical' ? 'physical' : 'non_physical'
    if (itemType !== undefined && itemType !== null && itemType !== savedItemType) {
      return NextResponse.json(
        { success: false, error: 'পণ্যের ধরন পরিবর্তন করা যায় না — প্রয়োজনে পণ্যটি মুছে নতুন করে তৈরি করুন' },
        { status: 400 }
      )
    }
    const isPhysical = savedItemType === 'physical'

    // Title is locked after creation — sellers may only edit description,
    // price, category, image, status, quantity and (for multi) the options
    if (title !== undefined && title.trim() !== existing.title) {
      return NextResponse.json(
        { success: false, error: 'পণ্যের শিরোনাম পরিবর্তন করা যায় না' },
        { status: 400 }
      )
    }

    // Product type is locked after creation — prevents accidental destructive
    // conversions (multi → single would delete every option).
    if (productType !== undefined && productType !== existing.productType) {
      return NextResponse.json(
        { success: false, error: 'পণ্যের টাইপ পরিবর্তন করা যায় না — প্রয়োজনে পণ্যটি মুছে নতুন করে তৈরি করুন' },
        { status: 400 }
      )
    }

    const isMulti = existing.productType === 'multi'

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

    // Free toggle — free products are always price 0 (single products only).
    // Physical items can never be free — stock + shipping make no sense there.
    const freeNow = isFree !== undefined ? !!isFree : !!(existing as { isFree?: boolean }).isFree
    if (isFree !== undefined) {
      if (isPhysical && freeNow) {
        return NextResponse.json(
          { success: false, error: 'ফিজিক্যাল পণ্য ফ্রি হিসেবে দেওয়া যাবে না' },
          { status: 400 }
        )
      }
      data.isFree = freeNow
    }

    if (isMulti) {
      if (freeNow) {
        return NextResponse.json(
          { success: false, error: 'মাল্টি-অপশন পণ্য ফ্রি করা যায় না' },
          { status: 400 }
        )
      }
      // ── Multi-price product: price is derived from options, never from the client ──
      if (options !== undefined) {
        const result = validateOptions(options)
        if (!result.ok) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }
        // Atomic replace: wipe old options, recreate from the validated list.
        // Deals referencing removed options get productOptionId set to NULL (schema rule).
        data.options = {
          deleteMany: {},
          create: result.options,
        }
        data.price = Math.min(...result.options.map((o) => o.price))
      } else if (price !== undefined) {
        // Options not touched — client price is ignored for multi products.
        // Keep the stored price in sync with the current minimum option price.
        const currentOptions = await db.productOption.findMany({ where: { productId: id }, select: { price: true } })
        if (currentOptions.length > 0) {
          data.price = Math.min(...currentOptions.map((o) => o.price))
        }
      }
    } else {
      // ── Single product: free always wins over price; paid must be > 0 ──
      if (freeNow) {
        data.price = 0
      } else if (price !== undefined) {
        if (Number(price) <= 0) {
          return NextResponse.json(
            { success: false, error: 'মূল্য অবশ্যই শূন্যের বেশি হতে হবে' },
            { status: 400 }
          )
        }
        data.price = Number(price)
      } else if (Number(existing.price) === 0) {
        // switching free → paid without providing a price
        return NextResponse.json(
          { success: false, error: 'ফ্রি থেকে পেইড করতে মূল্য প্রদান করুন' },
          { status: 400 }
        )
      }
    }

    if (category !== undefined) {
      /* Shared whitelist (src/lib/product-categories.ts) — the old local 7-item
         list rejected every category added in Task 37, so saving an edit of a
         facebook/instagram/subscription/free_service product always 400'd */
      if (!isValidProductCategory(category)) {
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

    // ── Phase 2: gallery images (both item types) — replaces the stored list,
    // keeps the cover (`image`) in sync and cleans up removed R2 files.
    // VERIFIED BUSINESS SELLERS ONLY — gallery is a business listing feature. ──
    if (images !== undefined && businessSeller) {
      // The existing stored list (previous value) — for R2 cleanup
      const previousList = parseStoredImages((existing as { images?: string | null }).images)
      const gallery = sanitizeProductImages(images)
      data.images = gallery.length > 0 ? JSON.stringify(gallery) : null
      // Keep the cover in sync unless the client also sent an explicit `image`
      if (image === undefined) {
        const nextCover = gallery[0] ?? null
        data.image = nextCover
        if (existing.image && existing.image !== nextCover && !gallery.includes(existing.image)) {
          const { deleteFromR2 } = await import('@/lib/r2')
          await deleteFromR2(existing.image).catch(() => {})
        }
      }
      // Delete R2 files that were removed from the gallery
      const removed = previousList.filter((u) => u && !gallery.includes(u) && u !== data.image)
      for (const url of removed) {
        const { deleteFromR2 } = await import('@/lib/r2')
        await deleteFromR2(url).catch(() => {})
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          { success: false, error: 'অবৈধ স্ট্যাটাস' },
          { status: 400 }
        )
      }
      // ── Phase 2: publish/unpublish is a Verified Business Seller feature ──
      // Personal sellers can never self-activate a pending/rejected listing —
      // admin approval stays mandatory for them (this also closes the old
      // pending→active self-activation hole). 'sold' stays allowed (legacy).
      if ((status === 'active' || status === 'inactive') && !businessSeller) {
        return NextResponse.json(
          { success: false, error: 'পণ্য প্রকাশ/সরানোর জন্য ভেরিফায়েড বিজনেস সেলার হতে হবে' },
          { status: 403 }
        )
      }
      data.status = status
    }

    // ── Phase 9: moderation closed loop — override ANY client status ──
    if (reSubmitForReview) {
      data.status = 'pending'
    }

    if (quantity !== undefined) {
      const quantityNum = Math.floor(Number(quantity))
      // Physical: 0 allowed (sold out — orders can also drive it to 0).
      // Non-physical: historical ≥ 1 rule untouched.
      const minQty = isPhysical ? 0 : 1
      if (Number.isNaN(quantityNum) || quantityNum < minQty) {
        return NextResponse.json(
          { success: false, error: isPhysical ? 'স্টক অবশ্যই ০ বা তার বেশি হতে হবে' : 'কোয়ান্টিটি অবশ্যই ১ বা তার বেশি হতে হবে' },
          { status: 400 }
        )
      }
      data.quantity = quantityNum
    }

    // Physical-only attributes (Task 82). Non-physical rows keep them null.
    if (isPhysical) {
      if (condition !== undefined) {
        if (condition === null || condition === '') {
          data.condition = null
        } else if (isItemCondition(condition)) {
          data.condition = condition
        } else {
          return NextResponse.json(
            { success: false, error: 'অবৈধ পণ্যের অবস্থা' },
            { status: 400 }
          )
        }
      }
      if (shippingInfo !== undefined) {
        data.shippingInfo = sanitizeShippingInfo(shippingInfo)
      }
    } else if (businessSeller) {
      // ── Phase 2: digital classification + PRIVATE delivery details ──
      // Verified Business Seller feature — personal sellers' PATCHes ignore
      // these fields entirely (they keep their classic listing flow).
      if (digitalKind !== undefined) {
        if (digitalKind === null || digitalKind === '') {
          data.digitalKind = null
        } else if (typeof digitalKind === 'string' && VALID_DIGITAL_KINDS.includes(digitalKind as (typeof VALID_DIGITAL_KINDS)[number])) {
          data.digitalKind = digitalKind
        } else {
          return NextResponse.json(
            { success: false, error: 'অবৈধ ডিজিটাল পণ্যের ধরন' },
            { status: 400 }
          )
        }
      }
      if (deliveryDetails !== undefined) {
        // Private — owner/admin views only, never returned by public endpoints
        data.deliveryDetails = sanitizeListingText(deliveryDetails, 2000)
      }
    }

    // Digital file — attach / replace / remove. Physical products never
    // carry a digital file — the shipped item IS the deliverable.
    if (fileKey !== undefined && fileKey !== null && fileKey !== '' && isPhysical) {
      return NextResponse.json(
        { success: false, error: 'ফিজিক্যাল পণ্যে ডিজিটাল ফাইল যুক্ত করা যাবে না' },
        { status: 400 }
      )
    }
    if (fileKey !== undefined) {
      if (fileKey === null || fileKey === '') {
        // Removal
        data.fileKey = null
        data.fileName = null
        data.fileSize = null
        data.fileType = null
        if (existing.fileKey) {
          deleteFileByKey(existing.fileKey).catch(() => {})
        }
      } else if (typeof fileKey === 'string') {
        if (!ownsFileKey(fileKey, userId)) {
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
        data.fileKey = fileKey
        data.fileName = fileName.slice(0, 255)
        data.fileSize = Math.min(Math.floor(fileSize), MAX_DIGITAL_FILE_SIZE)
        data.fileType = typeof fileType === 'string' ? fileType.slice(0, 100) : null
        // Replace → clean up the previous file (best effort)
        if (existing.fileKey && existing.fileKey !== fileKey) {
          deleteFileByKey(existing.fileKey).catch(() => {})
        }
      }
    }

    let product
    try {
      product = await db.digitalProduct.update({
        where: { id },
        data: data as never,
        include: {
          seller: {
            select: { name: true, imageLink: true },
          },
          options: OPTIONS_SELECT,
        },
      })
    } catch (err) {
      if (!isMissingColumnError(err, 'quantity') && !isMissingProductOptionsSupportError(err) && !isMissingColumnError(err, 'fileKey')) throw err
      // quantity/productType/ProductOption/file columns not migrated yet — updateMany
      // (no RETURNING clause), then read back without the unsupported fields
      const fallbackData = { ...data }
      delete fallbackData.quantity
      delete fallbackData.options
      delete fallbackData.productType
      delete fallbackData.isFree
      delete fallbackData.fileKey
      delete fallbackData.fileName
      delete fallbackData.fileSize
      delete fallbackData.fileType
      delete fallbackData.digitalKind
      delete fallbackData.deliveryDetails
      delete fallbackData.images
      if (Object.keys(fallbackData).length > 0) {
        await db.digitalProduct.updateMany({ where: { id }, data: fallbackData })
      }
      product = await db.digitalProduct.findUnique({
        where: { id },
        select: {
          id: true, title: true, description: true, price: true, category: true, image: true,
          status: true, createdAt: true, updatedAt: true,
          seller: { select: { name: true, imageLink: true } },
        },
      })
    }

    const updatedOptions = ((product as { options?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[] }).options) ?? []
    const updatedIsMulti = (product as { productType?: string }).productType === 'multi' && updatedOptions.length > 0
    const range = priceRangeFromPrices(updatedOptions.length > 0 ? updatedOptions.map((o) => o.price) : [product.price])

    // Phase 9: moderated listing resubmitted — let admins know a review is waiting
    if (reSubmitForReview) {
      notifyAdmins({
        type: 'product_resubmitted',
        title: 'পণ্য পুনরায় রিভিউয়ের অপেক্ষায়',
        message: `সেলার মডারেশন নোট অনুযায়ী পণ্যটি সংশোধন করেছেন — "${existing.title}" এখন রিভিউয়ের অপেক্ষায়।`,
        relatedType: 'product_moderation',
        relatedId: id,
        pushUrl: '/admin',
      }).catch(() => {})
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
        quantity: (product as { quantity?: number }).quantity ?? DEFAULT_PRODUCT_QUANTITY,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        productType: updatedIsMulti ? 'multi' : 'single',
        options: updatedIsMulti ? updatedOptions : [],
        optionsCount: updatedOptions.length,
        minPrice: updatedIsMulti ? range.min : product.price,
        maxPrice: updatedIsMulti ? range.max : product.price,
        isFree: (product as { isFree?: boolean }).isFree ?? false,
        hasFile: !!(product as { fileName?: string | null }).fileName,
        fileName: (product as { fileName?: string | null }).fileName ?? null,
        fileSize: (product as { fileSize?: number | null }).fileSize ?? null,
        fileType: (product as { fileType?: string | null }).fileType ?? null,
        // Phase 2 fields — PATCH is owner-only, so deliveryDetails is safe here
        itemType: (product as { itemType?: string }).itemType === 'physical' ? 'physical' : 'non_physical',
        digitalKind: (product as { digitalKind?: string | null }).digitalKind ?? null,
        images: parseStoredImages((product as { images?: string | null }).images),
        deliveryDetails: (product as { deliveryDetails?: string | null }).deliveryDetails ?? null,
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
      select: { sellerId: true, image: true, fileKey: true, images: true },
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

    // Delete R2 images (cover + gallery, deduped)
    const galleryList = parseStoredImages(existing.images)
    const imagesToDelete = Array.from(new Set([existing.image, ...galleryList].filter((u): u is string => !!u)))
    if (imagesToDelete.length > 0) {
      const { deleteFromR2 } = await import('@/lib/r2')
      for (const url of imagesToDelete) {
        await deleteFromR2(url).catch(() => {})
      }
    }

    // ProductOption rows are removed automatically (onDelete: Cascade)
    // Delete attached digital file if exists
    if (existing.fileKey) {
      deleteFileByKey(existing.fileKey).catch(() => {})
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
