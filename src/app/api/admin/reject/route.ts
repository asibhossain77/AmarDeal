import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { dealId, reason } = await req.json()

    if (!dealId) {
      return NextResponse.json({ error: 'ডিল আইডি প্রদান করুন' }, { status: 400 })
    }

    if (reason !== 'wrong_info' && reason !== 'cancel') {
      return NextResponse.json({ error: 'অবৈধ রিজেক্ট কারণ' }, { status: 400 })
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

    // Final statuses that cannot be rejected
    const finalStatuses = ['completed', 'rejected', 'cancelled']
    if (finalStatuses.includes(deal.status)) {
      return NextResponse.json(
        { error: 'এই ডিল আর বাতিল করা যাবে না' },
        { status: 400 }
      )
    }

    let updated

    if (reason === 'wrong_info') {
      // Wrong info: reset deal to 'created' so buyer can re-submit payment
      // Clear payment details so buyer starts fresh
      updated = await db.deal.update({
        where: { id: dealId },
        data: {
          status: 'created',
          rejectionReason: 'wrong_info',
          senderNumber: null,
          transactionId: null,
          paymentAmount: null,
          platformFee: null,
          paymentMethodId: null,
        },
        include: {
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true, email: true } },
        },
      })
    } else {
      // Cancel: deal is voided/batil — buyer can request refund if payment was made
      updated = await db.deal.update({
        where: { id: dealId },
        data: {
          status: 'cancelled',
          rejectionReason: 'cancelled_by_admin',
        },
        include: {
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true, email: true } },
        },
      })
    }

    // Send notifications
    const notifyParties = [
      { userId: deal.buyerId },
      ...(deal.sellerId ? [{ userId: deal.sellerId }] : []),
    ]

    const notifType = reason === 'wrong_info' ? 'payment_wrong_info' : 'deal_cancelled'
    const notifTitle = reason === 'wrong_info' ? 'পেমেন্ট তথ্য ভুল' : 'ডিল বাতিল'
    const notifMessage = reason === 'wrong_info'
      ? `"${deal.title}" ডিলে পেমেন্ট তথ্য ভুল পাওয়া গেছে। অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার পেমেন্ট করুন।`
      : `"${deal.title}" ডিলটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে।`

    for (const party of notifyParties) {
      if (!party.userId) continue
      await db.notification.create({
        data: {
          userId: party.userId,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          dealId: deal.id,
        },
      })

      try {
        await fetch(`http://localhost:3004/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: party.userId,
            notification: {
              type: notifType,
              title: notifTitle,
              message: notifMessage,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch (err) {
    console.error('Reject API error:', err)
    return NextResponse.json({ error: 'বাতিল করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}