/**
 * Seed script for the digital-product E2E test.
 * Copies db/custom.db → db/test-digital.db (unchanged master) and ensures:
 *   - seller user (isSeller=1, sellerDisabled=0)
 *   - buyer user (isSeller=0)
 * Prints the ids as shell-eval lines: SELLER_ID=..., BUYER_ID=..., PRODUCT_ID=...
 */
import { createClient } from '@libsql/client'
import { copyFileSync, existsSync, rmSync } from 'fs'

const ROOT = '/home/z/my-project/amardeal'
const SRC = `${ROOT}/db/custom.db`
const DST = `${ROOT}/db/test-digital.db`

// Fresh copy each run
if (existsSync(DST)) rmSync(DST)
copyFileSync(SRC, DST)

const db = createClient({ url: `file:${DST}` })

const TS = new Date().toISOString()
const SELLER_ID = 'test-seller-digital01'
const BUYER_ID = 'test-buyer-digital01'
const PRODUCT_ID = 'test-prod-free-0001'
const PRODUCT_PAID_ID = 'test-prod-paid-0001'
const DEAL_ID = 'test-deal-paid-0001'

async function upsertUser(id: string, isSeller: number, email: string, phone: string) {
  await db.execute({
    sql: `INSERT INTO "User" ("id","name","email","phone","password","isSeller","sellerDisabled","isActive","emailVerified","affiliateBalance","createdAt","updatedAt")
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT("id") DO UPDATE SET "isSeller"=excluded."isSeller", "sellerDisabled"=0, "isActive"=1`,
    args: [id, isSeller ? 'Test Seller' : 'Test Buyer', email, phone, '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummy', isSeller, 0, 1, 0, 0, TS, TS],
  })
}

await upsertUser(SELLER_ID, 1, 'digital-seller@test.local', '+8801711000001')
await upsertUser(BUYER_ID, 0, 'digital-buyer@test.local', '+8801711000002')

// Free digital product (owned by seller, active)
await db.execute({
  sql: `INSERT INTO "DigitalProduct" ("id","title","description","price","category","sellerId","status","quantity","isFree","fileKey","fileName","fileSize","fileType","createdAt","updatedAt")
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT("id") DO UPDATE SET "fileKey"=excluded."fileKey", "isFree"=1, "fileName"=excluded."fileName", "status"='active'`,
  args: [PRODUCT_ID, 'Free Digital Product', 'E2E free digital product', 0, 'education', SELLER_ID, 'active', 10, 1, `files/${SELLER_ID}/1726000000-abcdef0123456789.pdf`, 'free-ebook.pdf', 1048576, 'application/pdf', TS, TS],
})

// Paid digital product (price 500, has file)
await db.execute({
  sql: `INSERT INTO "DigitalProduct" ("id","title","description","price","category","sellerId","status","quantity","isFree","fileKey","fileName","fileSize","fileType","createdAt","updatedAt")
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT("id") DO UPDATE SET "fileKey"=excluded."fileKey", "isFree"=0, "fileName"=excluded."fileName", "price"=500, "status"='active'`,
  args: [PRODUCT_PAID_ID, 'Paid Digital Product', 'E2E paid digital product', 500, 'education', SELLER_ID, 'active', 10, 0, `files/${SELLER_ID}/1726000001-0123456789abcdef.zip`, 'paid-bundle.zip', 5242880, 'application/zip', TS, TS],
})

// Deal for the paid product — starts as 'created' (payment not yet verified)
await db.execute({
  sql: `DELETE FROM "Deal" WHERE "id"=?`,
  args: [DEAL_ID],
})
await db.execute({
  sql: `INSERT INTO "Deal" ("id","title","amount","status","buyerId","sellerId","creatorId","productId","createdAt","updatedAt")
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
  args: [DEAL_ID, 'Paid Digital Product', 500, 'created', BUYER_ID, SELLER_ID, BUYER_ID, PRODUCT_PAID_ID, TS, TS],
})

// Cleanup: no stale grants for the buyer on the free product
await db.execute({ sql: `DELETE FROM "ProductDownload" WHERE "productId"=? AND "userId"=?`, args: [PRODUCT_ID, BUYER_ID] })
await db.execute({ sql: `DELETE FROM "ProductDownload" WHERE "productId"=? AND "userId"=?`, args: [PRODUCT_PAID_ID, BUYER_ID] })

console.log(`SELLER_ID=${SELLER_ID}`)
console.log(`BUYER_ID=${BUYER_ID}`)
console.log(`FREE_PRODUCT_ID=${PRODUCT_ID}`)
console.log(`PAID_PRODUCT_ID=${PRODUCT_PAID_ID}`)
console.log(`DEAL_ID=${DEAL_ID}`)
