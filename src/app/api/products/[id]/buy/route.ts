import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { sendEmail, dealCreatedEmail, adminNewDealEmail } from '@/lib/email'
import { sendWhatsApp, dealCreatedWa, adminNewDealWa } from '@/lib/whatsapp'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { id: productId } = await params
    const body = await req.json().catch(() => ({}))
    const { optionId } = body as { optionId?: string }

    // Fetch the product with seller info
    const product = await db.digitalProduct.findUnique({
      where: { id: productId },
      include: { seller: { select: { id: true, name: true, email: true, phone: true } } },
    })

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { error: 'পণ্য পাওয়া যায়নি বা নিষ্ক্রিয় করা হয়েছে' },
        { status: 404 },
      )
    }

    if (product.sellerId === userId) {
      return NextResponse.json(
        { error: 'আপনি নিজের পণ্য কিনতে পারবেন না' },
        { status: 400 },
      )
    }

    // Multi-price products: verify the option server-side and use ITS price —
    // never the product-level fallback price.
    let unitPrice = product.price
    let verifiedOptionId: string | null = null
    let dealTitle = product.title
    if (product.productType === 'multi') {
      if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json(
          { error: 'অনুগ্রহ করে একটি অপশন/প্যাকেজ নির্বাচন করুন' },
          { status: 400 },
        )
      }
      const option = await db.productOption.findUnique({ where: { id: optionId } })
      if (!option || option.productId !== product.id) {
        return NextResponse.json(
          { error: 'অবৈধ অপশন — এটি এই পণ্যের কোনো অপশন নয়' },
          { status: 400 },
        )
      }
      if (!option.isAvailable || !(option.price > 0)) {
        return NextResponse.json(
          { error: 'এই অপশনটি বর্তমানে অর্ডারযোগ্য নয়' },
          { status: 400 },
        )
      }
      unitPrice = option.price
      verifiedOptionId = option.id
      dealTitle = `${product.title} — ${option.name}`
    }

    // Create the deal automatically
    const deal = await db.deal.create({
      data: {
        title: dealTitle,
        amount: unitPrice,
        status: 'created',
        buyerId: userId,
        sellerId: product.sellerId,
        creatorId: userId,
        terms: product.description || null,
        productId: product.id,
        productOptionId: verifiedOptionId,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    // ── Notification for seller ──
    const notifMessage = `ক্রেতা হিসেবে আপনাকে একটি নতুন ডিল পাঠানো হয়েছে: "${product.title}" (মার্কেটপ্লেস)`
    await db.notification.create({
      data: {
        userId: product.sellerId,
        type: 'deal_request',
        title: 'নতুন ডিল অনুরোধ (মার্কেটপ্লেস)',
        message: notifMessage,
        dealId: deal.id,
      },
    })

    // WebSocket notification
    try {
      await fetch('http://localhost:3004/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: product.sellerId,
          notification: {
            id: deal.id + '-notif',
            type: 'deal_request',
            title: 'নতুন ডিল অনুরোধ (মার্কেটপ্লেস)',
            message: notifMessage,
            dealId: deal.id,
            createdAt: new Date().toISOString(),
          },
        }),
      })
    } catch {
      // WebSocket notification failed silently
    }

    // Email to seller
    if (product.seller.email) {
      sendEmail(product.seller.email, () => dealCreatedEmail(
        product.seller.name || 'সেলার',
        deal.title,
        deal.amount,
        deal.buyer?.name || 'একজন ক্রেতা',
        'buyer',
      ), 'deal_created').catch(() => {})
    }

    // WhatsApp to seller
    if (product.seller.phone) {
      sendWhatsApp(product.seller.phone, () => ({
        body: dealCreatedWa(
          product.seller.name || 'সেলার',
          deal.title,
          deal.amount,
          deal.buyer?.name || 'একজন ক্রেতা',
          'buyer',
        ),
      }), 'deal_created').catch(() => {})
    }

    // Email + WhatsApp to admin
    try {
      const adminUser = await db.user.findFirst({
        where: { admin: { isNot: null } },
        select: { name: true, email: true, phone: true },
      })
      if (adminUser?.email) {
        sendEmail(adminUser.email, () => adminNewDealEmail(
          adminUser.name || 'অ্যাডমিন',
          deal.title,
          `৳${deal.amount.toLocaleString('en')}`,
          deal.buyer?.name || '-',
          deal.seller?.name || '-',
        ), 'deal_created').catch(() => {})
      }
      if (adminUser?.phone) {
        sendWhatsApp(adminUser.phone, () => ({
          body: adminNewDealWa(
            adminUser.name || 'অ্যাডমিন',
            deal.title,
            `৳${deal.amount.toLocaleString('en')}`,
            deal.buyer?.name || '-',
            deal.seller?.name || '-',
          ),
        }), 'deal_created').catch(() => {})
      }
    } catch { /* silent */ }

    return NextResponse.json({
      success: true,
      deal: {
        id: deal.id,
        title: deal.title,
        amount: deal.amount,
        status: deal.status,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
        creatorId: deal.creatorId,
        buyerName: deal.buyer?.name,
        sellerName: deal.seller?.name,
        createdAt: deal.createdAt,
      },
    })
  } catch (err) {
    console.error('[BUY PRODUCT ERROR]', err)
    return NextResponse.json(
      { error: 'পণ্য কেনার ডিল তৈরিতে সমস্যা হয়েছে' },
      { status: 500 },
    )
  }
}
