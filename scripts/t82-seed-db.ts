/**
 * Task 82 — seed fixtures for Physical Products verification.
 * Reuses the T81 user fixtures (creates them if missing, same credentials).
 * Products:
 *   - T82 Physical Watch   (seller1, itemType=physical, stock 5, ৳1500, condition new, shipping info)
 *   - T82 NonPhysical Single (seller1, itemType=non_physical — legacy kind, orderable=NO)
 * Run: bunx tsx scripts/t82-seed-db.ts [--print-ids]
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const PASSWORD_HASH = bcrypt.hashSync('t81pass123', 10)

async function ensureUser(name: string, email: string, opts: { isSeller?: boolean } = {}) {
  return db.user.upsert({
    where: { email },
    create: {
      name,
      email,
      phone: '+880' + Math.floor(1700000000 + Math.random() * 999999999),
      password: PASSWORD_HASH,
      emailVerified: true,
      isSeller: opts.isSeller ?? false,
    },
    update: { isSeller: opts.isSeller ?? false },
  })
}

async function main() {
  if (process.argv.includes('--print-ids')) {
    const read = async (email: string) => {
      const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } })
      return u.id
    }
    const byTitle = async (t: string) =>
      (await db.digitalProduct.findFirstOrThrow({ where: { title: t }, select: { id: true } })).id
    console.log(JSON.stringify({
      seller1: await read('seller1-t81@midman.test'),
      seller2: await read('seller2-t81@midman.test'),
      buyer: await read('buyer-t81@midman.test'),
      products: {
        physical: await byTitle('T82 Physical Watch'),
        nonPhysical: await byTitle('T82 NonPhysical Single'),
      },
    }))
    return
  }

  console.log('→ ensuring T81 user fixtures')
  const seller1 = await ensureUser('Seller One T81', 'seller1-t81@midman.test', { isSeller: true })
  await ensureUser('Seller Two T81', 'seller2-t81@midman.test', { isSeller: true })
  await ensureUser('Buyer T81', 'buyer-t81@midman.test', {})
  await ensureUser('Admin T81', 'admin-t81@midman.test', { isSeller: false })
  const adminRow = await db.user.findUniqueOrThrow({ where: { email: 'admin-t81@midman.test' } })
  await db.admin.upsert({
    where: { userId: adminRow.id },
    create: { userId: adminRow.id, role: 'super_admin', permissions: '[]' },
    update: { role: 'super_admin' },
  })

  console.log('→ wiping prior T82 fixtures')
  await db.marketplaceOrder.deleteMany({ where: { product: { title: { startsWith: 'T82' } } } })
  await db.digitalProduct.deleteMany({ where: { title: { startsWith: 'T82' } } })

  console.log('→ creating T82 products')
  await db.digitalProduct.create({
    data: {
      title: 'T82 Physical Watch',
      description: 'Brand-new wrist watch for T82 physical-product tests. Boxed, 1-year warranty.',
      price: 1500,
      category: 'other',
      sellerId: seller1.id,
      status: 'active',
      productType: 'single',
      itemType: 'physical',
      quantity: 5, // stock
      condition: 'new',
      shippingInfo: 'Delivery inside Dhaka in 2-3 days. Outside Dhaka 3-5 days.',
    },
  })

  await db.digitalProduct.create({
    data: {
      title: 'T82 NonPhysical Single',
      description: 'Legacy non-physical seller service for T82 tests — Order Now must be rejected.',
      price: 900,
      category: 'design',
      sellerId: seller1.id,
      status: 'active',
      productType: 'single',
    },
  })

  console.log('T82 seed done')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
