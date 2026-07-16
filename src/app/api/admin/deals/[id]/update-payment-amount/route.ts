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
    const { paymentAmount } = await req.json()

    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      return NextResponse.json(
        { error: 'সঠিক পেমেন্টের পরিমাণ দিন' },
        { status: 400 }
      )
    }

    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'payment_pending') {
      return NextResponse.json(
        { error: `শুধুমাত্র পেমেন্ট পেন্ডিং ডিলের পরিমাণ আপডেট করা যায় (বর্তমান অবস্থা: ${deal.status})` },
        { status: 400 }
      )
    }

    const newAmount = Number(paymentAmount)

    // Recalculate platform fee based on the new payment amount
    let platformFee = deal.platformFee
    if (deal.amount) {
      const rules = await db.feeRule.findMany({
        where: { is_active: true },
        orderBy: { minimum_amount: 'asc' },
      })
      for (const rule of rules) {
        if (deal.amount >= rule.minimum_amount) {
          if (rule.maximum_amount === 0 || deal.amount <= rule.maximum_amount) {
            platformFee = rule.fee
            break
          }
        }
      }
    }

    const updated = await db.deal.update({
      where: { id },
      data: {
        paymentAmount: newAmount,
        platformFee,
      },
      include: {
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json(
      { error: 'পেমেন্টের পরিমাণ আপডেট করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}