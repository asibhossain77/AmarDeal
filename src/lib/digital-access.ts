import { db } from '@/lib/db'

/* ═══════════════════════════════════════════════════════════
   Production schema self-healing — the digital-file columns and
   the ProductDownload table are created on first app load (called
   from /api/auth/me) so the deploy never breaks before migration.
   ═══════════════════════════════════════════════════════════ */

let _schemaChecked = false

export async function ensureDigitalSchema(): Promise<void> {
  if (_schemaChecked) return
  _schemaChecked = true
  try {
    const cols = (await db.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("DigitalProduct")`
    )) as { name: string }[]
    const have = new Set(cols.map((c) => c.name))

    const wanted: [string, string][] = [
      ['isFree', `ALTER TABLE "DigitalProduct" ADD COLUMN "isFree" BOOLEAN NOT NULL DEFAULT 0`],
      ['fileKey', `ALTER TABLE "DigitalProduct" ADD COLUMN "fileKey" TEXT`],
      ['fileName', `ALTER TABLE "DigitalProduct" ADD COLUMN "fileName" TEXT`],
      ['fileSize', `ALTER TABLE "DigitalProduct" ADD COLUMN "fileSize" INTEGER`],
      ['fileType', `ALTER TABLE "DigitalProduct" ADD COLUMN "fileType" TEXT`],
    ]
    for (const [col, ddl] of wanted) {
      if (!have.has(col)) await db.$executeRawUnsafe(ddl)
    }

    const t = (await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='ProductDownload'`
    )) as { name: string }[]
    if (t.length === 0) {
      await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "ProductDownload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dealId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDownload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
)`)
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductDownload_productId_userId_key" ON "ProductDownload"("productId", "userId")`
      )
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductDownload_userId_idx" ON "ProductDownload"("userId")`
      )
    }
  } catch (err) {
    // Never break auth over schema healing — health autofix is the backup
    console.error('[digital-schema] ensure failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Digital product access (entitlement) logic — shared by the download
 * redirect API, the download info API and the free-claim API.
 *
 * A logged-in user can download a product's file when ANY of:
 *   1. the product is FREE (isFree)
 *   2. they are the product's seller/owner
 *   3. a ProductDownload grant row exists (free claim or admin grant)
 *   4. they are the buyer of a deal for this product whose payment was
 *      verified (payment_verified / in_delivery / completed)
 */
export const DOWNLOADABLE_DEAL_STATUSES = ['payment_verified', 'in_delivery', 'completed'] as const

export interface DigitalAccessResult {
  product: {
    id: string
    title: string
    price: number
    isFree: boolean
    fileKey: string | null
    fileName: string | null
    fileSize: number | null
    fileType: string | null
    sellerId: string
  } | null
  entitled: boolean
  /** Present when the user has a deal for this product that is not yet verified */
  dealStatus?: string | null
  reason?: 'NO_FILE' | 'NOT_ENTITLED' | 'PAYMENT_PENDING'
}

export async function checkDigitalAccess(userId: string, productId: string): Promise<DigitalAccessResult> {
  const product = await db.digitalProduct.findUnique({
    where: { id: productId },
    select: {
      id: true, title: true, price: true, sellerId: true,
      isFree: true, fileKey: true, fileName: true, fileSize: true, fileType: true,
    },
  })

  if (!product) return { product: null, entitled: false, reason: 'NO_FILE' }
  if (!product.fileKey) return { product: { ...product }, entitled: false, reason: 'NO_FILE' }

  // Seller / owner
  if (product.sellerId === userId) return { product, entitled: true }

  // Free product — anyone logged in
  if (product.isFree) return { product, entitled: true }

  // Existing grant row (free claim / previous grant)
  const grant = await db.productDownload.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true },
  }).catch(() => null)
  if (grant) return { product, entitled: true }

  // Paid deal — payment must be verified
  const deal = await db.deal.findFirst({
    where: {
      buyerId: userId,
      productId,
      status: { in: [...DOWNLOADABLE_DEAL_STATUSES] },
    },
    select: { id: true, status: true },
  })
  if (deal) return { product, entitled: true }

  // Unverified / no deal — look up their latest deal to give a helpful status
  const anyDeal = await db.deal.findFirst({
    where: { buyerId: userId, productId },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
  })

  return {
    product,
    entitled: false,
    dealStatus: anyDeal?.status ?? null,
    reason: anyDeal ? 'PAYMENT_PENDING' : 'NOT_ENTITLED',
  }
}

/** Public-safe file metadata for clients — NEVER includes fileKey. */
export function publicFileMeta(p: { id: string; title: string; price: number; isFree: boolean; fileName: string | null; fileSize: number | null; fileType: string | null }) {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    isFree: p.isFree,
    hasFile: !!p.fileName,
    fileName: p.fileName,
    fileSize: p.fileSize,
    fileType: p.fileType,
  }
}
