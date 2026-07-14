import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response

    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Always allow calling — if admin ended chat, user can call again
    await db.deal.update({
      where: { id },
      data: {
        adminCalled: true,
        adminCalledAt: new Date(),
      },
    })

    // Insert a system message in chat
    await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: '__system__',
        role: 'system',
        senderName: null,
        text: 'অ্যাডমিনকে ডাকা হয়েছে। অ্যাডমিন খুব দ্রুত আপনাদের সাথে যোগাযোগ করবেন।',
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 })
  }
}