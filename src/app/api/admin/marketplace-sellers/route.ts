import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireModerationView } from '@/lib/admin-moderation-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — GET /api/admin/marketplace-sellers
   All sellers with role, verification, registration date, account
   status + moderation metadata. Search / filter / sort.

   SECURITY: verification documents are NEVER included in list or
   detail payloads — they are only served through the auth-gated
   document proxy route, so raw document URLs never reach the client.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  const guard = await requireModerationView(req)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().slice(0, 100)
    const status = searchParams.get('status') || 'all' // all | active | suspended | restricted
    const role = searchParams.get('role') || 'all' // all | personal | business
    const verification = searchParams.get('verification') || 'all' // all | verified | unverified
    const sort = searchParams.get('sort') || 'newest' // newest | oldest | name

    const where: Record<string, unknown> = { isSeller: true }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { businessName: { contains: q } },
      ]
    }
    if (status === 'suspended') where.sellerDisabled = true
    if (status === 'restricted') where.sellerRestricted = true
    if (status === 'active') {
      where.sellerDisabled = false
      where.sellerRestricted = false
    }
    if (role === 'personal' || role === 'business') where.sellerRole = role
    if (verification === 'verified') where.businessVerified = true
    if (verification === 'unverified') {
      where.sellerRole = 'business'
      where.businessVerified = false
    }

    const orderBy =
      sort === 'oldest' ? { createdAt: 'asc' as const }
      : sort === 'name' ? { name: 'asc' as const }
      : { createdAt: 'desc' as const }

    const [sellers, activeBySeller, pendingApps, openReportByTarget] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, imageLink: true,
          isSeller: true, sellerRole: true, businessVerified: true,
          sellerDisabled: true, sellerRestricted: true,
          sellerSuspendedAt: true, sellerSuspendReason: true,
          businessName: true, businessCategory: true, storeLogo: true,
          createdAt: true,
          _count: { select: { digitalProducts: true } },
        },
        orderBy,
        take: 200,
      }),
      db.digitalProduct.groupBy({
        by: ['sellerId'],
        _count: { sellerId: true },
        where: { status: 'active' },
      }),
      db.sellerApplication.findMany({
        where: { status: 'pending' },
        select: {
          id: true, userId: true, applicationType: true, idType: true,
          idNumber: true, businessName: true, createdAt: true,
          // documentImage deliberately NOT selected — proxy-only access
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.moderationReport.groupBy({
        by: ['targetId'],
        _count: { targetId: true },
        where: { targetType: 'seller', status: { in: ['pending', 'under_review'] } },
      }),
    ])

    const activeCountMap = new Map(activeBySeller.map(r => [r.sellerId, (r._count as { sellerId: number }).sellerId]))
    const reportCountMap = new Map(openReportByTarget.map(r => [r.targetId, r._count.targetId]))
    const pendingAppMap = new Map(pendingApps.map(a => [a.userId, a]))

    const [totalSellers, businessCount, personalCount, suspendedCount, restrictedCount, verifiedCount] =
      await Promise.all([
        db.user.count({ where: { isSeller: true } }),
        db.user.count({ where: { isSeller: true, sellerRole: 'business' } }),
        db.user.count({ where: { isSeller: true, sellerRole: 'personal' } }),
        db.user.count({ where: { isSeller: true, sellerDisabled: true } }),
        db.user.count({ where: { isSeller: true, sellerRestricted: true } }),
        db.user.count({ where: { isSeller: true, businessVerified: true } }),
      ])

    const flat = sellers.map(s => {
      const app = pendingAppMap.get(s.id) || null
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        imageLink: s.imageLink,
        sellerRole: s.sellerRole || 'personal',
        businessVerified: !!s.businessVerified,
        sellerDisabled: !!s.sellerDisabled,
        sellerRestricted: !!s.sellerRestricted,
        sellerSuspendedAt: s.sellerSuspendedAt,
        sellerSuspendReason: s.sellerSuspendReason,
        businessName: s.businessName,
        businessCategory: s.businessCategory,
        createdAt: s.createdAt,
        totalProducts: s._count.digitalProducts,
        activeProducts: activeCountMap.get(s.id) || 0,
        openReports: reportCountMap.get(s.id) || 0,
        pendingApplication: app
          ? {
              id: app.id,
              applicationType: app.applicationType,
              idType: app.idType,
              createdAt: app.createdAt,
            }
          : null,
      }
    })

    return NextResponse.json({
      sellers: flat,
      stats: {
        totalSellers,
        businessSellers: businessCount,
        personalSellers: personalCount,
        suspendedSellers: suspendedCount,
        restrictedSellers: restrictedCount,
        verifiedBusiness: verifiedCount,
        pendingApplications: pendingApps.length,
      },
    })
  } catch (err) {
    console.error('[admin-marketplace-sellers ERROR]', err)
    return NextResponse.json({ error: 'তথ্য লোড করতে সমস্যা' }, { status: 500 })
  }
}
