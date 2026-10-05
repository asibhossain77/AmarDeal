import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkDigitalAccess, publicFileMeta } from '@/lib/digital-access'
import { isMissingColumnError } from '@/lib/prisma-column-safe'

export const dynamic = 'force-dynamic'

/**
 * GET /api/download/[id]/info — the download page's data source.
 * Returns public product/file metadata plus whether the current user is
 * entitled to download (and if not, why not). `fileKey` is NEVER returned.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = _req.cookies.get('midman_session')?.value

    // Anonymous visitors: public product meta only + loginRequired
    if (!session) {
      const info = await anonInfo(id)
      if (!info) return NextResponse.json({ success: false, error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
      return NextResponse.json(info)
    }

    const { product, entitled, reason, dealStatus } = await checkDigitalAccess(session, id)

    if (!product) {
      return NextResponse.json({ success: false, error: 'পণ্য পাওয়া যায়নি' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      entitled,
      reason: entitled ? null : (reason ?? 'NOT_ENTITLED'),
      dealStatus: dealStatus ?? null,
      product: publicFileMeta(product),
    })
  } catch (err) {
    console.error('[download:info] Failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}

/** Anonymous variant: public product meta only (no entitlement). */
async function anonInfo(id: string) {
  try {
    const p = await db.digitalProduct.findUnique({
      where: { id },
      select: { id: true, title: true, price: true, isFree: true, fileName: true, fileSize: true, fileType: true },
    })
    if (!p) return null
    return { success: true, entitled: false, loginRequired: true, product: publicFileMeta(p) }
  } catch (err) {
    // New columns not migrated yet (production safety net) — degrade gracefully
    if (isMissingColumnError(err, 'fileKey')) {
      const p = await db.digitalProduct.findUnique({
        where: { id },
        select: { id: true, title: true, price: true },
      })
      if (!p) return null
      return { success: true, entitled: false, loginRequired: true, product: { ...p, isFree: false, hasFile: false, fileName: null, fileSize: null, fileType: null } }
    }
    throw err
  }
}
