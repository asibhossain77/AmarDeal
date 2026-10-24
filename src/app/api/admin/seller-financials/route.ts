import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceAdmin } from '@/lib/admin-finance-guard'
import { getLedgerFinancials } from '@/lib/seller-ledger'
import { getSellerBalance } from '@/lib/seller-balance'

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/seller-financials — financial reports per seller
   with date-range filters.

   ?sellerId=            omit → seller list (window aggregates)
                         set  → full report for ONE seller
   ?from=YYYY-MM-DD&to=  optional window (defaults: all time)

   Everything is computed SERVER-SIDE from the itemized ledger +
   authoritative order/withdrawal records. Admin Deal earnings and
   Marketplace Order earnings are reported SEPARATELY everywhere.
   ═══════════════════════════════════════════════════════════════ */

const MAX_LIST = 100

function parseWindow(url: URL): { from?: Date; to?: Date } {
  const f = url.searchParams.get('from')
  const t = url.searchParams.get('to')
  const from = f ? new Date(f) : null
  const to = t ? new Date(t) : null
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? new Date(to.getTime() + 86_399_000) : undefined,
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireFinanceAdmin(req, 'seller-financials')
  if (!guard.ok) return guard.response
  try {
    const url = new URL(req.url)
    const sellerId = url.searchParams.get('sellerId')
    const window = parseWindow(url)

    // ── Single-seller detail report ──
    if (sellerId) {
      const seller = await db.user.findUnique({
        where: { id: sellerId },
        select: {
          id: true, name: true, phone: true, businessName: true,
          isSeller: true, sellerDisabled: true, createdAt: true,
        },
      })
      if (!seller || !seller.isSeller) {
        return NextResponse.json({ error: 'সেলার পাওয়া যায়নি' }, { status: 404 })
      }

      const [fin, balance, orderCounts, ledger, recentWithdrawals] = await Promise.all([
        getLedgerFinancials(sellerId, window),
        getSellerBalance(sellerId),
        db.marketplaceOrder.groupBy({
          by: ['status'],
          where: { sellerId, ...(window.from || window.to ? { createdAt: { ...(window.from ? { gte: window.from } : {}), ...(window.to ? { lte: window.to } : {}) } } : {}) },
          _count: { _all: true },
        }),
        db.sellerLedgerEntry.findMany({
          where: { sellerId, ...(window.from || window.to ? { createdAt: { ...(window.from ? { gte: window.from } : {}), ...(window.to ? { lte: window.to } : {}) } } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 60,
        }),
        db.sellerWithdrawal.findMany({
          where: { userId: sellerId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

      const orderRefRows = await db.marketplaceOrder.findMany({
        where: { sellerId },
        select: { id: true, orderNumber: true },
      })
      const orderNumberById = new Map(orderRefRows.map((o) => [o.id, o.orderNumber]))

      return NextResponse.json({
        seller,
        window,
        money: fin,
        balance,
        orderCounts: orderCounts.map((c) => ({ status: c.status, count: c._count._all })),
        ledger: ledger.map((e) => ({
          id: e.id,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          reference: e.sourceType === 'marketplace_order'
            ? (orderNumberById.get(e.sourceId) ?? e.sourceId)
            : e.sourceId,
          type: e.type,
          amount: e.amount,
          description: e.description,
          details: e.details ? JSON.parse(e.details) as Record<string, unknown> : null,
          createdAt: e.createdAt,
        })),
        withdrawals: recentWithdrawals,
      })
    }

    // ── Seller list with window aggregates ──
    const sellers = await db.user.findMany({
      where: { isSeller: true },
      select: {
        id: true, name: true, phone: true, businessName: true,
        sellerDisabled: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST,
    })

    const rows = await Promise.all(sellers.map(async (s) => {
      const fin = await getLedgerFinancials(s.id, window)
      return {
        id: s.id,
        name: s.name,
        businessName: s.businessName,
        phone: s.phone,
        sellerDisabled: s.sellerDisabled,
        money: fin,
      }
    }))

    rows.sort((a, b) => b.money.totalNet - a.money.totalNet)

    return NextResponse.json({ sellers: rows, window })
  } catch (err) {
    console.error('[ADMIN SELLER FINANCIALS ERROR]', err)
    return NextResponse.json({ error: 'রিপোর্ট লোড করতে সমস্যা' }, { status: 500 })
  }
}
