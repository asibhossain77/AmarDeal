import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, disputeRaisedEmail, adminDisputeEmail } from '@/lib/email'
import { requireDealAccess } from '@/lib/deal-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const deal = await db.deal.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (deal.status !== 'in_delivery') {
      return NextResponse.json(
        { error: 'শুধুমাত্র ডেলিভারি চলমান ডিলে বিরোধ দায়ের করা যাবে' },
        { status: 400 }
      )
    }

    if (deal.buyerId !== userId) {
      return NextResponse.json({ error: 'আপনি এই ডিলের ক্রেতা নন' }, { status: 403 })
    }

    const updated = await db.deal.update({
      where: { id },
      data: { status: 'disputed' },
    })

    // Notify seller about dispute
    if (deal.sellerId) {
      await db.notification.create({
        data: {
          userId: deal.sellerId,
          type: 'deal_disputed',
          title: 'ডিলে বিরোধ দায়ের',
          message: `"${deal.title}" ডিলে ক্রেতা বিরোধ দায়ের করেছেন। অ্যাডমিন পর্যালোচনা করবেন।`,
          dealId: deal.id,
        },
      })

      try {
        await fetch(`http://localhost:3004/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: deal.sellerId,
            notification: {
              type: 'deal_disputed',
              title: 'ডিলে বিরোধ দায়ের',
              message: `"${deal.title}" ডিলে বিরোধ দায়ের করা হয়েছে।`,
              dealId: deal.id,
              createdAt: new Date().toISOString(),
            },
          }),
        })
      } catch { /* silent */ }
    }

    // Email: dispute raised — notify seller
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, disputeRaisedEmail(deal.seller.name || 'বিক্রেতা', deal.title, deal.buyer?.name || 'ক্রেতা', deal.amount || 0)).catch(() => {})
    }

    // Email: dispute raised — notify admin
    try {
      const adminUser = await db.user.findFirst({
        where: { admin: { isNot: null } },
        select: { name: true, email: true },
      })
      if (adminUser?.email) {
        sendEmail(adminUser.email, adminDisputeEmail(
          adminUser.name || 'অ্যাডমিন',
          deal.title,
          `৳${(deal.amount || 0).toLocaleString('bn-BD')}`,
          deal.buyer?.name || 'ক্রেতা',
          deal.seller?.name || 'বিক্রেতা',
        )).catch(() => {})
      }
    } catch { /* silent */ }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json({ error: 'বিরোধ দায়েরে সমস্যা' }, { status: 500 })
  }
}