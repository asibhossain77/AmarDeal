import { createClient } from '@libsql/client'
import * as data from './local-data.json'

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

async function importData() {
  // Import users first (Admin depends on User)
  if (data.users.length) {
    for (const u of data.users) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "User" (id, name, phone, email, password, "isSeller", "isActive", "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [u.id, u.name, u.phone, u.email, u.password, u.isSeller ? 1 : 0, u.isActive ? 1 : 0, u.createdAt, u.updatedAt]
      })
    }
    console.log(`✅ Users: ${data.users.length}`)
  }

  if (data.admins?.length || data.users.some((u: any) => u.admin)) {
    const admins = data.users.map((u: any) => u.admin).filter(Boolean)
    for (const a of admins) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "Admin" (id, "userId", role, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)`,
        args: [a.id, a.userId, a.role, a.createdAt, a.updatedAt]
      })
    }
    console.log(`✅ Admins: ${admins.length}`)
  }

  if (data.paymentMethods?.length) {
    for (const p of data.paymentMethods) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "PaymentMethod" (id, name, "accountNumber", "accountType", status, "sortOrder", color, image, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [p.id, p.name, p.accountNumber, p.accountType, p.status, p.sortOrder, p.color, p.image, p.createdAt, p.updatedAt]
      })
    }
    console.log(`✅ PaymentMethods: ${data.paymentMethods.length}`)
  }

  if (data.feeRules?.length) {
    for (const f of data.feeRules) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "FeeRule" (id, "minimum_amount", "maximum_amount", fee, "is_active", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [f.id, f.minimum_amount, f.maximum_amount, f.fee, f.is_active ? 1 : 0, f.createdAt, f.updatedAt]
      })
    }
    console.log(`✅ FeeRules: ${data.feeRules.length}`)
  }

  if (data.settings?.length) {
    for (const s of data.settings) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "PlatformSetting" ("key", value, "updatedAt") VALUES (?, ?, ?)`,
        args: [s.key, s.value, s.updatedAt]
      })
    }
    console.log(`✅ PlatformSettings: ${data.settings.length}`)
  }

  if (data.contactInfo?.length) {
    for (const c of data.contactInfo) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "ContactInfo" (id, phone, email, whatsapp, telegram, facebook, "facebookGroup", address, "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [c.id, c.phone, c.email, c.whatsapp, c.telegram, c.facebook, c.facebookGroup, c.address, c.updatedAt]
      })
    }
    console.log(`✅ ContactInfo: ${data.contactInfo.length}`)
  }

  if (data.deals?.length) {
    for (const d of data.deals) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "Deal" (id, title, amount, status, "buyerId", "sellerId", "creatorId", terms, "paymentMethodId", "senderNumber", "transactionId", "paymentAmount", "platformFee", "rejectionReason", "adminCalled", "adminCalledAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [d.id, d.title, d.amount, d.status, d.buyerId, d.sellerId, d.creatorId, d.terms, d.paymentMethodId, d.senderNumber, d.transactionId, d.paymentAmount, d.platformFee, d.rejectionReason, d.adminCalled ? 1 : 0, d.adminCalledAt, d.createdAt, d.updatedAt]
      })
    }
    console.log(`✅ Deals: ${data.deals.length}`)
  }

  if (data.notifications?.length) {
    for (const n of data.notifications) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "Notification" (id, "userId", "dealId", type, title, message, "read", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [n.id, n.userId, n.dealId, n.type, n.title, n.message, n.read ? 1 : 0, n.createdAt, n.updatedAt]
      })
    }
    console.log(`✅ Notifications: ${data.notifications.length}`)
  }

  if (data.payouts?.length) {
    for (const p of data.payouts) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "Payout" (id, "dealId", type, "recipientId", amount, "accountType", "accountNumber", "accountName", status, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [p.id, p.dealId, p.type, p.recipientId, p.amount, p.accountType, p.accountNumber, p.accountName, p.status, p.createdAt, p.updatedAt]
      })
    }
    console.log(`✅ Payouts: ${data.payouts.length}`)
  }

  if (data.chatMessages?.length) {
    for (const c of data.chatMessages) {
      await client.execute({
        sql: `INSERT OR IGNORE INTO "ChatMessage" (id, "dealId", "senderId", role, "senderName", text, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [c.id, c.dealId, c.senderId, c.role, c.senderName, c.text, c.createdAt, c.updatedAt]
      })
    }
    console.log(`✅ ChatMessages: ${data.chatMessages.length}`)
  }

  // Verify counts
  const counts = await client.execute(`
    SELECT 'User' as tbl, COUNT(*) as cnt FROM "User" UNION ALL
    SELECT 'Admin', COUNT(*) FROM "Admin" UNION ALL
    SELECT 'Deal', COUNT(*) FROM "Deal" UNION ALL
    SELECT 'PaymentMethod', COUNT(*) FROM "PaymentMethod" UNION ALL
    SELECT 'FeeRule', COUNT(*) FROM "FeeRule" UNION ALL
    SELECT 'PlatformSetting', COUNT(*) FROM "PlatformSetting" UNION ALL
    SELECT 'ContactInfo', COUNT(*) FROM "ContactInfo" UNION ALL
    SELECT 'Notification', COUNT(*) FROM "Notification" UNION ALL
    SELECT 'Payout', COUNT(*) FROM "Payout" UNION ALL
    SELECT 'ChatMessage', COUNT(*) FROM "ChatMessage"
  `)
  console.log('\n📋 Turso Data Counts:')
  counts.rows.forEach((r: any) => console.log(`  ${r.tbl}: ${r.cnt}`))

  await client.close()
  console.log('\n✅ Migration complete!')
}

importData().catch(console.error)