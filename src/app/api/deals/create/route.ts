import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCreatedEmail, adminNewDealEmail } from '@/lib/email'
import { sendWhatsApp, dealCreatedWa, adminNewDealWa } from '@/lib/whatsapp'
import { requireAuth } from '@/lib/deal-guard'
import { notifyUser, notifyAdmins } from '@/lib/push'

const MAX_ORDER_QTY = 99

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { title, role, amount, partyEmail, terms, productId, optionId, quantity } = body

    // ────────────────────────────────────────────────────────────────────
    // Product-verified order path (marketplace Buy Now flow).
    // The client sends WHICH product/option/quantity it wants — never a
    // trusted price. The server re-reads everything from the database and
    // computes the final amount itself. A client-submitted amount is ignored.
    // ────────────────────────────────────────────────────────────────────
    if (productId) {
      if (role && role !== 'buyer') {
        return NextResponse.json(
          { error: 'পণ্য অর্ডার করতে হলে আপনাকে ক্রেতা হিসেবে ডিল তৈরি করতে হবে' },
          { status: 400 }
        )
      }

      // 1. Fetch the actual product from the database
      const product = await db.digitalProduct.findUnique({
        where: { id: String(productId) },
        include: { seller: { select: { id: true, name: true, email: true } } },
      })
      if (!product) {
        return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
      }

      // 2. Only active (admin-approved) products can be ordered
      if (product.status !== 'active') {
        return NextResponse.json({ error: 'এই পণ্যটি বর্তমানে অর্ডারযোগ্য নয়' }, { status: 400 })
      }

      // 3. Prevent self-ordering
      if (product.sellerId === userId) {
        return NextResponse.json({ error: 'আপনি নিজের পণ্য অর্ডার করতে পারবেন না' }, { status: 400 })
      }

      // 4. Verify quantity bounds
      const qty = quantity === undefined || quantity === null || quantity === '' ? 1 : Math.floor(Number(quantity))
      if (Number.isNaN(qty) || qty < 1 || qty > MAX_ORDER_QTY) {
        return NextResponse.json(
          { error: `পরিমাণ অবশ্যই ১ থেকে ${MAX_ORDER_QTY} এর মধ্যে হতে হবে` },
          { status: 400 }
        )
      }

      // 5. Resolve the real unit price from the database
      let unitPrice: number
      let verifiedOptionId: string | null = null
      let verifiedTitle: string

      if (product.productType === 'multi') {
        // Multi-price product: optionId is REQUIRED and must belong to THIS product
        if (!optionId || typeof optionId !== 'string') {
          return NextResponse.json(
            { error: 'অনুগ্রহ করে একটি অপশন/প্যাকেজ নির্বাচন করুন' },
            { status: 400 }
          )
        }
        const option = await db.productOption.findUnique({ where: { id: optionId } })
        // Verify the option belongs to this product (blocks cross-product option injection)
        if (!option || option.productId !== product.id) {
          return NextResponse.json(
            { error: 'অবৈধ অপশন — এটি এই পণ্যের কোনো অপশন নয়' },
            { status: 400 }
          )
        }
        if (!option.isAvailable) {
          return NextResponse.json({ error: 'এই অপশনটি বর্তমানে অর্ডারযোগ্য নয়' }, { status: 400 })
        }
        if (!(option.price > 0)) {
          return NextResponse.json({ error: 'অবৈধ অপশন মূল্য' }, { status: 400 })
        }
        unitPrice = option.price
        verifiedOptionId = option.id
        verifiedTitle = qty > 1 ? `${product.title} — ${option.name} (×${qty})` : `${product.title} — ${option.name}`
      } else {
        // Single product: fixed price from the DB, optionId (if any) is ignored
        if (!(product.price > 0)) {
          return NextResponse.json({ error: 'অবৈধ পণ্য মূল্য' }, { status: 400 })
        }
        unitPrice = product.price
        verifiedTitle = qty > 1 ? `${product.title} (×${qty})` : product.title
      }

      // 6. Final amount is computed ON THE SERVER
      const finalAmount = Math.round(unitPrice * qty * 100) / 100

      // 7. Counterparty is the product's seller (from the DB, not from the client)
      const sellerUser = product.seller
      if (!sellerUser) {
        return NextResponse.json({ error: 'বিক্রেতা পাওয়া যায়নি' }, { status: 404 })
      }

      const deal = await db.deal.create({
        data: {
          title: verifiedTitle,
          amount: finalAmount,
          status: 'created',
          buyerId: userId,
          sellerId: sellerUser.id,
          creatorId: userId,
          terms: terms ? String(terms) : null,
          productId: product.id,
          productOptionId: verifiedOptionId,
        },
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      // ── Post-creation tasks (notifications, emails) are fire-and-forget ──
      ;(async () => {
        try {
          const notifMessage = `আপনার পণ্যের জন্য একটি নতুন অর্ডার (ডিল) এসেছে: "${deal.title}"`
          await notifyUser({
            userId: sellerUser.id,
            dealId: deal.id,
            type: 'deal_request',
            title: 'নতুন অর্ডার',
            message: notifMessage,
            pushUrl: '/dashboard',
          }).catch(() => {})

          await notifyAdmins({
            dealId: deal.id,
            type: 'deal_request',
            title: 'নতুন অর্ডার',
            message: `মার্কেটপ্লেসে নতুন অর্ডার: ${deal.title} (৳${deal.amount.toLocaleString('en')})`,
          }).catch(() => {})

          if (sellerUser.email) {
            sendEmail(sellerUser.email, () => dealCreatedEmail(
              sellerUser.name || 'ইউজার',
              deal.title,
              deal.amount,
              deal.creator?.name || 'একজন ইউজার',
              'seller',
            ), 'deal_created').catch((e) => console.error('[DEAL CREATE] seller email error:', e))
          }
        } catch (e) {
          console.error('[DEAL CREATE] Post-creation notification error:', e)
        }
      })()

      return NextResponse.json({
        id: deal.id,
        title: deal.title,
        amount: deal.amount,
        status: deal.status,
        buyerName: deal.buyer?.name,
        sellerName: deal.seller?.name,
        createdAt: deal.createdAt,
      })
    }

    // ────────────────────────────────────────────────────────────────────
    // Legacy manual deal path (unchanged behavior)
    // ────────────────────────────────────────────────────────────────────
    if (!title || !amount || !partyEmail) {
      return NextResponse.json(
        { error: 'সকল প্রয়োজনীয় তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (!role || (role !== 'buyer' && role !== 'seller')) {
      return NextResponse.json(
        { error: 'ভূমিকা নির্বাচন করুন' },
        { status: 400 }
      )
    }

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'পরিমাণ অবশ্যই শূন্যের বেশি হতে হবে' },
        { status: 400 }
      )
    }

    // Find counterparty by email or phone
    const counterparty = await db.user.findFirst({
      where: {
        OR: [
          { email: partyEmail },
          { phone: partyEmail },
        ],
      },
    })

    if (!counterparty) {
      return NextResponse.json(
        { error: 'এই ইমেইল/ফোন নম্বরে কোনো ইউজার পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    if (counterparty.id === userId) {
      return NextResponse.json(
        { error: 'আপনি নিজের সাথে ডিল তৈরি করতে পারবেন না' },
        { status: 400 }
      )
    }

    // Determine buyer and seller based on role
    const isCreatorBuyer = role === 'buyer'
    const buyerId = isCreatorBuyer ? userId : counterparty.id
    const sellerId = isCreatorBuyer ? counterparty.id : userId

    const deal = await db.deal.create({
      data: {
        title: String(title),
        amount: numAmount,
        status: 'created',
        buyerId,
        sellerId,
        creatorId: userId,
        terms: terms ? String(terms) : null,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    // ── All post-creation tasks (notifications, emails) are fire-and-forget ──
    // Wrapped in a single async IIFE so nothing can crash the response.
    ;(async () => {
      try {
        // Unified notification (DB + WebSocket + Push) for the counterparty
        const notifMessage = `${isCreatorBuyer ? 'ক্রেতা' : 'বিক্রেতা'} হিসেবে আপনাকে একটি নতুন ডিল পাঠানো হয়েছে: "${deal.title}"`
        await notifyUser({
          userId: counterparty.id,
          dealId: deal.id,
          type: 'deal_request',
          title: 'নতুন ডিল অনুরোধ',
          message: notifMessage,
          pushUrl: '/dashboard',
        }).catch(() => {})

        // Notify admins
        await notifyAdmins({
          dealId: deal.id,
          type: 'deal_request',
          title: 'নতুন ডিল',
          message: `${deal.creator?.name || 'একজন ইউজার'} একটি নতুন ডিল তৈরি করেছে: ${deal.title} (৳${deal.amount.toLocaleString('en')})`,
        }).catch(() => {})

        // Email + WhatsApp to counterparty
        if (counterparty.email) {
          sendEmail(counterparty.email, () => dealCreatedEmail(
            counterparty.name || 'ইউজার',
            deal.title,
            deal.amount,
            deal.creator?.name || 'একজন ইউজার',
            isCreatorBuyer ? 'buyer' : 'seller',
          ), 'deal_created').catch((e) => console.error('[DEAL CREATE] counterparty email error:', e))
        }
        if (counterparty.phone) {
          sendWhatsApp(counterparty.phone, () => ({
            body: dealCreatedWa(
              counterparty.name || 'ইউজার',
              deal.title,
              deal.amount,
              deal.creator?.name || 'একজন ইউজার',
              isCreatorBuyer ? 'buyer' : 'seller',
            ),
          }), 'deal_created').catch((e) => console.error('[DEAL CREATE] counterparty wa error:', e))
        }

        // Admin email/WhatsApp
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
              deal.creator?.name || 'একজন ইউজার',
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
                deal.creator?.name || 'একজন ইউজার',
                deal.buyer?.name || '-',
                deal.seller?.name || '-',
              ),
            }), 'deal_created').catch(() => {})
          }
        } catch { /* admin notify failed silently */ }
      } catch (e) {
        console.error('[DEAL CREATE] Post-creation notification error:', e)
      }
    })()

    return NextResponse.json({
      id: deal.id,
      title: deal.title,
      amount: deal.amount,
      status: deal.status,
      buyerName: deal.buyer?.name,
      sellerName: deal.seller?.name,
      createdAt: deal.createdAt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DEAL CREATE] Error:', msg)
    if (msg.includes('no such column') || msg.includes('no such table')) {
      console.error('[DEAL CREATE] DB SCHEMA MISMATCH — run: npx prisma db push')
    }
    return NextResponse.json(
      { error: 'ডিল তৈরিতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
