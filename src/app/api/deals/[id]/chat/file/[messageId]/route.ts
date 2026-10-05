import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'
import { presignDownload } from '@/lib/r2'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deals/[id]/chat/file/[messageId] — download a chat attachment.
 *
 * Access: deal participants only (requireDealAccess). A chat file expires
 * 3 days after the message was sent — expired files return 410 and the R2
 * object is removed by the lazy/cron cleanup. Bytes never flow through this
 * server: 302 redirect to a short-lived (10 min) presigned R2 URL that
 * forces the original filename as an attachment download.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params

    // Authorization: caller must be a participant of this deal
    const guard = await requireDealAccess(_req, id)
    if (!guard.ok) return guard.response

    let file: { key: string; fileName: string; fileType: string | null; expiresAt: Date; dealId: string } | null = null
    try {
      file = await db.chatFile.findUnique({ where: { messageId } })
    } catch {
      // ChatFile table not created yet on this database
      return NextResponse.json({ error: 'ফাইল পাওয়া যায়নি' }, { status: 404 })
    }

    if (!file || file.dealId !== id) {
      return NextResponse.json({ error: 'ফাইল পাওয়া যায়নি' }, { status: 404 })
    }

    if (file.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'ফাইলের মেয়াদ শেষ — পাঠানোর ৩ দিন পর ফাইলটি স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়েছে' },
        { status: 410 }
      )
    }

    const url = await presignDownload(file.key, file.fileName, file.fileType)

    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[chat-file] Failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'ফাইল লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
