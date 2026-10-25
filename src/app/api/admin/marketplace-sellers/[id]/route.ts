import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView, requireModerationAction } from '@/lib/admin-moderation-guard'
import {
  suspendSeller, reactivateSeller, liftSellerRestriction, createModerationReport,
  type ModerationResult,
} from '@/lib/marketplace-moderation'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — /api/admin/marketplace-sellers/[id]

   GET    → full seller profile for the admin detail dialog: profile,
            verification applications (NO document URLs — proxy only),
            products summary, order counts, reports, audit history.
   PATCH  → moderation actions:
            { action: 'suspend', reason }        → temporary suspension
            { action: 'restrict', reason }       → permanent restriction
            { action: 'reactivate' }             → lift suspension
            { action: 'lift_restriction' }       → clear permanent flag
            { action: 'report', reason, details? } → file a report

   Actions require super_admin / staff-with-permission; support can
   view but never act (requireModerationAction enforces server-side).
   ═══════════════════════════════════════════════════════════════ */

function respondAction(r: ModerationResult, extra: Record<string, unknown> = {}) {
  return NextResponse.json(r.ok ? { success: true, message: r.message, ...extra } : { error: r.error }, {
    status: r.ok ? 200 : r.status,
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params

    const seller = await db.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, imageLink: true,
        isSeller: true, sellerRole: true, businessVerified: true,
        sellerDisabled: true, sellerRestricted: true,
        sellerSuspendedAt: true, sellerSuspendReason: true,
        businessName: true, businessBio: true, businessCategory: true,
        storeLogo: true, whatsappNumber: true, createdAt: true, isActive: true,
        // password / resetToken deliberately never selected
      },
    })
    if (!seller) {
      return NextResponse.json({ error: 'সেলার পাওয়া যায়নি' }, { status: 404 })
    }

    const [applications, products, orderCounts, reports, logs] = await Promise.all([
      db.sellerApplication.findMany({
        where: { userId: id },
        select: {
          id: true, applicationType: true, idType: true, idNumber: true,
          status: true, rejectionReason: true, businessName: true,
          documentImage: true, // boolean flag only — value never leaves the server
          createdAt: true, updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.digitalProduct.findMany({
        where: { sellerId: id },
        select: {
          id: true, title: true, status: true, price: true, quantity: true,
          itemType: true, category: true, image: true, createdAt: true,
          moderationNote: true, moderatedAt: true, moderatedByName: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      Promise.all([
        db.marketplaceOrder.count({ where: { sellerId: id } }),
        db.marketplaceOrder.count({ where: { sellerId: id, status: 'completed' } }),
        db.marketplaceOrder.count({ where: { sellerId: id, status: { in: ['disputed', 'refund_pending'] } } }),
      ]),
      db.moderationReport.findMany({
        where: { targetType: 'seller', targetId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      db.adminAuditLog.findMany({
        where: { targetType: 'seller', targetId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const sellerProductCount = await db.digitalProduct.count({ where: { sellerId: id } })

    return NextResponse.json({
      seller: {
        ...seller,
        businessVerified: !!seller.businessVerified,
        sellerDisabled: !!seller.sellerDisabled,
        sellerRestricted: !!seller.sellerRestricted,
      },
      applications: applications.map(a => ({
        id: a.id,
        applicationType: a.applicationType,
        idType: a.idType,
        idNumber: a.idNumber,
        status: a.status,
        rejectionReason: a.rejectionReason,
        businessName: a.businessName,
        // SECURITY: only a boolean crosses the wire — the image itself is
        // streamed by /api/admin/marketplace-sellers/[id]/document
        hasDocument: !!a.documentImage,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      products,
      totalProducts: sellerProductCount,
      orders: { total: orderCounts[0], completed: orderCounts[1], problem: orderCounts[2] },
      reports,
      logs,
    })
  } catch (err) {
    console.error('[admin-marketplace-seller-detail ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireModerationAction(req, 'marketplace-sellers')
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    const action = body?.action
    const reason = typeof body?.reason === 'string' ? body.reason : undefined
    const details = typeof body?.details === 'string' ? body.details : undefined
    const admin = guard.admin

    // Guard against suspending admins (shared helpers re-check, but fail fast here too)
    if (action === 'suspend' || action === 'restrict') {
      const target = await db.user.findUnique({
        where: { id },
        select: { admin: { select: { id: true } } },
      })
      if (!target) return NextResponse.json({ error: 'সেলার পাওয়া যায়নি' }, { status: 404 })
      if (target.admin) {
        return NextResponse.json({ error: 'অ্যাডমিন অ্যাকাউন্ট সাসপেন্ড করা যাবে না' }, { status: 400 })
      }
      return respondAction(await suspendSeller(id, reason || '', admin, { restricted: action === 'restrict' }))
    }

    if (action === 'reactivate') return respondAction(await reactivateSeller(id, admin))
    if (action === 'lift_restriction') return respondAction(await liftSellerRestriction(id, admin))

    if (action === 'report') {
      const r = await createModerationReport('seller', id, reason || '', details, admin)
      return respondAction(r, { reportId: (r as { reportId?: string }).reportId })
    }

    // Business-verification shortcuts reuse the existing seller-application flow
    // (approve/reject stays in /api/admin/seller-applications/[id] — unchanged).

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('[admin-marketplace-seller-action ERROR]', err)
    return NextResponse.json({ error: 'অ্যাকশন ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
