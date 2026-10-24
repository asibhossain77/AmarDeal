import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { logAdminAction } from '@/lib/order-protection'

/**
 * GET  /api/admin/store-requests — sellers' verified store-name change requests
 * PATCH /api/admin/store-requests — approve (applies the change) or reject
 *   { requestId, action: 'approve' | 'reject', note? }
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // 'pending' | 'approved' | 'rejected' | null = all

    const requests = await db.storeChangeRequest.findMany({
      where: statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)
        ? { status: statusFilter }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        seller: {
          select: { id: true, name: true, email: true, businessName: true, isSeller: true, sellerDisabled: true },
        },
      },
    })

    const pendingCount = await db.storeChangeRequest.count({ where: { status: 'pending' } })

    return NextResponse.json({
      requests: requests.map(r => {
        let changes: Record<string, string> = {}
        try {
          changes = JSON.parse(r.changes)
        } catch { /* malformed — return empty */ }
        return {
          id: r.id,
          status: r.status,
          adminNote: r.adminNote,
          reviewedAt: r.reviewedAt,
          createdAt: r.createdAt,
          changes,
          seller: r.seller,
        }
      }),
      pendingCount,
    })
  } catch {
    return NextResponse.json({ error: 'অনুরোধ লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const body = await req.json().catch(() => null)
    const { requestId, action, note } = body || {}

    if (!requestId || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json({ error: 'অবৈধ অনুরোধ' }, { status: 400 })
    }

    const request = await db.storeChangeRequest.findUnique({
      where: { id: requestId },
      select: { id: true, sellerId: true, changes: true, status: true },
    })
    if (!request) {
      return NextResponse.json({ error: 'অনুরোধ পাওয়া যায়নি' }, { status: 404 })
    }
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'এই অনুরোধটি ইতিমধ্যে নিষ্পত্তি হয়েছে' }, { status: 409 })
    }

    let applied = false
    if (action === 'approve') {
      // Apply only whitelisted, validated fields from the change payload
      let changes: Record<string, unknown> = {}
      try {
        changes = JSON.parse(request.changes)
      } catch { /* fall through with empty */ }

      const updateData: Record<string, string | null> = {}
      if (typeof changes.businessName === 'string') {
        const proposed = changes.businessName.trim()
        if (proposed.length > 0 && proposed.length <= 100) {
          updateData.businessName = proposed
        } else if (proposed === '') {
          updateData.businessName = null
        }
      }
      if (Object.keys(updateData).length > 0) {
        await db.user.update({ where: { id: request.sellerId }, data: updateData })
        applied = true
      }
    }

    await db.storeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        adminNote: typeof note === 'string' ? note.slice(0, 500) : null,
        reviewedAt: new Date(),
      },
    })

    // Audit trail (Phase 8) — verified store-name approvals are sensitive
    try {
      await logAdminAction({
        adminId: guard.admin.userId,
        adminName: guard.admin.user?.name || 'Admin',
        action: action === 'approve' ? 'store_change_approved' : 'store_change_rejected',
        targetType: 'store_change_request',
        targetId: requestId,
        details: { sellerId: request.sellerId, applied, changes: request.changes.slice(0, 500), note: note || null },
      })
    } catch { /* audit never breaks the flow */ }

    return NextResponse.json({
      success: true,
      applied,
      message: action === 'approve'
        ? (applied ? 'পরিবর্তন অনুমোদিত ও প্রয়োগ হয়েছে' : 'অনুরোধ অনুমোদিত, তবে প্রযোজ্য পরিবর্তন পাওয়া যায়নি')
        : 'অনুরোধ বাতিল করা হয়েছে',
    })
  } catch {
    return NextResponse.json({ error: 'অনুরোধ প্রক্রিয়াকরণে সমস্যা হয়েছে' }, { status: 500 })
  }
}
