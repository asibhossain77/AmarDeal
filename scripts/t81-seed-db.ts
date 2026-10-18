/**
 * Task 81 — seed test data for Marketplace Orders verification.
 * Idempotent: wipes prior t81 fixtures, then creates
 *   - admin user (super_admin)         admin-t81@midman.test
 *   - seller1 (regular seller)         seller1-t81@midman.test
 *   - seller2 (regular seller)         seller2-t81@midman.test
 *   - buyer                            buyer-t81@midman.test
 *   - products: single physical (seller1), multi-option SMM (seller1),
 *               paid digital file (seller1), platform-owned SMM (admin)
 *   - active payment methods (bKash + Nagad)
 * Run: bunx tsx scripts/t81-seed-db.ts   (or bun scripts/t81-seed-db.ts)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const SUFFIX = '-t81'

/** bcryptjs hash of "t81pass123" — computed at seed time so login tests work */
const PASSWORD_HASH = bcrypt.hashSync('t81pass123', 10)

async function upsertUser(name: string, email: string, opts: { isSeller?: boolean; isAdmin?: boolean; role?: string; whatsapp?: string } = {}) {
  const user = await db.user.upsert({
    where: { email },
    create: {
      name,
      email,
      phone: '+880' + Math.floor(1700000000 + Math.random() * 999999999),
      password: PASSWORD_HASH, // "t81pass123" — bcrypt, login-compatible
      emailVerified: true, // login route blocks unverified users
      isSeller: opts.isSeller ?? false,
      whatsappNumber: opts.whatsapp ?? null,
    },
    update: { isSeller: opts.isSeller ?? false },
  })
  if (opts.isAdmin) {
    await db.admin.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: opts.role ?? 'super_admin', permissions: '[]' },
      update: { role: opts.role ?? 'super_admin' },
    })
  }
  return user
}

async function main() {
  // --print-ids: only read + print fixture ids (no wiping) — used by t81-tests.sh
  if (process.argv.includes('--print-ids')) {
    const read = async (email: string) => {
      const u = await db.user.findUnique({ where: { email }, select: { id: true } })
      if (!u) throw new Error(`fixture missing: ${email} — run the seeder first`)
      return u.id
    }
    const admin = await read('admin-t81@midman.test')
    const seller1 = await read('seller1-t81@midman.test')
    const seller2 = await read('seller2-t81@midman.test')
    const buyer = await read('buyer-t81@midman.test')
    const bkash = await db.paymentMethod.findFirstOrThrow({ where: { name: 'T81 bKash' }, select: { id: true } })
    const byTitle = async (t: string) => {
      const p = await db.digitalProduct.findFirstOrThrow({ where: { title: t }, select: { id: true } })
      return p.id
    }
    console.log(JSON.stringify({
      admin, seller1, seller2, buyer, bkashId: bkash.id,
      products: {
        single: await byTitle('T81 Logo Design Single'),
        smm: await byTitle('T81 Facebook Page Likes SMM'),
        digital: await byTitle('T81 Paid Digital Ebook'),
        platformOwned: await byTitle('T81 Platform Instagram Followers'),
      },
    }))
    return
  }

  console.log('→ wiping prior t81 fixtures')
  await db.marketplaceOrder.deleteMany({
    where: { product: { title: { contains: 'T81' } } },
  })
  // old fixture products (options cascade)
  await db.digitalProduct.deleteMany({ where: { title: { contains: 'T81' } } })
  for (const email of ['admin-t81@midman.test', 'seller1-t81@midman.test', 'seller2-t81@midman.test', 'buyer-t81@midman.test']) {
    const u = await db.user.findUnique({ where: { email } })
    if (u) {
      await db.productDownload.deleteMany({ where: { userId: u.id } })
      await db.notification.deleteMany({ where: { userId: u.id } })
      await db.admin.deleteMany({ where: { userId: u.id } })
      await db.user.delete({ where: { id: u.id } }).catch(() => {})
    }
  }

  console.log('→ creating users')
  const admin = await upsertUser('Admin T81', 'admin-t81@midman.test', { isAdmin: true, role: 'super_admin', isSeller: false })
  const seller1 = await upsertUser('Seller One T81', 'seller1-t81@midman.test', { isSeller: true, whatsapp: '+8801711000001' })
  const seller2 = await upsertUser('Seller Two T81', 'seller2-t81@midman.test', { isSeller: true })
  const buyer = await upsertUser('Buyer T81', 'buyer-t81@midman.test', {})

  console.log('→ payment methods')
  await db.paymentMethod.deleteMany({ where: { name: { startsWith: 'T81 ' } } })
  const bkash = await db.paymentMethod.create({ data: { name: 'T81 bKash', accountNumber: '01711-t81-bkash', accountType: 'personal', status: 'active', sortOrder: 1 } })
  await db.paymentMethod.create({ data: { name: 'T81 Nagad', accountNumber: '01711-t81-nagad', accountType: 'personal', status: 'active', sortOrder: 2 } })

  console.log('→ products (seller1 + admin platform-owned)')
  const single = await db.digitalProduct.create({
    data: {
      title: 'T81 Logo Design Single',
      description: 'Single-price physical service product for T81 order tests. Includes 2 revisions and source files.',
      price: 1500,
      category: 'design',
      sellerId: seller1.id,
      status: 'active',
      productType: 'single',
      // Task 82: regular sellers' products are only orderable as PHYSICAL —
      // this product carries the whole seller-side order flow in t81-tests.
      itemType: 'physical',
      quantity: 100,
    },
  })

  const smm = await db.digitalProduct.create({
    data: {
      title: 'T81 Facebook Page Likes SMM',
      description: 'Multi-option SMM service for T81 tests. Choose a package; quantity decides total delivery.',
      price: 500,
      category: 'social_media',
      // Task 82: platform-owned products keep the direct-order flow (multi
      // option verification + server pricing tests live here).
      sellerId: admin.id,
      status: 'active',
      productType: 'multi',
      options: {
        create: [
          { name: '1,000 Likes', price: 500, isAvailable: true, sortOrder: 1 },
          { name: '5,000 Likes', price: 2200, isAvailable: true, sortOrder: 2 },
          { name: '10,000 Likes', price: 4000, isAvailable: false, sortOrder: 3 },
        ],
      },
    },
  })

  const digital = await db.digitalProduct.create({
    data: {
      title: 'T81 Paid Digital Ebook',
      description: 'Paid digital file product for T81 tests — completion should grant download entitlement.',
      price: 300,
      category: 'education',
      // Task 82: digital-file products sold by REGULAR sellers are not
      // orderable (Admin Deal / Message only) — this one is admin-sold so
      // the entitlement-after-completion flow stays covered.
      sellerId: admin.id,
      status: 'active',
      productType: 'single',
      fileKey: 'files/t81-test-ebook.pdf',
      fileName: 't81-test-ebook.pdf',
      fileSize: 1024 * 512,
      fileType: 'application/pdf',
    },
  })

  const platformOwned = await db.digitalProduct.create({
    data: {
      title: 'T81 Platform Instagram Followers',
      description: 'Platform-owned SMM service sold by the Midman admin account (T81 test).',
      price: 800,
      category: 'instagram',
      sellerId: admin.id,
      status: 'active',
      productType: 'single',
    },
  })

  console.log(JSON.stringify({
    admin: admin.id, seller1: seller1.id, seller2: seller2.id, buyer: buyer.id,
    bkashId: bkash.id,
    products: { single: single.id, smm: smm.id, digital: digital.id, platformOwned: platformOwned.id },
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
