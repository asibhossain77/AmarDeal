import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteFileByKey } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/cleanup-chat-files — daily cleanup of expired chat attachments.
 *
 * Vercel Cron hits this once a day (see vercel.json) and automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set.
 * When CRON_SECRET is not configured the endpoint stays open but only ever
 * deletes objects that are already past their 3-day retention, so it is safe.
 *
 * For every ChatFile past its expiresAt: delete the R2 object (best-effort)
 * and mark deletedAt so the lazy GET-time cleanup stops retrying. The DB row
 * is intentionally kept so the chat UI can keep showing the "ফাইল মুছে ফেলা
 * হয়েছে" placeholder with the original file name.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const expired = await db.chatFile.findMany({
      where: { expiresAt: { lt: new Date() }, deletedAt: null },
      take: 200,
    })

    let cleaned = 0
    for (const f of expired) {
      await deleteFileByKey(f.key) // best-effort R2 delete (never throws)
      await db.chatFile
        .update({ where: { id: f.id }, data: { deletedAt: new Date() } })
        .catch(() => {})
      cleaned++
    }

    return NextResponse.json({
      success: true,
      cleaned,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    // Table might not exist yet on a fresh database — a cron must not error
    console.error('[cron:cleanup-chat-files]', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: true, cleaned: 0, note: 'schema not ready yet' })
  }
}
