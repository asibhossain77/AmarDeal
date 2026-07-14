import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sendEmail, paymentSubmittedEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { dealId, paymentMethodId, senderNumber, transactionId, amount, fee } = body

    if (!dealId || !senderNumber || !transactionId) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

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

    // Calculate fee from tiered structure if not provided
    let platformFee = fee ?? null
    if (platformFee === null && existing.amount) {
      const rules = await db.feeRule.findMany({
        where: { is_active: true },
        orderBy: { minimum_amount: 'asc' },
      })
      for (const rule of rules) {
        if (existing.amount >= rule.minimum_amount) {
          if (rule.maximum_amount === 0 || existing.amount <= rule.maximum_amount) {
            platformFee = rule.fee
            break
          }
        }
      }
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
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    // Email: payment submitted notification
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, paymentSubmittedEmail(deal.buyer.name || 'ক্রেতা', deal.title, deal.amount || 0)).catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, paymentSubmittedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.amount || 0)).catch(() => {})
    }

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