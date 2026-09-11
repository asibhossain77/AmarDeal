import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, paymentSubmittedEmail } from '@/lib/email'
import { sendWhatsApp, paymentSubmittedWa } from '@/lib/whatsapp'
import { requireDealAccess } from '@/lib/deal-guard'
import { notifyUser, notifyAdmins } from '@/lib/push'
import { calculateDealFee } from '@/lib/fee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dealId, paymentMethodId, senderNumber, transactionId, amount, fee } = body

    if (!dealId || !senderNumber || !transactionId) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    const guard = await requireDealAccess(req, dealId)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Check deal exists and is in correct state
    const existing = await db.deal.findUnique({ where: { id: dealId } })
    if (!existing) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }
    if (existing.status !== 'created') {
      return NextResponse.json(
        { error: 'এই ডিলে পেমেন্ট করা সম্ভব নয়' },
        { status: 400 }
      )
    }

    // Check if this transaction ID is already used in ANY other deal
    const duplicateTxn = await db.deal.findFirst({
      where: {
        transactionId: transactionId.trim(),
        id: { not: dealId },
      },
    })
    if (duplicateTxn) {
      return NextResponse.json(
        { error: 'এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে। অনুগ্রহ করে নতুন ট্রানজেকশন আইডি দিন।' },
        { status: 409 }
      )
    }

    // Calculate fee from shared logic (free threshold -> tier rules -> % fallback) if not provided
    let platformFee = fee ?? null
    if (platformFee === null && existing.amount) {
      platformFee = (await calculateDealFee(existing.amount)).fee
    }

    // Update deal status and store payment details
    const deal = await db.deal.update({
      where: { id: dealId },
      data: {
        status: 'payment_pending',
        paymentMethodId: paymentMethodId || null,
        senderNumber,
        transactionId,
        paymentAmount: amount || null,
        platformFee,
      },
      include: {
        buyer: { select: { name: true, email: true, phone: true } },
        seller: { select: { name: true, email: true, phone: true } },
      },
    })

    // Email: payment submitted notification
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, () => paymentSubmittedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0), 'payment_submitted').catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, () => paymentSubmittedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0), 'payment_submitted').catch(() => {})
    }

    // WhatsApp: payment submitted notification
    if (deal.buyer?.phone) {
      sendWhatsApp(deal.buyer.phone, () => ({ body: paymentSubmittedWa(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0) }), 'payment_submitted').catch(() => {})
    }
    if (deal.seller?.phone) {
      sendWhatsApp(deal.seller.phone, () => ({ body: paymentSubmittedWa(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0) }), 'payment_submitted').catch(() => {})
    }

    // Push notification to seller + admin
    if (deal.sellerId) {
      await notifyUser({
        userId: deal.sellerId,
        dealId: deal.id,
        type: 'payment_verified',
        title: 'পেমেন্ট জমা হয়েছে',
        message: `"${deal.title}" ডিলে পেমেন্ট জমা হয়েছে। অ্যাডমিন ভেরিফিকেশনের অপেক্ষায়।`,
        pushUrl: '/dashboard',
      }).catch(() => {})
    }
    await notifyAdmins({
      dealId: deal.id,
      type: 'payment_pending',
      title: 'নতুন পেমেন্ট',
      message: `"${deal.title}" ডিলে ৳${deal.amount?.toLocaleString('en')} পেমেন্ট জমা হয়েছে। ভেরিফিকেশন প্রয়োজন।`,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'পেমেন্ট সফলভাবে জমা হয়েছে',
      deal,
    })
  } catch {
    return NextResponse.json(
      { error: 'পেমেন্ট জমা করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}