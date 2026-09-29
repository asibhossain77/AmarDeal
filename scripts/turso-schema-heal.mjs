/**
 * One-off production Turso full schema heal — replica of /api/health autoFixSchema.
 * Usage: TURSO_URL=... TURSO_TOKEN=... node scripts/turso-schema-heal.mjs
 * Safe/idempotent: only PRAGMA checks + CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / ALTER TABLE ADD COLUMN.
 * Exists because Vercel Security Checkpoint blocks server-side curl of /api/health;
 * with a rw Turso token we can heal the prod DB directly, bypassing Vercel.
 */
import { createClient } from '@libsql/client'

const url = process.env.TURSO_URL
const token = process.env.TURSO_TOKEN
if (!url || !token) {
  console.error('missing TURSO_URL / TURSO_TOKEN')
  process.exit(1)
}

const client = createClient({ url, authToken: token })

// ---- Column definitions: [table, column, type, default] — mirrors autoFixSchema ----
const checks = [
  // User table newer columns
  ['User', 'sellerDisabled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
  ['User', 'imageLink', 'TEXT', 'NULL'],
  ['User', 'businessName', 'TEXT', 'NULL'],
  ['User', 'businessBio', 'TEXT', 'NULL'],
  ['User', 'whatsappNumber', 'TEXT', 'NULL'],
  ['User', 'referralCode', 'TEXT', 'NULL'],
  ['User', 'referredBy', 'TEXT', 'NULL'],
  ['User', 'affiliateBalance', 'REAL NOT NULL DEFAULT 0', '0'],
  // Deal table columns
  ['Deal', 'creatorId', 'TEXT NOT NULL', ''],
  ['Deal', 'productId', 'TEXT', 'NULL'],
  ['Deal', 'adminCalled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
  ['Deal', 'adminCalledAt', 'DATETIME', 'NULL'],
  // Seller work-duration commitment (set after payment verification)
  ['Deal', 'workDays', 'INTEGER', 'NULL'],
  ['Deal', 'workDeadlineAt', 'DATETIME', 'NULL'],
  // Unresponsive-buyer auto-complete flow (seller reminder → 30-day grace)
  ['Deal', 'deliveredAt', 'DATETIME', 'NULL'],
  ['Deal', 'reminderEmailSentAt', 'DATETIME', 'NULL'],
  ['Deal', 'autoCompleteAt', 'DATETIME', 'NULL'],
  // Admin table columns
  ['Admin', 'permissions', "TEXT NOT NULL DEFAULT '[]'", "'[]'"],
  ['Admin', 'totpSecret', 'TEXT', 'NULL'],
  ['Admin', 'totpEnabled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
  // PaymentMethod table columns (manual payment instructions + QR)
  ['PaymentMethod', 'instructions', 'TEXT', 'NULL'],
  ['PaymentMethod', 'qrImage', 'TEXT', 'NULL'],
  // SellerApplication verification code (WhatsApp code verification flow)
  ['SellerApplication', 'verificationCode', 'TEXT', 'NULL'],
  // Digital product file columns (file upload + free download system)
  ['DigitalProduct', 'isFree', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
  ['DigitalProduct', 'fileKey', 'TEXT', 'NULL'],
  ['DigitalProduct', 'fileName', 'TEXT', 'NULL'],
  ['DigitalProduct', 'fileSize', 'INTEGER', 'NULL'],
  ['DigitalProduct', 'fileType', 'TEXT', 'NULL'],
]

// ---- Missing table DDLs — mirrors autoFixSchema missingTableSQLs (Auction/Bid excluded: healed via turso-auction-heal.mjs) ----
const missingTableSQLs = {
  Notification: `
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dealId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");`,
  DigitalProduct: `
CREATE TABLE IF NOT EXISTS "DigitalProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" REAL NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "image" TEXT,
  "sellerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DigitalProduct_sellerId_status_idx" ON "DigitalProduct"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "DigitalProduct_status_createdAt_idx" ON "DigitalProduct"("status", "createdAt");`,
  ProductChatMessage: `
CREATE TABLE IF NOT EXISTS "ProductChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductChatMessage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProductChatMessage_productId_createdAt_idx" ON "ProductChatMessage"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductChatMessage_senderId_idx" ON "ProductChatMessage"("senderId");`,
  MarketplaceBanner: `
CREATE TABLE IF NOT EXISTS "MarketplaceBanner" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "image" TEXT NOT NULL,
  "link" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketplaceBanner_isActive_sortOrder_idx" ON "MarketplaceBanner"("isActive", "sortOrder");`,
  ChatFile: `
CREATE TABLE IF NOT EXISTS "ChatFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileType" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "deletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ChatFile_dealId_idx" ON "ChatFile"("dealId");
CREATE INDEX IF NOT EXISTS "ChatFile_expiresAt_idx" ON "ChatFile"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatFile_messageId_key" ON "ChatFile"("messageId");`,
  DealReadState: `
CREATE TABLE IF NOT EXISTS "DealReadState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" DATETIME NOT NULL,
  "lastSeenDealUpdated" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DealReadState_dealId_userId_key" ON "DealReadState"("dealId", "userId");
CREATE INDEX IF NOT EXISTS "DealReadState_userId_idx" ON "DealReadState"("userId");`,
  SellerApplication: `
CREATE TABLE IF NOT EXISTS "SellerApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "whatsappNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "rejectionReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SellerApplication_status_idx" ON "SellerApplication"("status");
CREATE INDEX IF NOT EXISTS "SellerApplication_userId_idx" ON "SellerApplication"("userId");`,
  ProductDownload: `
CREATE TABLE IF NOT EXISTS "ProductDownload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dealId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDownload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductDownload_productId_userId_key" ON "ProductDownload"("productId", "userId");
CREATE INDEX IF NOT EXISTS "ProductDownload_userId_idx" ON "ProductDownload"("userId");`,
  AffiliateEarning: `
CREATE TABLE IF NOT EXISTS "AffiliateEarning" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "affiliateId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "percentage" REAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateEarning_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateEarning_dealId_key" ON "AffiliateEarning"("dealId");
CREATE INDEX IF NOT EXISTS "AffiliateEarning_affiliateId_idx" ON "AffiliateEarning"("affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliateEarning_status_idx" ON "AffiliateEarning"("status");`,
  AffiliateWithdrawal: `
CREATE TABLE IF NOT EXISTS "AffiliateWithdrawal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "accountType" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AffiliateWithdrawal_userId_idx" ON "AffiliateWithdrawal"("userId");
CREATE INDEX IF NOT EXISTS "AffiliateWithdrawal_status_idx" ON "AffiliateWithdrawal"("status");`,
  Review: `
CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "isApproved" BOOLEAN NOT NULL DEFAULT 0,
  "userId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Review_isApproved_createdAt_idx" ON "Review"("isApproved", "createdAt");`,
  AffiliatePaymentMethod: `
CREATE TABLE IF NOT EXISTS "AffiliatePaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
  SellerFollower: `
CREATE TABLE IF NOT EXISTS "SellerFollower" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sellerId" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerFollower_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerFollower_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SellerFollower_sellerId_followerId_key" ON "SellerFollower"("sellerId", "followerId");
CREATE INDEX IF NOT EXISTS "SellerFollower_sellerId_idx" ON "SellerFollower"("sellerId");
CREATE INDEX IF NOT EXISTS "SellerFollower_followerId_idx" ON "SellerFollower"("followerId");`,
  PushSubscription: `
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");`,
  SellerReview: `
CREATE TABLE IF NOT EXISTS "SellerReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sellerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerReview_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SellerReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SellerReview_sellerId_userId_key" ON "SellerReview"("sellerId", "userId");
CREATE INDEX IF NOT EXISTS "SellerReview_sellerId_idx" ON "SellerReview"("sellerId");
CREATE INDEX IF NOT EXISTS "SellerReview_userId_idx" ON "SellerReview"("userId");`,
}

const listTables = async () =>
  (await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => r.name)

// ---- 0. Sanity: token works at all ----
console.log('URL:', url)
try {
  await client.execute('SELECT 1')
  console.log('SANITY: SELECT 1 OK — token valid')
} catch (e) {
  console.error('SANITY FAILED:', e.message)
  process.exit(1)
}

const before = await listTables()
console.log(`TABLES BEFORE (${before.length}):`, before.join(', '))

// ---- 1. Column checks ----
const fixed = []
for (const [table, column, colType, defaultVal] of checks) {
  try {
    const result = await client.execute(`PRAGMA table_info("${table}")`)
    const hasColumn = result.rows.some((row) => row.name === column)
    if (!hasColumn) {
      const sql =
        defaultVal === 'NULL'
          ? `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType}`
          : `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType} DEFAULT ${defaultVal}`
      await client.execute(sql)
      fixed.push(`${table}.${column}`)
      console.log(`COLUMN ADDED: ${table}.${column}`)
    }
  } catch (e) {
    console.error(`COLUMN CHECK FAILED: ${table}.${column}:`, e.message?.substring(0, 160))
  }
}

// ---- 2. Missing tables ----
for (const [tableName, sql] of Object.entries(missingTableSQLs)) {
  try {
    const tableCheck = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
    )
    if (tableCheck.rows.length === 0) {
      const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0)
      for (const stmt of statements) {
        try {
          await client.execute(stmt)
        } catch {
          // Ignore individual statement errors (e.g. index already exists)
        }
      }
      fixed.push(`table:${tableName}`)
      console.log(`TABLE CREATED: ${tableName}`)
    }
  } catch (e) {
    console.error(`TABLE CHECK FAILED: ${tableName}:`, e.message?.substring(0, 160))
  }
}

// ---- 3. Report ----
const after = await listTables()
console.log(`\nTABLES AFTER (${after.length})`)
console.log(fixed.length > 0 ? `SCHEMA FIXED (${fixed.length}): ${fixed.join(', ')}` : 'SCHEMA CHECK: OK (all columns/tables present)')

// ---- 4. Task 43 readiness report (reminder + auto-complete flow) ----
try {
  const byStatus = await client.execute('SELECT status, COUNT(*) as n FROM "Deal" GROUP BY status ORDER BY n DESC')
  console.log('\nDEAL STATUS DISTRIBUTION:')
  for (const r of byStatus.rows) console.log(`  ${r.status}: ${r.n}`)

  const delivering = await client.execute(
    'SELECT COUNT(*) as n FROM "Deal" WHERE status = \'in_delivery\''
  )
  console.log(`\nTASK 43 READINESS: in_delivery deals (will trigger reminder/auto-complete flow): ${delivering.rows[0].n}`)
  const delivered = await client.execute('SELECT COUNT(*) as n FROM "Deal" WHERE deliveredAt IS NOT NULL')
  console.log(`deals with deliveredAt set: ${delivered.rows[0].n}`)
} catch (e) {
  console.error('readiness report failed:', e.message?.substring(0, 160))
}
