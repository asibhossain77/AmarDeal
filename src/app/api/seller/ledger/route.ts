import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { LEDGER_ENTRY_TYPES } from '@/lib/seller-ledger'

/* ═══════════════════════════════════════════════════════════════
   GET /api/seller/ledger — the seller's itemized financial ledger
   (transaction references + timestamps for every entry).

   RBAC: entries are ALWAYS filtered by sellerId = session user.
   sourceId is echoed as the transaction reference (order number is
   resolved for marketplace orders so the reference is human-readable).
   ═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 20
const VALID_TYPES = new Set<string>(LEDGER_ENTRY_TYPES)
const VALID_SOURCES = new Set(['marketplace_order', 'deal', 'withdrawal', 'adjustment'])

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // ── RBAC: active seller only (ledger exists for sellers) ──
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isSeller: true, sellerDisabled: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }
    if (!user.isSeller || user.sellerDisabled) {
      return NextResponse.json(
        { error: 'শুধুমাত্র সক্রিয় সেলাররা লেজার দেখতে পারবেন', code: 'NOT_SELLER' },
        { status: 403 },
      )
    }

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const type = url.searchParams.get('type')
    const sourceType = url.searchParams.get('sourceType')

    const where = {
      sellerId: userId,
      ...(type && VALID_TYPES.has(type) ? { type } : {}),
      ...(sourceType && VALID_SOURCES.has(sourceType) ? { sourceType } : {}),
    }

    const [entries, total, orderRefs] = await Promise.all([
      db.sellerLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.sellerLedgerEntry.count({ where }),
      // Human-readable transaction references for marketplace entries
      db.marketplaceOrder.findMany({
        where: { sellerId: userId },
        select: { id: true, orderNumber: true },
      }),
    ])

    const orderNumberById = new Map(orderRefs.map((o) => [o.id, o.orderNumber]))

    const items = entries.map((e) => ({
      id: e.id,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      // Transaction reference: order number when resolvable, else source id
      reference:
        e.sourceType === 'marketplace_order'
          ? (orderNumberById.get(e.sourceId) ?? e.sourceId)
          : e.sourceId,
      type: e.type,
      amount: e.amount,
      description: e.description,
      details: e.details ? JSON.parse(e.details) as Record<string, unknown> : null,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    })
  } catch (err) {
    console.error('[SELLER LEDGER ERROR]', err)
    return NextResponse.json({ error: 'লেজার লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
