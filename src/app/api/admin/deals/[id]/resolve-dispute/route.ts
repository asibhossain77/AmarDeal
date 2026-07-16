import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, disputeResolvedEmail } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-guard'

/**
 * POST /api/admin/deals/[id]/resolve-dispute
 * Body: { action: 'complete' | 'refund_buyer' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const { id } = await params
    const { action } = await req.json()

    if (!action || !['complete', 'refund_buyer'].includes(action)) {
      return NextResponse.json({ error: 'সঠিক অ্যাকশন দিন' }, { status: 400 })
    }

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

    if (deal.status !== 'disputed') {
      return NextResponse.json({ error: 'শুধুমাত্র বিরোধ চলমান ডিল রিজোলভ করা যায়' }, { status: 400 })
    }

    let newStatus: string
    let systemMsg: string

    if (action === 'complete') {
      newStatus = 'completed'
      systemMsg = `অ্যাডমিন বিরোধ রিজোলভ করেছেন। ডিল "সম্পন্ন" হিসেবে চিহ্নিত করা হয়েছে। বিক্রেতা পেআউট অনুরোধ করতে পারবেন।`
    } else {
      newStatus = 'cancelled'
      systemMsg = `অ্যাডমিন বিরোধ রিজোলভ করেছেন। ডিল "বাতিল" হিসেবে চিহ্নিত করা হয়েছে। ক্রেতা ফেরতের অনুরোধ করতে পারবেন।`
    }

    const updated = await db.deal.update({
      where: { id },
      data: { status: newStatus },
    })

    // System message in chat
    await db.chatMessage.create({
      data: {
        dealId: deal.id,
        role: 'system',
        message: systemMsg,
      },
    })

    // Notify both parties
    const notifyMsg = action === 'complete'
      ? `"${deal.title}" ডিলের বিরোধ রিজোলভ হয়েছে। ডিল সম্পন্ন হয়েছে।`
      : `"${deal.title}" ডিলের বিরোধ রিজোলভ হয়েছে। ডিল বাতিল হয়েছে।`

    for (const userId of [deal.buyerId, deal.sellerId].filter(Boolean)) {
      await db.notification.create({
        data: {
          userId: userId!,
          type: 'dispute_resolved',
          title: 'বিরোধ রিজোলভ',
          message: notifyMsg,
          dealId: deal.id,
        },
      })
    }

    // Email: dispute resolved to both parties
    if (deal.buyer?.email) {
      sendEmail(deal.buyer.email, disputeResolvedEmail(
        deal.buyer.name || 'ক্রেতা', deal.title, action as 'complete' | 'refund_buyer'
      )).catch(() => {})
    }
    if (deal.seller?.email) {
      sendEmail(deal.seller.email, disputeResolvedEmail(
        deal.seller.name || 'বিক্রেতা', deal.title, action as 'complete' | 'refund_buyer'
      )).catch(() => {})
    }

    return NextResponse.json({ success: true, deal: updated })
  } catch {
    return NextResponse.json(
      { error: 'বিরোধ রিজোলভে সমস্যা' },
      { status: 500 },
    )
  }
}