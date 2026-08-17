import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'

// Broadcast chat message to WebSocket service
async function broadcastChatMessage(dealId: string, message: Record<string, unknown>) {
  try {
    await fetch('http://127.0.0.1:3004/chat-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, message }),
    })
  } catch {
    // WebSocket service might be down, silently ignore
  }
}

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
    const sysMsg = await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: '__system__',
        role: 'system',
        senderName: null,
        text: 'অ্যাডমিনকে ডাকা হয়েছে। অ্যাডমিন খুব দ্রুত আপনাদের সাথে যোগাযোগ করবেন।',
      },
    })

    // Broadcast to WebSocket for real-time delivery
    broadcastChatMessage(id, {
      id: sysMsg.id,
      dealId: id,
      senderId: sysMsg.senderId,
      role: sysMsg.role,
      senderName: sysMsg.senderName,
      text: sysMsg.text,
      createdAt: sysMsg.createdAt.toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 })
  }
}