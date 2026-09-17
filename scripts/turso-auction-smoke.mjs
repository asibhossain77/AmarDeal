/**
 * One-off smoke test on production Turso: insert Auction + Bid, read back, clean up.
 * Usage: TURSO_URL=... TURSO_TOKEN=... node scripts/turso-auction-smoke.mjs
 */
import { createClient } from '@libsql/client'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) {
  console.error('missing TURSO_URL / TURSO_TOKEN')
  process.exit(1)
}
const client = createClient({ url, authToken: token })

async function main() {
  // pick a real seller to satisfy FK
  const seller = await client.execute(
    'SELECT id FROM "User" WHERE "isSeller" = 1 AND "isActive" = 1 LIMIT 1'
  )
  if (seller.rows.length === 0) throw new Error('no active seller user found')
  const sellerId = seller.rows[0].id
  console.log('seller for smoke test:', sellerId)

  const auctionId = 'smoke-auc-' + Date.now()
  const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await client.execute({
    sql: `INSERT INTO "Auction" ("id","title","description","category","sellerId","startPrice","status","endsAt","updatedAt")
          VALUES (?,'SMOKE TEST — delete me','smoke test row','other',?,250,'active',?,?)`,
    args: [auctionId, sellerId, endsAt, endsAt],
  })
  console.log('insert Auction ok')

  const buyerId = sellerId // FK only requires an existing user
  await client.execute({
    sql: `INSERT INTO "Bid" ("id","auctionId","bidderId","amount") VALUES (?,?,?,260)`,
    args: ['smoke-bid-' + Date.now(), auctionId, buyerId],
  })
  console.log('insert Bid ok')

  const check = await client.execute({
    sql: `SELECT a.id, a.title, a.status, a.startPrice,
                 (SELECT COUNT(*) FROM "Bid" b WHERE b."auctionId" = a.id) AS bids
          FROM "Auction" a WHERE a.id = ?`,
    args: [auctionId],
  })
  console.log('read back:', check.rows[0])

  const upd = await client.execute({
    sql: `UPDATE "Auction" SET "currentPrice"=260, "highestBidderId"=?, "bidCount"=1, "updatedAt"=? WHERE "id"=?`,
    args: [buyerId, new Date().toISOString(), auctionId],
  })
  console.log('update ok, rows affected:', upd.rowsAffected)

  await client.execute({ sql: `DELETE FROM "Bid" WHERE "auctionId"=?`, args: [auctionId] })
  await client.execute({ sql: `DELETE FROM "Auction" WHERE "id"=?`, args: [auctionId] })
  console.log('cleanup ok — no test rows left')

  const final = await client.execute('SELECT COUNT(*) AS c FROM "Auction"')
  console.log('Auction rows now:', final.rows[0].c, '(should be 0)')
  console.log('SMOKE TEST PASSED ✓')
}

main()
  .then(() => client.close())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('SMOKE FAILED:', e)
    process.exit(1)
  })
