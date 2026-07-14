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

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "isSeller" BOOLEAN NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE TABLE IF NOT EXISTS "Admin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'support',
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