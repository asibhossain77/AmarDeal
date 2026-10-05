/**
 * One-off production Turso diagnostic + auction tables heal.
 * Usage: TURSO_URL=... TURSO_TOKEN=... node scripts/turso-auction-heal.mjs
 * Safe/idempotent: only CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / ALTER TABLE ADD COLUMN.
 */
import { createClient } from '@libsql/client'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) {
  console.error('missing TURSO_URL / TURSO_TOKEN')
  process.exit(1)
}

const client = createClient({ url, authToken: token })

const listTables = async () =>
  (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => r.name)

const tableExists = async (name) => {
  const res = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  })
  return res.rows.length > 0
}

const AUCTION_DDL = {
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

async function main() {
  console.log('== connected:', url)

  const before = await listTables()
  console.log('== tables before (' + before.length + '):', before.join(', '))

  // 1. Auction/Bid tables
  for (const [name, sql] of Object.entries(AUCTION_DDL)) {
    if (await tableExists(name)) {
      console.log(`-- ${name}: already exists`)
    } else {
      for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
        await client.execute(stmt)
      }
      console.log(`++ ${name}: CREATED`)
    }
  }

  // 2. Missing-column auto-fix (same list as /api/health autoFixSchema)
  const columnChecks = [
    ['User', 'sellerDisabled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
    ['User', 'imageLink', 'TEXT', 'NULL'],
    ['User', 'businessName', 'TEXT', 'NULL'],
    ['User', 'businessBio', 'TEXT', 'NULL'],
    ['User', 'whatsappNumber', 'TEXT', 'NULL'],
    ['User', 'referralCode', 'TEXT', 'NULL'],
    ['User', 'referredBy', 'TEXT', 'NULL'],
    ['User', 'affiliateBalance', 'REAL NOT NULL DEFAULT 0', '0'],
    ['Deal', 'creatorId', 'TEXT NOT NULL', "''"],
    ['Deal', 'productId', 'TEXT', 'NULL'],
    ['Deal', 'adminCalled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
    ['Deal', 'adminCalledAt', 'DATETIME', 'NULL'],
    ['DigitalProduct', 'isFree', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
    ['DigitalProduct', 'fileKey', 'TEXT', 'NULL'],
    ['DigitalProduct', 'fileName', 'TEXT', 'NULL'],
    ['DigitalProduct', 'fileSize', 'INTEGER', 'NULL'],
    ['DigitalProduct', 'fileType', 'TEXT', 'NULL'],
  ]
  for (const [table, column, colType, defaultVal] of columnChecks) {
    try {
      const info = await client.execute(`PRAGMA table_info("${table}")`)
      const has = info.rows.some((r) => r.name === column)
      if (!has) {
        const sql =
          defaultVal === 'NULL'
            ? `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType}`
            : `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType} DEFAULT ${defaultVal}`
        await client.execute(sql)
        console.log(`++ ${table}.${column}: column ADDED`)
      }
    } catch (e) {
      console.log(`-- ${table}.${column}: check skipped (${String(e.message).slice(0, 80)})`)
    }
  }

  // 3. Verify
  const after = await listTables()
  console.log('== tables after (' + after.length + '):', after.join(', '))
  const okA = await tableExists('Auction')
  const okB = await tableExists('Bid')
  const cntA = await client.execute('SELECT COUNT(*) AS c FROM "Auction"')
  const cntB = await client.execute('SELECT COUNT(*) AS c FROM "Bid"')
  const users = await client.execute('SELECT COUNT(*) AS c FROM "User"')
  console.log('== VERIFY Auction exists:', okA, '| rows:', cntA.rows[0].c)
  console.log('== VERIFY Bid exists:', okB, '| rows:', cntB.rows[0].c)
  console.log('== User count:', users.rows[0].c)
  console.log(okA && okB ? '== RESULT: PRODUCTION DB READY FOR NILAM ✓' : '== RESULT: FAILED ✗')
}

main()
  .then(() => client.close())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
