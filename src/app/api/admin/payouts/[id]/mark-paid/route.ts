import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { id } = await params

    const payout = await db.payout.findUnique({ where: { id } })

    if (!payout) {
      return NextResponse.json({ error: 'পেআউট পাওয়া যায়নি' }, { status: 404 })
    }

    if (payout.status === 'paid') {
      return NextResponse.json({ error: 'ইতিমধ্যে পেমেন্ট সম্পন্ন হয়েছে' }, { status: 400 })
    }

    const deal = await db.deal.findUnique({
      where: { id: payout.dealId },
      select: { id: true, title: true },
    })

    const updated = await db.payout.update({
      where: { id },
      data: { status: 'paid' },
    })

    // Create system chat message in deal
    if (deal) {
      const isRefund = payout.type === 'buyer_refund'
      const msg = isRefund
        ? `অ্যাডমিন ফেরতের পেমেন্ট সম্পন্ন করেছেন। ৳${payout.amount.toLocaleString('bn-BD')} ${payout.accountType} একাউন্টে (নম্বর: ${payout.accountNumber}) পাঠানো হয়েছে।`
        : `অ্যাডমিন পেআউট সম্পন্ন করেছেন। ৳${payout.amount.toLocaleString('bn-BD')} ${payout.accountType} একাউন্টে (নম্বর: ${payout.accountNumber}) পাঠানো হয়েছে।`

      await db.chatMessage.create({
        data: {
          dealId: deal.id,
          role: 'system',
          message: msg,
        },
      })
    }

    return NextResponse.json({ success: true, payout: updated })
  } catch {
    return NextResponse.json(
      { error: 'পেমেন্ট আপডেট করতে সমস্যা' },
      { status: 500 }
    )
  }
}