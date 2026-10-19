/**
 * Task 83 — Admin Dashboard SMM Orders card + dynamic highlights: API tests
 *
 * Verifies against the REAL dev DB (amardeal/db/custom.db) via HTTP:
 *   1. GET /api/admin/stats returns totalSmmOrders/pendingSmmOrders/
 *      totalProductOrders/pendingProductOrders and they MATCH direct DB counts
 *   2. Pending definition = status=pending_payment AND paymentStatus=
 *      awaiting_verification (unpaid checkouts NOT counted)
 *   3. Inserting a pending SMM order → pendingSmmOrders +1 (real data, no hardcode)
 *   4. Inserting a pending PRODUCT order → pendingProductOrders +1
 *   5. Marking them verified (paid+queued) → counts return to baseline
 *   6. Non-admin cannot fetch stats (401/403)
 *
 * Run: DATABASE_URL=file:$PWD/db/custom.db bun scripts/t83-stats-api-tests.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BASE = 'http://localhost:3000'

let pass = 0, fail = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function main() {
  /* ── login admin ── */
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin-t81@midman.test', password: 't81pass123' }),
  })
  check('admin login', loginRes.ok)
  const cookie = (loginRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const authHdr = { cookie }

  /* ── 1. stats shape + match direct DB counts ── */
  const statsRes = await fetch(`${BASE}/api/admin/stats`, { headers: authHdr })
  check('GET /api/admin/stats 200', statsRes.ok)
  const stats = await statsRes.json()

  const [dbSmmTotal, dbSmmPending, dbProdTotal, dbProdPending] = await Promise.all([
    db.marketplaceOrder.count({ where: { serviceId: { not: null } } }),
    db.marketplaceOrder.count({ where: { serviceId: { not: null }, status: 'pending_payment', paymentStatus: 'awaiting_verification' } }),
    db.marketplaceOrder.count({ where: { productId: { not: null } } }),
    db.marketplaceOrder.count({ where: { productId: { not: null }, status: 'pending_payment', paymentStatus: 'awaiting_verification' } }),
  ])

  check('totalSmmOrders matches DB', stats.totalSmmOrders === dbSmmTotal, `api=${stats.totalSmmOrders} db=${dbSmmTotal}`)
  check('pendingSmmOrders matches DB', stats.pendingSmmOrders === dbSmmPending, `api=${stats.pendingSmmOrders} db=${dbSmmPending}`)
  check('totalProductOrders matches DB', stats.totalProductOrders === dbProdTotal, `api=${stats.totalProductOrders} db=${dbProdTotal}`)
  check('pendingProductOrders matches DB', stats.pendingProductOrders === dbProdPending, `api=${stats.pendingProductOrders} db=${dbProdPending}`)
  check('legacy fields intact', typeof stats.totalDeals === 'number' && typeof stats.pendingVerification === 'number' && typeof stats.pendingSellerApps === 'number')

  const baseSmm = stats.totalSmmOrders, baseSmmP = stats.pendingSmmOrders
  const baseProd = stats.totalProductOrders, baseProdP = stats.pendingProductOrders

  /* ── fixtures (self-seeding — find-or-create) ── */
  const buyer = await db.user.findUnique({ where: { email: 'buyer-t81@midman.test' } })
  if (!buyer) throw new Error('buyer-t81@midman.test missing')
  const admin = await db.user.findUnique({ where: { email: 'admin-t81@midman.test' } })
  if (!admin) throw new Error('admin user missing')

  let service = await db.marketplaceService.findFirst()
  if (!service) {
    service = await db.marketplaceService.create({
      data: {
        name: 'T83 SMM Test Service',
        description: 'Task 83 test fixture service',
        category: 'other',
        pricePerThousand: 1000,
        status: 'published',
        isActive: true,
        createdById: admin.id,
      },
    })
    console.log('  (seeded MarketplaceService fixture)')
  }
  const product = await db.digitalProduct.findFirst({ where: { status: 'active' } })
  if (!product) throw new Error('no active DigitalProduct in DB — seed first')

  const ts = Date.now()
  /* ── 2+3. pending SMM order (evidence submitted) → counts move ── */
  const smmPending = await db.marketplaceOrder.create({
    data: {
      orderNumber: `MP-T83S${ts}`, userId: buyer.id, sellerId: admin.id,
      serviceId: service.id, serviceName: 'T83 SMM pending', linkUrl: 'https://x.test/p',
      quantity: 1000, unitPriceAtOrder: service.pricePerThousand / 1000, totalAmount: 500,
      status: 'pending_payment', paymentStatus: 'awaiting_verification',
      idempotencyKey: `t83-smm-pending-${ts}`,
    },
  })
  /* unpaid checkout — must NOT affect pending counts */
  const smmUnpaid = await db.marketplaceOrder.create({
    data: {
      orderNumber: `MP-T83U${ts}`, userId: buyer.id, sellerId: admin.id,
      serviceId: service.id, serviceName: 'T83 SMM unpaid', linkUrl: 'https://x.test/u',
      quantity: 500, unitPriceAtOrder: service.pricePerThousand / 1000, totalAmount: 250,
      status: 'pending_payment', paymentStatus: 'unpaid',
      idempotencyKey: `t83-smm-unpaid-${ts}`,
    },
  })
  /* ── 4. pending PRODUCT order → pendingProductOrders +1 ── */
  const prodPending = await db.marketplaceOrder.create({
    data: {
      orderNumber: `MP-T83P${ts}`, userId: buyer.id, sellerId: admin.id,
      productId: product.id, serviceName: 'T83 Product pending', quantity: 1,
      unitPriceAtOrder: 1000, totalAmount: 1000,
      status: 'pending_payment', paymentStatus: 'awaiting_verification',
      idempotencyKey: `t83-prod-pending-${ts}`,
    },
  })

  const stats2 = await (await fetch(`${BASE}/api/admin/stats`, { headers: authHdr })).json()
  check('SMM total +2 (pending + unpaid)', stats2.totalSmmOrders === baseSmm + 2, `api=${stats2.totalSmmOrders} base=${baseSmm}`)
  check('SMM pending +1 (unpaid checkout NOT counted)', stats2.pendingSmmOrders === baseSmmP + 1, `api=${stats2.pendingSmmOrders} base=${baseSmmP}`)
  check('Product total +1', stats2.totalProductOrders === baseProd + 1, `api=${stats2.totalProductOrders} base=${baseProd}`)
  check('Product pending +1', stats2.pendingProductOrders === baseProdP + 1, `api=${stats2.pendingProductOrders} base=${baseProdP}`)

  /* ── 5. resolve (verify) → pending back to baseline ── */
  await db.marketplaceOrder.update({ where: { id: smmPending.id }, data: { status: 'queued', paymentStatus: 'paid' } })
  await db.marketplaceOrder.update({ where: { id: prodPending.id }, data: { status: 'queued', paymentStatus: 'paid' } })
  const stats3 = await (await fetch(`${BASE}/api/admin/stats`, { headers: authHdr })).json()
  check('SMM pending returns to baseline after verify', stats3.pendingSmmOrders === baseSmmP)
  check('Product pending returns to baseline after verify', stats3.pendingProductOrders === baseProdP)
  check('totals unchanged by status change', stats3.totalSmmOrders === baseSmm + 2 && stats3.totalProductOrders === baseProd + 1)

  /* ── cleanup ── */
  await db.marketplaceOrder.deleteMany({ where: { orderNumber: { in: [`MP-T83S${ts}`, `MP-T83U${ts}`, `MP-T83P${ts}`] } } })
  const stats4 = await (await fetch(`${BASE}/api/admin/stats`, { headers: authHdr })).json()
  check('cleanup restores all baselines', stats4.totalSmmOrders === baseSmm && stats4.pendingSmmOrders === baseSmmP && stats4.totalProductOrders === baseProd && stats4.pendingProductOrders === baseProdP)

  /* ── 6. auth guard ── */
  const noAuth = await fetch(`${BASE}/api/admin/stats`)
  check('stats requires admin (401/403 without session)', noAuth.status === 401 || noAuth.status === 403, `status=${noAuth.status}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  await db.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
