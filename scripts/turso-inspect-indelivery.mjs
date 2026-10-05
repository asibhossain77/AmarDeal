/**
 * Read-only: list in_delivery deals with deliveredAt IS NULL (legacy pre-Task-43 rows)
 * Usage: TURSO_URL=... TURSO_TOKEN=... node scripts/turso-inspect-indelivery.mjs
 */
import { createClient } from '@libsql/client'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) {
  console.error('missing TURSO_URL / TURSO_TOKEN')
  process.exit(1)
}
const client = createClient({ url, authToken: token })

const res = await client.execute(`
  SELECT d.id, d.status, d.amount, d.deliveredAt, d.reminderEmailSentAt, d.autoCompleteAt,
         d.workDeadlineAt, d.updatedAt, d.createdAt,
         ub.name as buyerName, us.name as sellerName
  FROM "Deal" d
  LEFT JOIN "User" ub ON ub.id = d.buyerId
  LEFT JOIN "User" us ON us.id = d.sellerId
  WHERE d.status = 'in_delivery'
  ORDER BY d.updatedAt DESC
`)
console.log(`in_delivery deals: ${res.rows.length}`)
for (const r of res.rows) {
  console.log(JSON.stringify({
    id: r.id, amount: r.amount,
    buyer: r.buyerName, seller: r.sellerName,
    deliveredAt: r.deliveredAt, reminderEmailSentAt: r.reminderEmailSentAt, autoCompleteAt: r.autoCompleteAt,
    workDeadlineAt: r.workDeadlineAt, updatedAt: r.updatedAt, createdAt: r.createdAt,
  }))
}
