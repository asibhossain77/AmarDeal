import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { ensureSchema } from '@/lib/ensure-schema'

/** Never let one broken table kill the whole dashboard — fall back to 0. */
async function safeCount<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error('[admin/stats] query failed, using fallback:', err instanceof Error ? err.message.slice(0, 160) : err)
    return fallback
  }
}

/**
 * GET /api/admin/stats
 *
 * Marketplace order counts (SMM service orders + "Order Now" product
 * orders) are included so the Admin Dashboard cards can show real totals
 * and highlight when admin attention is required. "Pending" = payment
 * evidence submitted (status=pending_payment + paymentStatus=
 * awaiting_verification) — the actual admin verify queue. Plain unpaid
 * checkouts (paymentStatus=unpaid) are NOT counted: no admin action is
 * possible on them yet.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const loadAll = () => Promise.all([
      db.deal.count(),

      db.user.count(),

      db.deal.count({
        where: {
          status: 'payment_pending',
        },
      }),

      db.payout.count({
        where: { status: 'pending' },
      }),

      db.deal.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),

      db.deal.aggregate({
        where: { status: 'completed' },
        _sum: { platformFee: true },
      }),

      db.deal.count({
        where: { adminCalled: true },
      }),

      db.deal.count({
        where: { status: 'disputed' },
      }),

      db.digitalProduct.count({
        where: { status: 'pending' },
      }),

      db.sellerApplication.count({
        where: { status: 'pending' },
      }),

      // SMM service direct orders (services panel Orders tab domain)
      db.marketplaceOrder.count({
        where: { serviceId: { not: null } },
      }),

      db.marketplaceOrder.count({
        where: {
          serviceId: { not: null },
          status: 'pending_payment',
          paymentStatus: 'awaiting_verification',
        },
      }),

      // "Order Now" product orders (marketplace-orders panel domain)
      db.marketplaceOrder.count({
        where: { productId: { not: null } },
      }),

      db.marketplaceOrder.count({
        where: {
          productId: { not: null },
          status: 'pending_payment',
          paymentStatus: 'awaiting_verification',
        },
      }),
    ])

    // Self-heal: if any count failed due to schema drift (production Turso
    // missing new tables/columns), create them, then retry with per-count
    // fallbacks so the dashboard ALWAYS renders.
    let [
      totalDeals, totalUsers, pendingVerification, pendingPayouts,
      completedSum, profitSum, adminCalls, disputedCount,
      pendingProducts, pendingSellerApps,
      totalSmmOrders, pendingSmmOrders, totalProductOrders, pendingProductOrders,
    ] = await loadAll().catch(async () => {
      await ensureSchema().catch(() => {})
      const zeroAgg = { _sum: { amount: 0, platformFee: 0 } }
      return Promise.all([
        safeCount(() => db.deal.count(), 0),
        safeCount(() => db.user.count(), 0),
        safeCount(() => db.deal.count({ where: { status: 'payment_pending' } }), 0),
        safeCount(() => db.payout.count({ where: { status: 'pending' } }), 0),
        safeCount(() => db.deal.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }), zeroAgg),
        safeCount(() => db.deal.aggregate({ where: { status: 'completed' }, _sum: { platformFee: true } }), zeroAgg),
        safeCount(() => db.deal.count({ where: { adminCalled: true } }), 0),
        safeCount(() => db.deal.count({ where: { status: 'disputed' } }), 0),
        safeCount(() => db.digitalProduct.count({ where: { status: 'pending' } }), 0),
        safeCount(() => db.sellerApplication.count({ where: { status: 'pending' } }), 0),
        safeCount(() => db.marketplaceOrder.count({ where: { serviceId: { not: null } } }), 0),
        safeCount(() => db.marketplaceOrder.count({ where: { serviceId: { not: null }, status: 'pending_payment', paymentStatus: 'awaiting_verification' } }), 0),
        safeCount(() => db.marketplaceOrder.count({ where: { productId: { not: null } } }), 0),
        safeCount(() => db.marketplaceOrder.count({ where: { productId: { not: null }, status: 'pending_payment', paymentStatus: 'awaiting_verification' } }), 0),
      ])
    })

    return NextResponse.json({
      totalDeals,
      totalUsers,
      pendingVerification,
      pendingPayouts,
      completedAmount: Math.round(completedSum._sum.amount || 0),
      totalProfit: Math.round(profitSum._sum.platformFee || 0),
      adminCalls,
      disputedCount,
      pendingProducts,
      pendingSellerApps,
      totalSmmOrders,
      pendingSmmOrders,
      totalProductOrders,
      pendingProductOrders,
    })
  } catch {
    return NextResponse.json(
      { error: 'স্ট্যাটস লোড করতে সমস্যা হয়েছে' },
      { status: 500 },
    )
  }
}