/**
 * Phase 3 gap-fill seed: physical delivery + dispute demo data.
 * Creates e2e users (cookie=id), a physical product, and orders across
 * the dispute-relevant states. Idempotent.
 * Run: DATABASE_URL=file:./db/custom.db npx tsx scripts/seed-phase3-gapfill.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const IDS = {
  admin: 'cmrar4fgy0000vcitwu695oe7',
  bizSeller: 'cmsellerbiz000000000000001',
  personalSeller: 'cmsellerpers00000000000002',
  buyer1: 'cmbuyer0000000000000000001',
  buyer2: 'cmbuyer0000000000000000002',
}

async function main() {
  // Users (password 'x' — cookie login is used in e2e)
  const users = [
    { id: IDS.bizSeller, name: 'রাকিব এন্টারপ্রাইজ', email: 'biz@test.local', phone: '01711111111', isSeller: true, sellerRole: 'business' },
    { id: IDS.personalSeller, name: 'পার্সোনাল সেলার', email: 'pers@test.local', phone: '01722222222', isSeller: true, sellerRole: 'personal' },
    { id: IDS.buyer1, name: 'মেহেদী হাসান', email: 'buyer1@test.local', phone: '01833333333', isSeller: false, sellerRole: 'personal' },
    { id: IDS.buyer2, name: 'আসিব হোসেন', email: 'buyer2@test.local', phone: '01844444444', isSeller: false, sellerRole: 'personal' },
  ]
  for (const u of users) {
    await db.user.upsert({
      where: { id: u.id },
      create: { ...u, password: 'seed-no-login', isActive: true, emailVerified: true },
      update: { sellerRole: u.sellerRole, isSeller: u.isSeller },
    })
  }
  // Admin user row must exist BEFORE the Admin record (FK)
  await db.user.upsert({
    where: { id: IDS.admin },
    create: { id: IDS.admin, name: 'অ্যাডমিন', email: 'admin@test.local', phone: '01700000000', password: 'seed-no-login', isActive: true, emailVerified: true },
    update: {},
  })
  await db.admin.upsert({
    where: { userId: IDS.admin },
    create: { userId: IDS.admin, role: 'super_admin', permissions: '[]' },
    update: {},
  })

  // Physical product (business seller)
  let product = await db.digitalProduct.findFirst({ where: { title: 'হ্যান্ডমেড লেদার ওয়ালেট', sellerId: IDS.bizSeller } })
  if (!product) {
    product = await db.digitalProduct.create({
      data: {
        title: 'হ্যান্ডমেড লেদার ওয়ালেট',
        description: 'খাঁটি চামড়ার হাতে তৈরি ওয়ালেট — ক্যাশ অন ডেলিভারি সুবিধা।',
        price: 950,
        category: 'other',
        itemType: 'physical',
        quantity: 20,
        sellerId: IDS.bizSeller,
        status: 'active',
      },
    })
  }

  // Personal seller product (non-physical — no Order Now)
  const persProduct = await db.digitalProduct.findFirst({ where: { sellerId: IDS.personalSeller } })
  if (!persProduct) {
    await db.digitalProduct.create({
      data: { title: 'লোগো ডিজাইন সার্ভিস', description: 'ব্যক্তিগত সেলারের ডিজিটাল সার্ভিস', price: 500, category: 'design', sellerId: IDS.personalSeller, status: 'active' },
    })
  }

  const orderCount = await db.marketplaceOrder.count({ where: { sellerId: IDS.bizSeller } })
  if (orderCount === 0) {
    // 1. pending_payment (unpaid) with delivery info
    await db.marketplaceOrder.create({
      data: {
        orderNumber: 'MD-P3-0001', idempotencyKey: 'seed-p3-1',
        userId: IDS.buyer1, sellerId: IDS.bizSeller, productId: product.id,
        serviceName: product.title, quantity: 1, pricingUnit: 'unit',
        unitPriceAtOrder: 950, totalAmount: 950,
        status: 'pending_payment', paymentStatus: 'unpaid',
        buyerName: 'মেহেদী হাসান', buyerPhone: '01833333333',
        addressLine: 'বাড়ি ১২, রোড ৫, ধানমন্ডি', city: 'ঢাকা', postalCode: '1205',
        deliveryNote: 'বিকাল ৫টার পরে কল করবেন',
        events: { create: { type: 'status_changed', toStatus: 'pending_payment', message: 'Order created', actorType: 'buyer', actorId: IDS.buyer1 } },
      },
    })
    // 2. queued (paid) with delivery info — seller can start
    await db.marketplaceOrder.create({
      data: {
        orderNumber: 'MD-P3-0002', idempotencyKey: 'seed-p3-2',
        userId: IDS.buyer2, sellerId: IDS.bizSeller, productId: product.id,
        serviceName: product.title, quantity: 2, pricingUnit: 'unit',
        unitPriceAtOrder: 950, totalAmount: 1900,
        status: 'queued', paymentStatus: 'paid',
        paidAt: new Date(), paymentVerifiedBy: IDS.admin,
        buyerName: 'আসিব হোসেন', buyerPhone: '01844444444',
        addressLine: 'ফ্ল্যাট B-4, হাউজ ২৭, উত্তরা সেক্টর ১১', city: 'ঢাকা', postalCode: '1230',
        events: { create: { type: 'status_changed', toStatus: 'queued', message: 'Payment verified by admin', actorType: 'admin', actorId: IDS.admin } },
      },
    })
    // 3. processing (paid) — buyer can dispute
    await db.marketplaceOrder.create({
      data: {
        orderNumber: 'MD-P3-0003', idempotencyKey: 'seed-p3-3',
        userId: IDS.buyer1, sellerId: IDS.bizSeller, productId: product.id,
        serviceName: product.title, quantity: 1, pricingUnit: 'unit',
        unitPriceAtOrder: 950, totalAmount: 950,
        status: 'processing', paymentStatus: 'paid',
        paidAt: new Date(Date.now() - 86400000), paymentVerifiedBy: IDS.admin,
        buyerName: 'মেহেদী হাসান', buyerPhone: '01833333333',
        addressLine: 'বাড়ি ১২, রোড ৫, ধানমন্ডি', city: 'ঢাকা',
        events: { create: { type: 'status_changed', toStatus: 'processing', message: 'Seller started fulfilment', actorType: 'seller', actorId: IDS.bizSeller } },
      },
    })
    // 4. disputed (paid) — admin can resolve
    await db.marketplaceOrder.create({
      data: {
        orderNumber: 'MD-P3-0004', idempotencyKey: 'seed-p3-4',
        userId: IDS.buyer2, sellerId: IDS.bizSeller, productId: product.id,
        serviceName: product.title, quantity: 1, pricingUnit: 'unit',
        unitPriceAtOrder: 950, totalAmount: 950,
        status: 'disputed', paymentStatus: 'paid',
        paidAt: new Date(Date.now() - 2 * 86400000), paymentVerifiedBy: IDS.admin,
        disputeReason: 'পণ্যটি এখনো ডেলিভারি হয়নি — ৫ দিন পেরিয়ে গেছে', disputedAt: new Date(Date.now() - 3600000),
        buyerName: 'আসিব হোসেন', buyerPhone: '01844444444',
        addressLine: 'ফ্ল্যাট B-4, হাউজ ২৭, উত্তরা সেক্টর ১১', city: 'ঢাকা',
        events: { create: { type: 'status_changed', fromStatus: 'processing', toStatus: 'disputed', message: 'পণ্যটি এখনো ডেলিভারি হয়নি — ৫ দিন পেরিয়ে গেছে', actorType: 'buyer', actorId: IDS.buyer2 } },
      },
    })
    // 5. completed (paid)
    await db.marketplaceOrder.create({
      data: {
        orderNumber: 'MD-P3-0005', idempotencyKey: 'seed-p3-5',
        userId: IDS.buyer2, sellerId: IDS.bizSeller, productId: product.id,
        serviceName: product.title, quantity: 1, pricingUnit: 'unit',
        unitPriceAtOrder: 950, totalAmount: 950,
        status: 'completed', paymentStatus: 'paid',
        paidAt: new Date(Date.now() - 5 * 86400000), paymentVerifiedBy: IDS.admin,
        completedAt: new Date(Date.now() - 3 * 86400000),
        buyerName: 'আসিব হোসেন', buyerPhone: '01844444444',
        addressLine: 'ফ্ল্যাট B-4, হাউজ ২৭, উত্তরা সেক্টর ১১', city: 'ঢাকা',
        events: { create: { type: 'status_changed', toStatus: 'completed', message: 'Order marked completed', actorType: 'seller', actorId: IDS.bizSeller } },
      },
    })
    console.log('[seed] 5 demo orders created')
  }
  console.log('[seed] done')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
