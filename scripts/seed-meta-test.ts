/**
 * Seed users + product for Meta Pixel / CAPI E2E testing.
 * Run: npx tsx scripts/seed-meta-test.ts
 * Creates: 0xMBUYER (buyer), 0xMSELLER (seller), 0xMADMIN (admin row) — all password "test1234"
 * Plus one active single-price product owned by 0xMSELLER.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function upsertUser(id: string, name: string, email: string, isSeller: boolean) {
  const hash = await bcrypt.hash('test1234', 10)
  await db.user.upsert({
    where: { id },
    update: { isSeller, isActive: true, emailVerified: true },
    create: {
      id,
      name,
      email,
      phone: '+880' + Math.floor(1000000000 + Math.random() * 8999999999),
      password: hash,
      isSeller,
      isActive: true,
      emailVerified: true,
    },
  })
  console.log(`user ${id} ready`)
}

async function main() {
  await upsertUser('0xMBUYER', 'মেটা ক্রেতা', 'meta-buyer@test.local', false)
  await upsertUser('0xMSELLER', 'মেটা বিক্রেতা', 'meta-seller@test.local', true)
  await upsertUser('0xMADMIN', 'মেটা অ্যাডমিন', 'meta-admin@test.local', false)

  await db.admin.upsert({
    where: { userId: '0xMADMIN' },
    update: {},
    create: { userId: '0xMADMIN', role: 'admin' },
  })
  console.log('admin row ready')

  const existing = await db.digitalProduct.findFirst({ where: { title: 'E2E Meta Test Product' } })
  if (!existing) {
    await db.digitalProduct.create({
      data: {
        title: 'E2E Meta Test Product',
        description: 'Meta Pixel + Conversions API E2E টেস্টের জন্য তৈরি করা একটি পণ্য। এটি দিয়ে বাজারে কোনো লেনদেন হয় না।',
        price: 500,
        category: 'other',
        sellerId: '0xMSELLER',
        status: 'active',
        productType: 'single',
      },
    })
    console.log('product ready')
  } else {
    console.log('product already exists')
  }
}

main().finally(() => db.$disconnect())
