import { createClient, type Client } from '@libsql/client'
import { NextResponse } from 'next/server'

// SQL statements matching the Prisma schema exactly
const CREATE_TABLES_SQL = `
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
`

// Seed data: admin user + default settings
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

export async function GET() {
  const results: string[] = []

  const dbUrl = process.env.DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  if (!dbUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL environment variable is not set' },
      { status: 500 }
    )
  }

  let client: Client

  if (dbUrl.startsWith('libsql://')) {
    if (!tursoToken) {
      return NextResponse.json(
        { error: 'TURSO_AUTH_TOKEN is required for Turso connections' },
        { status: 500 }
      )
    }
    client = createClient({
      url: dbUrl,
      authToken: tursoToken,
    })
    results.push('Connected to Turso (libsql)')
  } else {
    client = createClient({ url: dbUrl })
    results.push('Connected to local SQLite')
  }

  try {
    // Execute each CREATE statement
    const sqlStatements = CREATE_TABLES_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const sql of sqlStatements) {
      try {
        await client.execute(sql)
        const match = sql.match(/(?:CREATE TABLE IF NOT EXISTS|CREATE UNIQUE INDEX IF NOT EXISTS|CREATE INDEX IF NOT EXISTS)\s+"?(\w+)"?/i)
        if (match) {
          results.push(`✅ Created: ${match[1]}`)
        }
      } catch (err: any) {
        results.push(`⚠️ Statement error: ${err.message}`)
      }
    }

    // Seed data
    try {
      const seedStatements = SEED_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0)
      for (const sql of seedStatements) {
        await client.execute(sql)
        const match = sql.match(/INSERT OR IGNORE INTO\s+"?(\w+)"?/i)
        if (match) {
          results.push(`🌱 Seeded: ${match[1]}`)
        }
      }
    } catch (seedErr: any) {
      results.push(`⚠️ Seed warning: ${seedErr.message}`)
    }

    // Verify by listing tables
    try {
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      results.push(`📊 Tables: ${tables.rows.map(r => r.name).join(', ')}`)
    } catch (e: any) {
      results.push(`⚠️ Could not list tables: ${e.message}`)
    }

    // Verify admin user
    try {
      const admin = await client.execute(
        `SELECT u.id, u.name, u.email, a.role
         FROM "User" u LEFT JOIN "Admin" a ON u.id = a.userId
         WHERE a.role = 'super_admin'`
      )
      if (admin.rows.length > 0) {
        results.push(`🔑 Admin verified: ${admin.rows[0].email}`)
      } else {
        results.push(`⚠️ Admin user not found!`)
      }
    } catch (e: any) {
      results.push(`⚠️ Could not verify admin: ${e.message}`)
    }

    client.close()

    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      details: results,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        details: results,
      },
      { status: 500 }
    )
  }
}