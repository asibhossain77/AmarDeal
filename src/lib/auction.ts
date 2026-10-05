/* ═══════════════════════════════════════════════════════════════
   Nilam (Auction) — core helpers

   Lifecycle:
     active  → bids open while now < endsAt
     sold    → expired WITH bids: winner gets an escrow Deal
               (buyer = highest bidder, seller = auction seller,
                amount = winning bid, status 'created') — the deal
                then flows through the normal Midman escrow tracker.
     ended   → expired with NO bids
     cancelled → seller cancelled while zero bids existed

   Finalization is LAZY (serverless-friendly, no cron): every read
   (list / detail / seller list / bid attempt) calls
   finalizeExpiredAuctions() first. Each finalize is idempotent and
   transactional, so concurrent requests can never double-create
   the winner's deal.
   ═══════════════════════════════════════════════════════════════ */

import { db } from '@/lib/db'
import { notifyUser, notifyAdmins } from '@/lib/push'
import { createClient } from '@libsql/client'

/* ── Canonical DDL for the auction tables ──
   Single source of truth: used by the lazy self-heal below AND by
   /api/health's autoFixSchema. CREATE IF NOT EXISTS = idempotent. */
export const AUCTION_TABLE_DDL: Record<string, string> = {
  Auction: `
CREATE TABLE IF NOT EXISTS "Auction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "image" TEXT,
  "sellerId" TEXT NOT NULL,
  "startPrice" REAL NOT NULL,
  "currentPrice" REAL,
  "highestBidderId" TEXT,
  "bidCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "endsAt" DATETIME NOT NULL,
  "winnerId" TEXT,
  "dealId" TEXT,
  "finalPrice" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Auction_highestBidderId_fkey" FOREIGN KEY ("highestBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Auction_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "Auction_sellerId_idx" ON "Auction"("sellerId");`,
  Bid: `
CREATE TABLE IF NOT EXISTS "Bid" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auctionId" TEXT NOT NULL,
  "bidderId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Bid_auctionId_createdAt_idx" ON "Bid"("auctionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Bid_bidderId_idx" ON "Bid"("bidderId");`,
}

/* ── Lazy self-heal ──
   Fresh databases (e.g. production Turso right after a deploy that
   introduces the auction feature, before any migration runs) lack the
   Auction/Bid tables. Every auction route calls this first, so the
   FIRST nilam visit after a deploy creates the tables automatically —
   no cron, no manual migration, no /api/health visit needed.
   Memoized per process after a verified success. */
let auctionTablesVerified = false

export async function ensureAuctionTables(): Promise<void> {
  if (auctionTablesVerified) return
  const url = process.env.DATABASE_URL ?? ''
  if (!url) return
  try {
    const client = createClient({
      url,
      authToken: url.startsWith('libsql://') ? process.env.TURSO_AUTH_TOKEN : undefined,
    })
    try {
      for (const sql of Object.values(AUCTION_TABLE_DDL)) {
        for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
          try {
            await client.execute(stmt)
          } catch {
            // Individual statement failures are non-fatal (e.g. index exists)
          }
        }
      }
      // Verify before memoizing — never trust swallowed errors
      const check = await client.execute(
        "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name IN ('Auction','Bid')"
      )
      if (Number(check.rows[0]?.c ?? 0) === 2) auctionTablesVerified = true
    } finally {
      // @libsql/client's close() is synchronous (returns void) — never chain .catch
      try {
        client.close()
      } catch {
        /* ignore close errors */
      }
    }
  } catch (e) {
    console.error('[AUCTION DDL] self-heal failed:', e)
  }
}

/* ── Min bid increment (tiered) ── */
export function bidIncrementFor(base: number): number {
  if (base < 500) return 10
  if (base < 5000) return 50
  if (base < 50000) return 100
  return 500
}

/** Lowest amount the next bid must be (current highest + increment, or start price + increment). */
export function minNextBid(auction: { startPrice: number; currentPrice: number | null }): number {
  const base = auction.currentPrice ?? auction.startPrice
  return Math.round((base + bidIncrementFor(base)) * 100) / 100
}

/** Round money to 2dp */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Mask a bidder's name for public display — first name only.
 * Keeps bidding competitive without doxxing bidders.
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return 'ইউজার'
  const first = name.trim().split(/\s+/)[0]
  return first || 'ইউজার'
}

/* ── Finalize a single auction if it has expired ── */

interface FinalizeResult {
  finalized: boolean   // did WE flip it in this call?
  status: string       // resulting status
  winnerId: string | null
  dealId: string | null
  finalPrice: number | null
}

/**
 * Idempotent: safe to call on every request. Only the first caller
 * that wins the status guard does any work — the transaction
 * re-checks `status === 'active' && endsAt <= now` inside the write,
 * so two concurrent finalizers can never both create a deal
 * (SQLite serializes writes; the second tx re-reads status 'sold').
 */
