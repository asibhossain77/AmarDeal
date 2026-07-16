import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, payoutRequestedEmail } from '@/lib/email'
import { requireDealAccess } from '@/lib/deal-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params

    const guard = await requireDealAccess(req, dealId)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { accountType, accountNumber, accountName } = body

    if (!accountType || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'অ্যাকাউন্টের তথ্য সম্পূর্ণ দিন' },
        { status: 400 }
      )
    }

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    let payoutType: string | null = null

    if (deal.status === 'completed' && deal.sellerId === userId) {
      payoutType = 'seller_payout'
    } else if (deal.status === 'cancelled' && deal.buyerId === userId) {
      // Refund only for cancelled deals — rejected deals mean wrong/invalid transaction
      payoutType = 'buyer_refund'
    } else if (deal.status === 'rejected' && deal.buyerId === userId) {
      // Admin rejected the payment — buyer cannot get refund (wrong/invalid transaction)
      return NextResponse.json(
        { error: 'অ্যাডমিন পেমেন্ট রিজেক্ট করেছেন। ভুল ট্রানজাকশনের কারণে রিফান্ড প্রযোজ্য নয়।' },
        { status: 403 }
      )
    }

    if (!payoutType) {
      return NextResponse.json(
        { error: 'পেআউটের অনুমতি নেই' },
        { status: 403 }
      )
    }

    // Check if payout already exists
    const existingPayout = await db.payout.findFirst({
      where: {
        dealId: deal.id,
        type: payoutType,
        recipientId: userId,
      },
    })

    if (existingPayout) {
      return NextResponse.json(
        { error: 'এই ডিলের জন্য ইতিমধ্যে পেআউট অনুরোধ করা হয়েছে' },
        { status: 400 }
      )
    }

    // Calculate amount (use admin-updated paymentAmount if available)
    const baseAmount = deal.paymentAmount || deal.amount
    let amount: number
    if (payoutType === 'buyer_refund') {
      amount = baseAmount
    } else {
      amount = baseAmount - (deal.platformFee || 0)
    }

    // Get user email for notification
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })

    const payout = await db.payout.create({
      data: {
        dealId: deal.id,
        type: payoutType,
        recipientId: userId,
        amount,
        accountType,
        accountNumber,
        accountName,
      },
    })

    // Email: payout/refund requested
    if (user?.email) {
      sendEmail(user.email, payoutRequestedEmail(
        user.name || 'ইউজার',
        deal.title,
        amount,
        accountType,
        accountNumber,
        payoutType as 'seller_payout' | 'buyer_refund',
      )).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message:
        payoutType === 'seller_payout'
          ? 'পেআউট অনুরোধ সফলভাবে জমা হয়েছে'
          : 'ফেরতের অনুরোধ সফলভাবে জমা হয়েছে',
      payout,
    })
  } catch {
    return NextResponse.json(
      { error: 'পেআউট অনুরোধ করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}