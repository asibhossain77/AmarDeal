import { createClient } from '@libsql/client'

const TURSO_URL = process.env.DATABASE_URL!
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
})

async function setup() {
  console.log('Connecting to Turso...')

  const result = await client.execute('SELECT 1 as test')
  console.log('Connected! Test query:', result.rows[0])

  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "isSeller" BOOLEAN NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

    `CREATE TABLE IF NOT EXISTS "Admin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'support',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Admin_userId_key" ON "Admin"("userId")`,

    `CREATE TABLE IF NOT EXISTS "PaymentMethod" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "accountNumber" TEXT NOT NULL,
      "accountType" TEXT NOT NULL DEFAULT 'personal',
      "status" TEXT NOT NULL DEFAULT 'active',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "color" TEXT NOT NULL DEFAULT '#84CC16',
      "image" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "Deal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'created',
      "buyerId" TEXT NOT NULL,
      "sellerId" TEXT,
      "creatorId" TEXT NOT NULL,
      "terms" TEXT,
      "paymentMethodId" TEXT,
      "senderNumber" TEXT,
      "transactionId" TEXT,
      "paymentAmount" REAL,
      "platformFee" REAL,
      "rejectionReason" TEXT,
      "adminCalled" BOOLEAN NOT NULL DEFAULT 0,
      "adminCalledAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Deal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Deal_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS "PlatformSetting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "FeeRule" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "minimum_amount" INTEGER NOT NULL,
      "maximum_amount" INTEGER NOT NULL DEFAULT 0,
      "fee" INTEGER NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "dealId" TEXT,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "read" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId")`,

    `CREATE TABLE IF NOT EXISTS "ContactInfo" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "phone" TEXT,
      "email" TEXT,
      "whatsapp" TEXT,
      "telegram" TEXT,
      "facebook" TEXT,
      "facebookGroup" TEXT,
      "address" TEXT,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "Payout" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "dealId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "recipientId" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "accountType" TEXT NOT NULL,
      "accountNumber" TEXT NOT NULL,
      "accountName" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "dealId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "role" TEXT,
      "senderName" TEXT,
      "text" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "ChatMessage_dealId_createdAt_idx" ON "ChatMessage"("dealId", "createdAt")`,
  ]

  for (let i = 0; i < statements.length; i++) {
    try {
      await client.execute(statements[i])
      console.log(`✅ [${i + 1}/${statements.length}] OK`)
    } catch (err: any) {
      console.error(`❌ [${i + 1}/${statements.length}]`, err.message)
    }
  }

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  console.log('\n📋 Tables in Turso:')
  tables.rows.forEach((r: any) => console.log('  -', r.name))

  await client.close()
  console.log('\n✅ Done! Database is ready.')
}

setup().catch(console.error)