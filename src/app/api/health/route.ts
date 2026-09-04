import { createClient } from '@libsql/client'
import { NextResponse } from 'next/server'

/**
 * Health + DB diagnostic + auto-setup endpoint.
 * If Turso tables are missing, creates them automatically.
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? ''
  const token = process.env.TURSO_AUTH_TOKEN

  const info: Record<string, string> = {
    nodeEnv: process.env.NODE_ENV || 'not set',
    hasDbUrl: url ? 'yes' : 'NO',
    dbUrlPrefix: url.substring(0, 30),
    hasTursoToken: token ? 'yes' : 'NO',
  }

  // Direct Turso connection (bypass Prisma entirely)
  if (url.startsWith('libsql://')) {
    if (!token) {
      info['directTurso'] = 'FAILED - missing TURSO_AUTH_TOKEN'
      return NextResponse.json(info)
    }

    const client = createClient({ url, authToken: token })

    // Check if User table exists
    try {
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='User'"
      )
      if (tables.rows.length === 0) {
        info['autoSetup'] = 'Creating tables...'

        const statements = SETUP_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0)
        for (const sql of statements) {
          try {
            await client.execute(sql)
          } catch (e: any) {
            info['setupError'] = e.message?.substring(0, 200)
          }
        }

        // Seed admin
        try {
          await client.execute(SEED_SQL)
          info['adminSeed'] = 'OK'
        } catch (e: any) {
          info['adminSeed'] = e.message?.substring(0, 100)
        }

        info['autoSetup'] = 'DONE'
      } else {
        info['tablesExist'] = 'yes'
      }

      // Check for missing columns on existing tables and auto-fix
      try {
        const fixed = await autoFixSchema(client)
        if (fixed.length > 0) {
          info['schemaAutoFixed'] = fixed.join(', ')
        } else {
          info['schemaCheck'] = 'OK (all columns present)'
        }
      } catch (e: any) {
        info['schemaCheck'] = 'error: ' + (e.message?.substring(0, 200) || '?')
      }

      // Count users
      try {
        const result = await client.execute('SELECT count(*) as cnt FROM "User"')
        info['userCount'] = String(result.rows[0]?.cnt ?? 0)
      } catch (e: any) {
        info['userCount'] = 'error: ' + (e.message?.substring(0, 100) || '?')
      }

      info['directTurso'] = 'OK'
      await client.close()
    } catch (err: any) {
      info['directTurso'] = 'FAILED'
      info['tursoError'] = err.message?.substring(0, 300) || String(err)
    }
  }

  // Prisma test (after tables exist)
  try {
    const { db } = await import('@/lib/db')
    const userCount = await db.user.count()
    info['prismaConnection'] = 'OK'
    info['prismaUserCount'] = String(userCount)
  } catch (err: any) {
    info['prismaConnection'] = 'FAILED'
    info['prismaError'] = err.message?.substring(0, 300) || String(err)
  }

  return NextResponse.json(info)
}

/**
 * Check for missing columns and add them via ALTER TABLE ADD COLUMN.
 * Returns list of columns that were added.
 */
async function autoFixSchema(client: ReturnType<typeof createClient>): Promise<string[]> {
  const fixed: string[] = []

  // Column definitions: [table, column, type, default]
  const checks: [string, string, string, string][] = [
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
    // Admin table columns
    ['Admin', 'permissions', 'TEXT NOT NULL DEFAULT \'[]\'', '\'[]\''],
    ['Admin', 'totpSecret', 'TEXT', 'NULL'],
    ['Admin', 'totpEnabled', 'BOOLEAN NOT NULL DEFAULT 0', '0'],
  ]

  for (const [table, column, colType, defaultVal] of checks) {
    try {
      // Check if column exists
      const result = await client.execute(`PRAGMA table_info("${table}")`)
      const hasColumn = result.rows.some((row: any) => row.name === column)
      if (!hasColumn) {
        const sql = defaultVal === 'NULL'
          ? `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType}`
          : `ALTER TABLE "${table}" ADD COLUMN "${column}" ${colType} DEFAULT ${defaultVal}`
        await client.execute(sql)
        fixed.push(`${table}.${column}`)
      }
    } catch {
      // Column check/add failed — might not be critical
    }
  }

  // Check for missing tables and create them
  const missingTableSQLs: Record<string, string> = {
    'Notification': `
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
    'DigitalProduct': `
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
    'ProductChatMessage': `
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
    'MarketplaceBanner': `
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
    'SellerApplication': `
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
    'AffiliateEarning': `
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
    'AffiliateWithdrawal': `
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
    'Review': `
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
    'AffiliatePaymentMethod': `
CREATE TABLE IF NOT EXISTS "AffiliatePaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
    'SellerFollower': `
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
    'PushSubscription': `
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
    'SellerReview': `
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

  for (const [tableName, sql] of Object.entries(missingTableSQLs)) {
    try {
      const tableCheck = await client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
      )
      if (tableCheck.rows.length === 0) {
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0)
        for (const stmt of statements) {
          try {
            await client.execute(stmt)
          } catch {
            // Ignore individual statement errors (e.g. index already exists)
          }
        }
        fixed.push(`table:${tableName}`)
      }
    } catch {
      // Table creation check failed
    }
  }

  return fixed
}

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "isSeller" BOOLEAN NOT NULL DEFAULT 0,
  "sellerDisabled" BOOLEAN NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "emailVerified" BOOLEAN NOT NULL DEFAULT 0,
  "resetToken" TEXT,
  "resetTokenExpiry" DATETIME,
  "googleId" TEXT,
  "imageLink" TEXT,
  "referralCode" TEXT,
  "referredBy" TEXT,
  "affiliateBalance" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE TABLE IF NOT EXISTS "Admin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'support',
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "totpSecret" TEXT,
  "totpEnabled" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Admin_userId_key" ON "Admin"("userId");
CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountType" TEXT NOT NULL DEFAULT 'personal',
  "status" TEXT NOT NULL DEFAULT 'active',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT NOT NULL DEFAULT '#84CC16',
  "image" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Deal" (
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
  "productId" TEXT,
  "adminCalled" BOOLEAN NOT NULL DEFAULT 0,
  "adminCalledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Deal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Deal_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "FeeRule" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "minimum_amount" INTEGER NOT NULL,
  "maximum_amount" INTEGER NOT NULL DEFAULT 0,
  "fee" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE TABLE IF NOT EXISTS "ContactInfo" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT,
  "email" TEXT,
  "whatsapp" TEXT,
  "telegram" TEXT,
  "facebook" TEXT,
  "facebookGroup" TEXT,
  "telegramGroup" TEXT,
  "address" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Payout" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "role" TEXT,
  "senderName" TEXT,
  "text" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ChatMessage_dealId_createdAt_idx" ON "ChatMessage"("dealId", "createdAt");
CREATE TABLE IF NOT EXISTS "BlogPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "coverImage" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_published_createdAt_idx" ON "BlogPost"("published", "createdAt");
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
CREATE INDEX IF NOT EXISTS "DigitalProduct_status_createdAt_idx" ON "DigitalProduct"("status", "createdAt");
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
CREATE INDEX IF NOT EXISTS "ProductChatMessage_senderId_idx" ON "ProductChatMessage"("senderId");
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
CREATE INDEX IF NOT EXISTS "MarketplaceBanner_isActive_sortOrder_idx" ON "MarketplaceBanner"("isActive", "sortOrder");
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
CREATE INDEX IF NOT EXISTS "SellerApplication_userId_idx" ON "SellerApplication"("userId");
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
CREATE INDEX IF NOT EXISTS "AffiliateEarning_status_idx" ON "AffiliateEarning"("status");
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
CREATE INDEX IF NOT EXISTS "AffiliateWithdrawal_status_idx" ON "AffiliateWithdrawal"("status");
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
CREATE INDEX IF NOT EXISTS "Review_isApproved_createdAt_idx" ON "Review"("isApproved", "createdAt");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
CREATE TABLE IF NOT EXISTS "AffiliatePaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
CREATE INDEX IF NOT EXISTS "SellerFollower_followerId_idx" ON "SellerFollower"("followerId");
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
CREATE INDEX IF NOT EXISTS "SellerReview_userId_idx" ON "SellerReview"("userId");
`

const SEED_SQL = `
INSERT OR IGNORE INTO "User" ("id", "name", "phone", "email", "password", "isSeller", "isActive", "createdAt", "updatedAt")
VALUES ('cmrar4fgy0000vcitwu695oe7', 'অ্যাডমিন', '01700000000', 'admin@demo.com', '123456', 0, 1, '2026-07-07T14:35:51.251Z', '2026-07-07T14:35:51.251Z');
INSERT OR IGNORE INTO "Admin" ("id", "userId", "role", "createdAt", "updatedAt")
VALUES ('cmrar4fgy0001vcit6evmxgcu', 'cmrar4fgy0000vcitwu695oe7', 'super_admin', '2026-07-07T14:35:51.251Z', '2026-07-07T14:35:51.251Z');
INSERT OR IGNORE INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('contract_text', 'এই চুক্তি অনুযায়ী উভয় পক্ষ সম্মত হলো।', CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('platform_name', 'Amar Deal', CURRENT_TIMESTAMP);
`