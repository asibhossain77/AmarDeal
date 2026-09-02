import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCreatedEmail, adminNewDealEmail } from '@/lib/email'
import { sendWhatsApp, dealCreatedWa, adminNewDealWa } from '@/lib/whatsapp'
import { requireAuth } from '@/lib/deal-guard'
import { notifyUser, notifyAdmins } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { title, role, amount, partyEmail, terms } = body

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
