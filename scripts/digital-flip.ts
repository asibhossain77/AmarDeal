/**
 * E2E helper — flips the seeded paid deal to payment_verified.
 * Usage: bun scripts/digital-flip.ts [status]
 */
import { createClient } from '@libsql/client'

const status = process.argv[2] || 'payment_verified'
const db = createClient({ url: 'file:/home/z/my-project/amardeal/db/test-digital.db' })
await db.execute({
  sql: `UPDATE "Deal" SET "status"=?, "updatedAt"=? WHERE "id"='test-deal-paid-0001'`,
  args: [status, new Date().toISOString()],
})
console.log(`deal flipped to ${status}`)
