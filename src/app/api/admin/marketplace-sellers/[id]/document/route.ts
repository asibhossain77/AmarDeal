import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView } from '@/lib/admin-moderation-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — GET /api/admin/marketplace-sellers/[id]/document?app=<applicationId>

   Secure verification-document access. The NID / trade licence image
   is fetched SERVER-SIDE from storage and streamed to an authorized
   administrator — the raw storage URL never appears in any admin API
   response, browser history, or client cache:
   - requireModerationView: only active admins (super/staff/support)
   - the application must belong to the seller in the URL
   - response is private + no-store

   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const applicationId = (searchParams.get('app') || '').trim()
    if (!applicationId) {
      return NextResponse.json({ error: 'আবেদন আইডি প্রয়োজন' }, { status: 400 })
    }

    const application = await db.sellerApplication.findUnique({
      where: { id: applicationId },
      select: { userId: true, documentImage: true },
    })
    if (!application || application.userId !== id || !application.documentImage) {
      return NextResponse.json({ error: 'ডকুমেন্ট পাওয়া যায়নি' }, { status: 404 })
    }

    // documentImage is the storage URL (full https URL). Some legacy rows may
    // hold a proxied "/cdn/..." path — rebuild the absolute URL for the
    // server-side fetch in that case.
    let url = application.documentImage
    if (url.startsWith('/cdn/')) {
      url = `https://cdn.midman.bd${url.slice('/cdn'.length)}`
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'ডকুমেন্ট URL অবৈধ' }, { status: 400 })
    }

    const upstream = await fetch(url, { cache: 'no-store' })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'ডকুমেন্ট লোড করা যায়নি' }, { status: 502 })
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[admin-seller-document ERROR]', err)
    return NextResponse.json({ error: 'ডকুমেন্ট লোড করা যায়নি' }, { status: 500 })
  }
}
