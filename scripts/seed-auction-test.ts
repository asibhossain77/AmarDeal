/**
 * Seed test users + auctions for the Nilam (auction) feature E2E.
 * Run: bunx tsx scripts/seed-auction-test.ts
 * Users: 0xSELLER (seller), 0xBIDDER1, 0xBIDDER2 (buyers) — all password "test1234"
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function upsertUser(id: string, name: string, email: string, isSeller: boolean) {
  const hash = await bcrypt.hash('test1234', 10)
  await db.user.upsert({
    where: { id },
    update: { isSeller, isActive: true },
    create: {
      id,
      name,
      email,
      phone: '+880' + Math.floor(1000000000 + Math.random() * 8999999999),
      password: hash,
      isSeller,
      isActive: true,
    },
  })
  console.log(`user ${id} (${name}) ready, isSeller=${isSeller}`)
}

async function main() {
  await upsertUser('0xSELLER', 'নিলাম সেলার', 'auc-seller@test.local', true)
  await upsertUser('0xBIDDER1', 'বিডার এক', 'bidder1@test.local', false)
  await upsertUser('0xBIDDER2', 'বিডার টু', 'bidder2@test.local', false)

  // A long-running auction for UI testing (2 hours from now)
  const existing = await db.auction.findFirst({ where: { title: 'E2E নিলাম পণ্য' } })
  if (!existing) {
    await db.auction.create({
      data: {
        title: 'E2E নিলাম পণ্য',
        description: 'এটি একটি টেস্ট নিলাম পণ্য — এজেন্ট ব্রাউজার E2E টেস্টের জন্য তৈরি। বিস্তারিত বিবরণ যথেষ্ট দীর্ঘ যাতে ভ্যালিডেশন পাস করে।',
        category: 'software',
        startPrice: 500,
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        sellerId: '0xSELLER',
      },
    })
    console.log('seeded active auction (ends in 2h)')
  }
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