export async function finalizeAuctionIfExpired(auctionId: string): Promise<FinalizeResult> {
  const result: FinalizeResult = { finalized: false, status: 'active', winnerId: null, dealId: null, finalPrice: null }

  const auction = await db.auction.findUnique({ where: { id: auctionId } })
  if (!auction) return { ...result, status: 'missing' }

  const expired = auction.endsAt.getTime() <= Date.now()
  if (!expired || auction.status !== 'active') {
    return { ...result, status: auction.status, winnerId: auction.winnerId, dealId: auction.dealId, finalPrice: auction.finalPrice }
  }

  const winnerId = auction.highestBidderId
  const finalPrice = auction.currentPrice

  // Transaction — guard re-checked inside so concurrent calls are safe
  const outcome = await db.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({ where: { id: auctionId } })
    if (!fresh || fresh.status !== 'active' || fresh.endsAt.getTime() > Date.now()) {
      return { skip: true as const, dealId: fresh?.dealId ?? null, status: fresh?.status ?? 'active' }
    }

    let dealId: string | null = null
    if (fresh.highestBidderId && fresh.currentPrice && fresh.currentPrice > 0) {
      // Winner exists → create the escrow deal (buyer = winner)
      const deal = await tx.deal.create({
        data: {
          title: `${fresh.title} (নিলাম)`,
          amount: fresh.currentPrice,
          status: 'created',
          buyerId: fresh.highestBidderId,
          sellerId: fresh.sellerId,
          creatorId: fresh.highestBidderId,
          terms:
            'এই ডিলটি Midman নিলাম ব্যবস্থার মাধ্যমে স্বয়ংক্রিয়ভাবে তৈরি হয়েছে — বিজয়ী সর্বোচ্চ বিডার এবং মূল্য নিলামের সর্বোচ্চ বিড অনুযায়ী নির্ধারিত। মিডম্যান এসক্রো সুরক্ষায় লেনদেন সম্পন্ন হবে।',
        },
      })
      dealId = deal.id

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: 'sold',
          winnerId: fresh.highestBidderId,
          dealId: deal.id,
          finalPrice: fresh.currentPrice,
        },
      })
    } else {
      // No bids → plain expiry
      await tx.auction.update({
        where: { id: auctionId },
        data: { status: 'ended', finalPrice: null },
      })
    }

    return { skip: false as const, dealId, status: dealId ? 'sold' : 'ended' }
  })

  if (outcome.skip) {
    return { finalized: false, status: outcome.status, winnerId: auction.winnerId, dealId: outcome.dealId, finalPrice: auction.finalPrice }
  }

  /* ── Fire-and-forget notifications (never block the response) ── */
  ;(async () => {
    try {
      const fresh = await db.auction.findUnique({
        where: { id: auctionId },
        include: { seller: { select: { id: true, name: true, email: true } } },
      })
      if (!fresh) return

      if (winnerId && finalPrice && outcome.dealId) {
        // Winner — congratulations + next step (pay via escrow)
        notifyUser({
          userId: winnerId,
          dealId: outcome.dealId,
          type: 'auction_won',
          title: 'অভিনন্দন — আপনি নিলামে জিতেছেন!',
          message: `"${fresh.title}" নিলামে আপনার বিড ৳${finalPrice.toLocaleString('en')} — সেলারের সাথে ডিল তৈরি হয়েছে। এখন পেমেন্ট করুন।`,
          pushUrl: '/dashboard',
        }).catch(() => {})

        // Seller — your auction sold
        notifyUser({
          userId: fresh.sellerId,
          dealId: outcome.dealId,
          type: 'auction_sold',
          title: 'আপনার নিলাম বিক্রি হয়েছে',
          message: `"${fresh.title}" নিলাম ৳${finalPrice.toLocaleString('en')}-এ বিক্রি হয়েছে। বিজয়ীর সাথে এসক্রো ডিল তৈরি হয়েছে — ড্যাশবোর্ডে দেখুন।`,
          pushUrl: '/dashboard',
        }).catch(() => {})

        notifyAdmins({
          dealId: outcome.dealId,
          type: 'auction_sold',
          title: 'নিলাম সম্পন্ন',
          message: `নিলাম শেষ: "${fresh.title}" — ৳${finalPrice.toLocaleString('en')}। বিজয়ীর এসক্রো ডিল তৈরি হয়েছে।`,
        }).catch(() => {})
      } else {
        // No bids — let the seller know
        notifyUser({
          userId: fresh.sellerId,
          type: 'auction_ended',
          title: 'নিলামে কোনো বিড আসেনি',
          message: `"${fresh.title}" নিলামের সময় শেষ — কোনো বিড পড়েনি। আবার নিলামে তুলতে পারেন।`,
          pushUrl: '/dashboard',
        }).catch(() => {})
      }
    } catch (e) {
      console.error('[AUCTION FINALIZE] notification error:', e)
    }
  })()

  return { finalized: true, status: outcome.status, winnerId, dealId: outcome.dealId, finalPrice }
}

/* ── Batch-finalize every expired active auction (called on reads) ── */

export async function finalizeExpiredAuctions(limit = 25): Promise<void> {
  try {
    const expired = await db.auction.findMany({
      where: { status: 'active', endsAt: { lte: new Date() } },
      select: { id: true },
      take: limit,
      orderBy: { endsAt: 'asc' },
    })
    for (const a of expired) {
      try {
        await finalizeAuctionIfExpired(a.id)
      } catch (e) {
        console.error('[AUCTION FINALIZE] batch item error:', a.id, e)
      }
    }
  } catch (e) {
    // Pre-migration DBs (no Auction table) must never break callers
    console.error('[AUCTION FINALIZE] batch error:', e)
  }
}

/* ── Shared query shape ── */

/**
 * Detects a pre-migration database (Auction/Bid tables missing) so
 * public endpoints degrade gracefully (empty list / 503) instead of
 * 500-ing right after a deploy that precedes the schema push.
 */
export function isAuctionMigrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('does not exist') && (msg.includes('Auction') || msg.includes('Bid'))
}

export const auctionCardInclude = {
  seller: { select: { id: true, name: true, imageLink: true } },
} as const
