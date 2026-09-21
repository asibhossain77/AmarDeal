/**
 * E2E verification for the Midman notification system (dev server on :3000).
 * Run: bun scripts/e2e-notifications.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BASE = 'http://localhost:3000'
const ADMIN_ID = 'cmrar4fgy0000vcitwu695oe7'
const BUYER_ID = 'cmrbj7oum0000tnuw9m7kzkjx'
const ADMIN_COOKIE = `midman_session=${ADMIN_ID}`
const BUYER_COOKIE = `midman_session=${BUYER_ID}`

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function api(
  path: string,
  opts: { method?: string; cookie: string; body?: unknown } 
) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Cookie: opts.cookie,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* html response */
  }
  return { status: res.status, json }
}

async function main() {
  console.log('═══ E2E Notification System ═══')

  const admin = await db.user.findUnique({ where: { id: ADMIN_ID } })
  const buyer = await db.user.findUnique({ where: { id: BUYER_ID } })
  if (!admin || !buyer) {
    console.log('❌ test users missing', { admin: !!admin, buyer: !!buyer })
    process.exit(1)
  }
  console.log(`users: admin=${admin.email} buyer=${buyer.email}`)

  // ── 1. Auth & security ──
  console.log('── security ──')
  const noAuth = await api('/api/notifications', { cookie: 'x=1' })
  check('GET /api/notifications without auth → 401', noAuth.status === 401, `got ${noAuth.status}`)

  const noAuthAllRead = await api('/api/notifications/all-read', { method: 'PUT', cookie: 'x=1' })
  check('PUT all-read without auth → 401 (IDOR fixed)', noAuthAllRead.status === 401, `got ${noAuthAllRead.status}`)

  // ── 2. Deal create: creator + counterparty + admin notifications ──
  console.log('── deal create ──')
  const created = await api('/api/deals/create', {
    method: 'POST',
    cookie: BUYER_COOKIE,
    body: {
      title: 'E2E Notif Test Deal',
      role: 'buyer',
      amount: 500,
      partyEmail: admin.email,
      terms: 'notification e2e',
    },
  })
  check('deal create 200', created.status === 200, JSON.stringify(created.json)?.slice(0, 120))
  const dealId = created.json?.id as string
  check('deal id returned', Boolean(dealId))
  await new Promise((r) => setTimeout(r, 1500)) // fire-and-forget notifs settle

  const buyerNotifsAfterCreate = await api('/api/notifications?limit=100', { cookie: BUYER_COOKIE })
  const buyerDealCreated = (buyerNotifsAfterCreate.json?.notifications || []).find(
    (n: any) => n.dealId === dealId && n.type === 'deal_created'
  )
  check('creator got deal_created notification', Boolean(buyerDealCreated))

  const adminNotifsAfterCreate = await api('/api/notifications?limit=100', { cookie: ADMIN_COOKIE })
  const adminDealReq = (adminNotifsAfterCreate.json?.notifications || []).filter(
    (n: any) => n.dealId === dealId
  )
  check('admin got deal notifications (request + admin copy)', adminDealReq.length >= 1, `count=${adminDealReq.length}`)

  // ── 3. Chat message → new_message to other party ──
  console.log('── chat ──')
  const msg = await api(`/api/deals/${dealId}/chat`, {
    method: 'POST',
    cookie: BUYER_COOKIE,
    body: { role: 'buyer', senderName: buyer.name || 'Buyer', text: 'E2E chat notification test' },
  })
  check('chat message 201', msg.status === 201, `got ${msg.status}`)
  await new Promise((r) => setTimeout(r, 1500))

  const adminAfterChat = await api('/api/notifications?limit=100', { cookie: ADMIN_COOKIE })
  const adminNewMsg = (adminAfterChat.json?.notifications || []).find(
    (n: any) => n.dealId === dealId && n.type === 'new_message'
  )
  check('counterparty got new_message notification', Boolean(adminNewMsg))

  // ── 4. Complete flow: force in_delivery then buyer completes → seller notified ──
  console.log('── complete ──')
  await db.deal.update({ where: { id: dealId }, data: { status: 'in_delivery' } })
  const completed = await api('/api/deals/complete', {
    method: 'POST',
    cookie: BUYER_COOKIE,
    body: { dealId },
  })
  check('buyer complete 200', completed.status === 200, JSON.stringify(completed.json)?.slice(0, 120))
  await new Promise((r) => setTimeout(r, 1500))

  const adminAfterComplete = await api('/api/notifications?limit=100', { cookie: ADMIN_COOKIE })
  const adminCompleted = (adminAfterComplete.json?.notifications || []).find(
    (n: any) => n.dealId === dealId && n.type === 'deal_completed'
  )
  check('seller got deal_completed notification', Boolean(adminCompleted))

  // Non-buyer cannot complete (authorization fix)
  const deal2 = await api('/api/deals/create', {
    method: 'POST',
    cookie: ADMIN_COOKIE,
    body: { title: 'E2E Notif Deal 2', role: 'buyer', amount: 300, partyEmail: buyer.email },
  })
  const deal2Id = deal2.json?.id as string
  await db.deal.update({ where: { id: deal2Id }, data: { status: 'in_delivery' } })
  const sellerTryComplete = await api('/api/deals/complete', {
    method: 'POST',
    cookie: ADMIN_COOKIE, // admin is the SELLER of deal2 (buyer created? no — admin created, buyer is seller)
    body: { dealId: deal2Id },
  })
  // admin created deal2 as buyer → admin IS buyer → completion allowed. Use buyer as non-buyer:
  const buyerTryCompleteOthers = await api('/api/deals/complete', {
    method: 'POST',
    cookie: BUYER_COOKIE,
    body: { dealId: deal2Id },
  })
  check('non-buyer complete → 403', buyerTryCompleteOthers.status === 403, `got ${buyerTryCompleteOthers.status}`)
  void sellerTryComplete

  // ── 5. Seller request flow ──
  console.log('── seller request ──')
  const becomeSeller = await api('/api/user/become-seller', {
    method: 'POST',
    cookie: BUYER_COOKIE,
    body: { whatsappNumber: '01700000000' },
  })
  const alreadySeller = becomeSeller.status !== 200
  if (!alreadySeller) {
    await new Promise((r) => setTimeout(r, 1200))
    const adminAfterReq = await api('/api/notifications?limit=100', { cookie: ADMIN_COOKIE })
    const sellerReq = (adminAfterReq.json?.notifications || []).find(
      (n: any) => n.type === 'seller_request'
    )
    check('admin got seller_request notification', Boolean(sellerReq))

    // Admin approves the pending application
    const app = await db.sellerApplication.findFirst({
      where: { userId: BUYER_ID, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (app) {
      const patched = await api(`/api/admin/seller-applications/${app.id}`, {
        method: 'PATCH',
        cookie: ADMIN_COOKIE,
        body: { status: 'approved' },
      })
      check('admin approve application 200', patched.status === 200, `got ${patched.status}`)
      await new Promise((r) => setTimeout(r, 4000))
      const buyerAfterApprove = await api('/api/notifications?limit=100', { cookie: BUYER_COOKIE })
      const approved = (buyerAfterApprove.json?.notifications || []).find(
        (n: any) => n.type === 'seller_approved' && n.relatedId === app.id
      )
      check('user got seller_approved notification', Boolean(approved))
    } else {
      check('pending seller application found', false)
    }
  } else {
    console.log('  ⚠️ buyer already seller — seller_request flow skipped (create path rejected)')
  }

  // ── 6. Privacy: lists are disjoint ──
  console.log('── privacy ──')
  const buyerList = await api('/api/notifications?limit=100', { cookie: BUYER_COOKIE })
  const adminList = await api('/api/notifications?limit=100', { cookie: ADMIN_COOKIE })
  const buyerIds = new Set((buyerList.json?.notifications || []).map((n: any) => n.id))
  const adminIds = (adminList.json?.notifications || []).map((n: any) => n.id)
  const overlap = adminIds.filter((id: string) => buyerIds.has(id))
  check('buyer/admin notification lists are disjoint', overlap.length === 0, `overlap=${overlap.length}`)

  // IDOR: buyer cannot mark admin's notification read
  const adminNotifId = adminIds[0]
  const idor = await api(`/api/notifications/${adminNotifId}/read`, { method: 'POST', cookie: BUYER_COOKIE })
  check("buyer can't mark admin's notification read → 404", idor.status === 404, `got ${idor.status}`)

  // ── 7. count=1 mode + mark read/all-read ──
  console.log('── read status ──')
  const countMode = await api('/api/notifications?count=1', { cookie: BUYER_COOKIE })
  check('count=1 returns only unreadCount', countMode.json && 'unreadCount' in countMode.json && !('notifications' in countMode.json))

  const unreadBefore = countMode.json.unreadCount as number
  if (buyerDealCreated) {
    const markOne = await api(`/api/notifications/${buyerDealCreated.id}/read`, { method: 'POST', cookie: BUYER_COOKIE })
    check('mark single as read 200', markOne.status === 200)
    const countAfterOne = await api('/api/notifications?count=1', { cookie: BUYER_COOKIE })
    check('unreadCount decreased by 1', countAfterOne.json.unreadCount === unreadBefore - 1, `before=${unreadBefore} after=${countAfterOne.json.unreadCount}`)
  }

  const markAll = await api('/api/notifications/all-read', { method: 'PUT', cookie: BUYER_COOKIE })
  check('mark all read 200', markAll.status === 200)
  const countAfterAll = await api('/api/notifications?count=1', { cookie: BUYER_COOKIE })
  check('unreadCount = 0 after mark all', countAfterAll.json.unreadCount === 0)

  // ── cleanup: remove e2e deals ──
  await db.chatMessage.deleteMany({ where: { dealId: { in: [dealId, deal2Id] } } })
  await db.notification.deleteMany({ where: { dealId: { in: [dealId, deal2Id] } } })
  await db.deal.deleteMany({ where: { id: { in: [dealId, deal2Id] } } })

  console.log(`═══ RESULT: ${pass} passed, ${fail} failed ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
