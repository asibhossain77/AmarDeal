import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, payoutRequestedEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params

    const body = await req.json()
    const { userId, accountType, accountNumber, accountName } = body

    if (!userId) {
      return NextResponse.json({ error: 'ইউজার আইডি প্রয়োজন' }, { status: 400 })
    }

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
    } else if (
      (deal.status === 'cancelled' || deal.status === 'rejected') &&
      deal.buyerId === userId
    ) {
      // Block refund only for wrong_info — buyer didn't actually pay, just submitted wrong info
      if (deal.rejectionReason === 'wrong_info') {
        return NextResponse.json(
          { error: 'এই ডিলে রিফান্ডের অনুমতি নেই' },
          { status: 403 }
        )
      }
      payoutType = 'buyer_refund'
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

    // Calculate amount
    let amount: number
    if (payoutType === 'buyer_refund') {
      amount = deal.paymentAmount || deal.amount
    } else {
      amount = deal.amount - (deal.platformFee || 0)
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