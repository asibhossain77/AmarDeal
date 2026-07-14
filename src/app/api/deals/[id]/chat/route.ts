import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess, requireAuth } from '@/lib/deal-guard'

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authorization: user must own this deal
    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response

    const messages = await db.chatMessage.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(messages)
  } catch {
    return NextResponse.json({ error: 'চ্যাট লোড করতে সমস্যা' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authorization: user must own this deal
    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response

    const { role, senderName, text } = await req.json()

    if (!text?.trim() || !role || !senderName) {
      return NextResponse.json({ error: 'তথ্য প্রদান করুন' }, { status: 400 })
    }

    // Only buyer or seller can send chat messages (not admin via this route)
    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    const message = await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: guard.userId,
        role,
        senderName,
        text: text.trim(),
      },
    })

    // Broadcast user message to WebSocket for real-time delivery
    broadcastChatMessage(id, {
      id: message.id,
      dealId: id,
      senderId: message.senderId,
      role: message.role,
      senderName: message.senderName,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })

    // Auto-insert system message on first user chat (once per deal)
    const systemText = 'অ্যাডমিনকে ডাকা হয়েছে, খুব দ্রুতই অ্যাডমিন আপনাদের সাথে যোগাযোগ করবে।'
    const existingSystemMsg = await db.chatMessage.findFirst({
      where: { dealId: id, role: 'system', text: systemText },
    })
    if (!existingSystemMsg) {
      const sysMsg = await db.chatMessage.create({
        data: {
          dealId: id,
          senderId: 'system',
          role: 'system',
          senderName: 'সিস্টেম',
          text: systemText,
        },
      })
      broadcastChatMessage(id, {
        id: sysMsg.id,
        dealId: id,
        senderId: sysMsg.senderId,
        role: sysMsg.role,
        senderName: sysMsg.senderName,
        text: sysMsg.text,
        createdAt: sysMsg.createdAt.toISOString(),
      })
    }

    return NextResponse.json(message, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'মেসেজ পাঠাতে সমস্যা' }, { status: 500 })
  }
}