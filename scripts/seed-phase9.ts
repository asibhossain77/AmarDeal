/**
 * Phase 9 E2E seed — idempotent test data for marketplace moderation tests.
 * MUST run with explicit DATABASE_URL (env resolution walks up otherwise):
 *   DATABASE_URL=file:/home/z/my-project/amardeal/db/custom.db npx tsx scripts/seed-phase9.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const P = 'phase9pass'

async function upsertUser(email: string, name: string, extra: Record<string, unknown> = {}) {
  const existing = await db.user.findUnique({ where: { email } })
  const password = await bcrypt.hash(P, 10)
  const base = { name, phone: extra.phone as string, password, emailVerified: true }
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { ...base, ...extra } })
    return db.user.findUnique({ where: { email } })
  }
  return db.user.create({ data: { email, ...base, ...extra } as never })
}

async function main() {
  // ── Admins ──
  const superAdmin = await upsertUser('p9-admin@midman.test', 'Phase9 Super Admin', {
    phone: '+8801700009001',
  })
  const existingSA = await db.admin.findUnique({ where: { userId: superAdmin!.id } })
  if (existingSA) {
    await db.admin.update({ where: { id: existingSA.id }, data: { role: 'super_admin', permissions: '[]' } })
  } else {
    await db.admin.create({ data: { userId: superAdmin!.id, role: 'super_admin', permissions: '[]' } })
  }

  const staff = await upsertUser('p9-staff@midman.test', 'Phase9 Staff', { phone: '+8801700009002' })
  const staffRec = await db.admin.findUnique({ where: { userId: staff!.id } })
  const staffPerms = JSON.stringify(['marketplace-sellers', 'marketplace-products', 'moderation-reports'])
  if (staffRec) await db.admin.update({ where: { id: staffRec.id }, data: { role: 'staff', permissions: staffPerms } })
  else await db.admin.create({ data: { userId: staff!.id, role: 'staff', permissions: staffPerms } })

  const staffNoPerms = await upsertUser('p9-staff2@midman.test', 'Phase9 Staff NoPerms', { phone: '+8801700009003' })
  const snp = await db.admin.findUnique({ where: { userId: staffNoPerms!.id } })
  if (snp) await db.admin.update({ where: { id: snp.id }, data: { role: 'staff', permissions: '[]' } })
  else await db.admin.create({ data: { userId: staffNoPerms!.id, role: 'staff', permissions: '[]' } })

  const support = await upsertUser('p9-support@midman.test', 'Phase9 Support', { phone: '+8801700009004' })
  const supRec = await db.admin.findUnique({ where: { userId: support!.id } })
  if (supRec) await db.admin.update({ where: { id: supRec.id }, data: { role: 'support', permissions: '[]' } })
  else await db.admin.create({ data: { userId: support!.id, role: 'support', permissions: '[]' } })

  // ── Sellers ──
  const sellerA = await upsertUser('p9-seller-a@midman.test', 'Seller A Business', {
    phone: '+8801700009011', isSeller: true, sellerRole: 'business', businessVerified: true,
    sellerDisabled: false, sellerRestricted: false, businessName: 'A Trading',
  })
  const sellerB = await upsertUser('p9-seller-b@midman.test', 'Seller B Personal', {
    phone: '+8801700009012', isSeller: true, sellerRole: 'personal', businessVerified: false,
    sellerDisabled: false, sellerRestricted: false,
  })
  const sellerC = await upsertUser('p9-seller-c@midman.test', 'Seller C Business', {
    phone: '+8801700009013', isSeller: true, sellerRole: 'business', businessVerified: true,
    sellerDisabled: false, sellerRestricted: false, businessName: 'C Enterprise',
  })
  const buyer = await upsertUser('p9-buyer@midman.test', 'Phase9 Buyer', { phone: '+8801700009014' })

  // ── Products ──
  async function upsertProduct(title: string, sellerId: string, status: string, price = 500) {
    const existing = await db.digitalProduct.findFirst({ where: { title, sellerId } })
    const data = {
      title, description: `Phase 9 test product ${title}`, price, category: 'other',
      quantity: 10, status, productType: 'single', itemType: 'non_physical',
    }
    if (existing) {
      await db.digitalProduct.update({ where: { id: existing.id }, data: { ...data, moderationNote: null } })
      return db.digitalProduct.findFirst({ where: { title, sellerId } })
    }
    return db.digitalProduct.create({ data: { ...data, sellerId } as never })
  }

  const prodAActive = await upsertProduct('P9 A Active', sellerA!.id, 'active')
  const prodAPending = await upsertProduct('P9 A Pending', sellerA!.id, 'pending')
  const prodBActive = await upsertProduct('P9 B Active', sellerB!.id, 'active')
  const prodCActive = await upsertProduct('P9 C Active', sellerC!.id, 'active', 750)

  // ── Pending business application for seller C with a local document URL ──
  const appC = await db.sellerApplication.findFirst({
    where: { userId: sellerC!.id, status: 'pending' },
  })
  if (!appC) {
    await db.sellerApplication.create({
      data: {
        userId: sellerC!.id,
        businessName: 'C Enterprise',
        email: sellerC!.email,
        phone: sellerC!.phone,
        applicationType: 'business',
        idType: 'nid',
        idNumber: '1990123456789',
        documentImage: 'http://127.0.0.1:3199/test-doc.png',
        status: 'pending',
      } as never,
    })
  }

  // ── Clean slate for moderation state (idempotent reruns) ──
  await db.moderationReport.deleteMany({})
  await db.adminAuditLog.deleteMany({ where: { targetType: { in: ['seller', 'product', 'moderation_report'] } } })
  await db.notification.deleteMany({ where: { userId: { in: [sellerA!.id, sellerB!.id, sellerC!.id, buyer!.id] }, type: { startsWith: 'seller_' } } })
  await db.notification.deleteMany({ where: { userId: { in: [sellerA!.id, sellerB!.id, sellerC!.id, buyer!.id] }, type: { startsWith: 'product_' } } })

  console.log(JSON.stringify({
    superAdmin: { id: superAdmin!.id, email: superAdmin!.email },
    staff: { id: staff!.id },
    staffNoPerms: { id: staffNoPerms!.id },
    support: { id: support!.id },
    sellerA: { id: sellerA!.id },
    sellerB: { id: sellerB!.id },
    sellerC: { id: sellerC!.id },
    buyer: { id: buyer!.id },
    products: {
      prodAActive: prodAActive!.id, prodAPending: prodAPending!.id,
      prodBActive: prodBActive!.id, prodCActive: prodCActive!.id,
    },
  }, null, 2))
}

main().finally(() => db.$disconnect())
