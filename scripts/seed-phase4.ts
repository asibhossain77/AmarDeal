/**
 * Phase 4 seed: digital product for business-seller direct-order testing.
 * Reuses the Phase 3 gap-fill users (biz seller / buyer). Idempotent.
 * Run: DATABASE_URL=file:/home/z/my-project/amardeal/db/custom.db npx tsx scripts/seed-phase4.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BIZ_SELLER = 'cmsellerbiz000000000000001'

async function main() {
  const seller = await db.user.findUnique({ where: { id: BIZ_SELLER } })
  if (!seller) throw new Error('biz seller missing — run seed-phase3-gapfill.ts first')

  // Digital product (account kind → fulfilment info required at checkout)
  let product = await db.digitalProduct.findFirst({
    where: { title: 'ফ্রি ফায়ার ডায়মন্ড টপ-আপ (৩১০ ডায়মন্ড)', sellerId: BIZ_SELLER },
  })
  if (!product) {
    product = await db.digitalProduct.create({
      data: {
        title: 'ফ্রি ফায়ার ডায়মন্ড টপ-আপ (৩১০ ডায়মন্ড)',
        description: 'আপনার ফ্রি ফায়ার অ্যাকাউন্টে সরাসরি ৩১০ ডায়মন্ড টপ-আপ। অর্ডার করতে গেম আইডি দিন।',
        price: 120,
        category: 'gaming',
        itemType: 'non_physical',
        digitalKind: 'account',
        quantity: 99,
        sellerId: BIZ_SELLER,
        status: 'active',
      },
    })
    console.log('created digital product:', product.id)
  } else {
    console.log('digital product exists:', product.id)
  }

  // Multi-price physical product (option selector at checkout)
  let multi = await db.digitalProduct.findFirst({
    where: { title: 'ব্লুটুথ ইয়ারবাড', sellerId: BIZ_SELLER },
  })
  if (!multi) {
    multi = await db.digitalProduct.create({
      data: {
        title: 'ব্লুটুথ ইয়ারবাড',
        description: 'দুটি প্যাকেজ — স্ট্যান্ডার্ড ও প্রিমিয়াম।',
        price: 800,
        category: 'other',
        itemType: 'physical',
        quantity: 15,
        productType: 'multi',
        sellerId: BIZ_SELLER,
        status: 'active',
        options: {
          create: [
            { name: 'স্ট্যান্ডার্ড', price: 800, isAvailable: true, sortOrder: 0 },
            { name: 'প্রিমিয়াম', price: 1200, isAvailable: true, sortOrder: 1 },
          ],
        },
      },
    })
    console.log('created multi product:', multi.id)
  } else {
    console.log('multi product exists:', multi.id)
  }

  // A couple of active payment methods (manual payment step)
  const pmCount = await db.paymentMethod.count()
  if (pmCount === 0) {
    await db.paymentMethod.createMany({
      data: [
        { name: 'বিকাশ', accountNumber: '01700000000', accountType: 'personal', color: '#E2136E', sortOrder: 0, instructions: 'Send Money করুন' },
        { name: 'নগদ', accountNumber: '01700000001', accountType: 'personal', color: '#F6921E', sortOrder: 1, instructions: 'Send Money করুন' },
      ],
    })
    console.log('created 2 payment methods')
  } else {
    console.log('payment methods exist:', pmCount)
  }
}

main().finally(() => db.$disconnect())
