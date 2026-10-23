/**
 * Phase 5 seed: products for delivery-tracking E2E tests.
 * Reuses the Phase 3 gap-fill users (biz seller / buyer1). Idempotent.
 * Run: DATABASE_URL=file:/home/z/my-project/amardeal/db/custom.db npx tsx scripts/seed-phase5.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const BIZ_SELLER = 'cmsellerbiz000000000000001'

async function main() {
  const seller = await db.user.findUnique({ where: { id: BIZ_SELLER } })
  if (!seller) throw new Error('biz seller missing — run seed-phase3-gapfill.ts first')

  // Physical product with stock (courier flow test)
  let physical = await db.digitalProduct.findFirst({
    where: { title: 'ফেজ৫ টেস্ট ওয়াচ (ফিজিক্যাল)', sellerId: BIZ_SELLER },
  })
  if (!physical) {
    physical = await db.digitalProduct.create({
      data: {
        title: 'ফেজ৫ টেস্ট ওয়াচ (ফিজিক্যাল)',
        description: 'Phase 5 delivery tracking E2E — physical product.',
        price: 1500,
        category: 'other',
        itemType: 'physical',
        quantity: 10,
        sellerId: BIZ_SELLER,
        status: 'active',
      },
    })
    console.log('created physical product:', physical.id)
  } else {
    console.log('physical product exists:', physical.id)
  }

  // Digital product WITHOUT file (account kind → delivery content required)
  let account = await db.digitalProduct.findFirst({
    where: { title: 'ফেজ৫ টেস্ট অ্যাকাউন্ট (ডিজিটাল)', sellerId: BIZ_SELLER },
  })
  if (!account) {
    account = await db.digitalProduct.create({
      data: {
        title: 'ফেজ৫ টেস্ট অ্যাকাউন্ট (ডিজিটাল)',
        description: 'Phase 5 secure digital handover E2E — account kind.',
        price: 300,
        category: 'gaming',
        itemType: 'non_physical',
        digitalKind: 'account',
        quantity: 99,
        sellerId: BIZ_SELLER,
        status: 'active',
      },
    })
    console.log('created account product:', account.id)
  } else {
    console.log('account product exists:', account.id)
  }

  // Digital product WITH file (entitlement flow — content optional)
  let fileProduct = await db.digitalProduct.findFirst({
    where: { title: 'ফেজ৫ টেস্ট ফাইল (ডিজিটাল)', sellerId: BIZ_SELLER },
  })
  if (!fileProduct) {
    fileProduct = await db.digitalProduct.create({
      data: {
        title: 'ফেজ৫ টেস্ট ফাইল (ডিজিটাল)',
        description: 'Phase 5 file delivery E2E — file kind.',
        price: 200,
        category: 'software',
        itemType: 'non_physical',
        digitalKind: 'file',
        fileKey: 'test/phase5/assets.zip',
        fileName: 'phase5-assets.zip',
        fileSize: 2048,
        quantity: 99,
        sellerId: BIZ_SELLER,
        status: 'active',
      },
    })
    console.log('created file product:', fileProduct.id)
  } else {
    console.log('file product exists:', fileProduct.id)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
