import { db } from '@/lib/db'
import { NextRequest, NextResponse, after } from 'next/server'
import { requireDealAccess, requireAuth } from '@/lib/deal-guard'
import { notifyUser } from '@/lib/push'
import { ownsChatFileKey, MAX_CHAT_FILE_SIZE, CHAT_FILE_RETENTION_DAYS, deleteFileByKey } from '@/lib/r2'

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

export const dynamic = 'force-dynamic'

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

    // Attachments live in a separate table so chat keeps working even before
    // the table exists on a fresh database (/api/health auto-creates it).
    type ChatFileRow = { messageId: string; key: string; fileName: string; fileSize: number; fileType: string | null; expiresAt: Date; deletedAt: Date | null }
    let files: ChatFileRow[] = []
    try {
      files = await db.chatFile.findMany({ where: { dealId: id } })
    } catch {
      // Table not created yet — messages still load, just without attachments
    }
    const byMessage = new Map(files.map(f => [f.messageId, f]))
    const now = Date.now()

    // Expired file → never expose the key; keep the name so the UI can show
    // the "ফাইল মুছে ফেলা হয়েছে" placeholder.
    const enriched = messages.map(m => {
      const f = byMessage.get(m.id)
      if (!f) return m
      const expired = f.expiresAt.getTime() <= now
      return {
        ...m,
        fileExpired: expired,
        file: expired
          ? { fileName: f.fileName }
          : { fileName: f.fileName, fileSize: f.fileSize, fileType: f.fileType },
      }
    })

    // Lazy cleanup — remove R2 objects whose 3-day retention elapsed, even if
    // the daily cron hasn't run. Only rows not yet marked deletedAt are
    // touched, so polling never re-deletes the same object.
    const staleRows = files.filter(f => f.expiresAt.getTime() <= now && !f.deletedAt)
    if (staleRows.length > 0) {
      after(async () => {
        for (const f of staleRows) {
          await deleteFileByKey(f.key)
          await db.chatFile.update({ where: { messageId: f.messageId }, data: { deletedAt: new Date() } }).catch(() => {})
          console.error('[chat] Lazy-deleted expired chat file:', f.key)
        }
      })
    }

    return NextResponse.json(enriched, { headers: { 'Cache-Control': 'no-store' } })
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

    const { role, senderName, text, file } = await req.json() as {
      role?: string
      senderName?: string
      text?: string
      file?: { key?: string; fileName?: string; fileSize?: number; fileType?: string | null }
    }

    const hasText = !!text?.trim()
    const hasFile = !!(file && file.key && file.fileName)

    // A message needs text, a file, or both
    if ((!hasText && !hasFile) || !role || !senderName) {
      return NextResponse.json({ error: 'তথ্য প্রদান করুন' }, { status: 400 })
    }

    // Only buyer or seller can send chat messages (not admin via this route)
    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Validate the attachment: the R2 key MUST belong to this deal
    // (chat/<dealId>/…) — never allow pointing at arbitrary objects.
    let fileData: { key: string; fileName: string; fileSize: number; fileType: string | null } | null = null
    if (hasFile) {
      if (
        !ownsChatFileKey(file!.key!, id) ||
        typeof file!.fileSize !== 'number' || file!.fileSize <= 0 || file!.fileSize > MAX_CHAT_FILE_SIZE
      ) {
        return NextResponse.json({ error: 'ফাইল ভ্যালিড নয় — আবার আপলোড করুন' }, { status: 400 })
      }
      fileData = {
        key: file!.key!,
        fileName: String(file!.fileName).replace(/[\r\n"\\\u0000-\u001f]/g, '_').slice(0, 200) || 'file',
        fileSize: Math.floor(file!.fileSize),
        fileType: typeof file!.fileType === 'string' ? file!.fileType.slice(0, 100) : null,
      }
    }

    const message = await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: guard.userId,
        role,
        senderName,
        // File-only messages get a fallback caption so every client
        // (admin panel, WebSocket listeners) shows something sensible.
        text: hasText ? text!.trim() : `📎 ${fileData!.fileName}`,
      },
    })

    // Attachment record — auto-deleted 3 days after send (cron + lazy cleanup).
    if (fileData) {
      try {
        await db.chatFile.create({
          data: {
            dealId: id,
            messageId: message.id,
            key: fileData.key,
            fileName: fileData.fileName,
            fileSize: fileData.fileSize,
            fileType: fileData.fileType,
            expiresAt: new Date(Date.now() + CHAT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
          },
        })
      } catch {
        // Table not ready on this database yet — roll back so no file-less
        // message pretends to carry an attachment.
        await db.chatMessage.delete({ where: { id: message.id } }).catch(() => {})
        return NextResponse.json({ error: 'ফাইল সিস্টেম এখনো প্রস্তুত নয় — কিছুক্ষণ পর আবার চেষ্টা করুন' }, { status: 503 })
      }
    }

    // Broadcast user message to WebSocket for real-time delivery
    broadcastChatMessage(id, {
      id: message.id,
      dealId: id,
      senderId: message.senderId,
      role: message.role,
      senderName: message.senderName,
      text: message.text,
      file: fileData ? { fileName: fileData.fileName, fileSize: fileData.fileSize, fileType: fileData.fileType } : undefined,
      createdAt: message.createdAt.toISOString(),
    })

    // Notify the other deal participant about the new message (fire-and-forget)
    const otherPartyId = deal.buyerId === guard.userId ? deal.sellerId : deal.buyerId
    if (otherPartyId) {
      notifyUser({
        userId: otherPartyId,
        dealId: id,
        type: 'new_message',
        title: 'নতুন মেসেজ',
        message: hasFile ? 'ডিলে আপনাকে একটি ফাইল পাঠানো হয়েছে।' : `ডিল #${id}-এ আপনার একটি নতুন মেসেজ আছে।`,
        pushUrl: `/dashboard/deals/${id}`,
      }).catch(() => {})
    }

    // Auto-insert system message on first user chat (once per deal)
    const systemText = 'অ্যাডমিন ডাকতে নিচের 🔴 লাল বাটনে ক্লিক করুন — "অ্যাডমিন ডাকুন"।'
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