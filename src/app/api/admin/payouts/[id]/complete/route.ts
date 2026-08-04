import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { sendEmail, payoutCompletedEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.response

    // Verify admin
    const admin = await db.admin.findUnique({
      where: { userId: auth.userId },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'অ্যাডমিন অনুমোদন নেই', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { id: payoutId } = await params

    const existing = await db.payout.findUnique({
      where: { id: payoutId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'পেআউট পাওয়া যায়নি', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (existing.status === 'paid') {
      return NextResponse.json(
        { error: 'এই পেআউট ইতিমধ্যে পরিশোধ হয়েছে', code: 'ALREADY_PAID' },
        { status: 400 }
      )
    }

    const payout = await db.payout.update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    })

    // Email: payout completed
    const deal = await db.deal.findUnique({
      where: { id: payout.dealId },
      select: { id: true, title: true },
    })
    const recipient = await db.user.findUnique({
      where: { id: payout.recipientId },
      select: { email: true, name: true },
    })
    if (recipient?.email && deal) {
      sendEmail(recipient.email, () => payoutCompletedEmail(
        recipient.name || 'ইউজার',
        deal.title,
        payout.amount,
        payout.accountType || '',
        payout.accountNumber || '',
        payout.type as 'seller_payout' | 'buyer_refund',
      ), 'payout_completed').catch(() => {})
    }

    return NextResponse.json({ payout, success: true })
  } catch {
    return NextResponse.json(
      { error: 'পেআউট সম্পূর্ণ করতে সমস্যা' },
      { status: 500 }
    )
  }
}