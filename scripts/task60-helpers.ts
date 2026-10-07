/**
 * Task 60 — OAuth flow test helpers (LOCAL TEST ONLY, never runs in production)
 *
 * Modes:
 *   seed          — create/reset the OAuth flow test user (active, email-verified)
 *   expire-codes  — force-expire all unused authorization codes (for expiry test)
 *   cleanup       — remove the test user (cascades its OAuth codes)
 *
 * Usage: DATABASE_URL=file:<abs path to db> bun scripts/task60-helpers.ts <mode>
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const TEST_EMAIL = 'task60-oauth-test@midman.local'
const TEST_PASSWORD = 'task60-Pass-w0rd!'

async function main() {
  const mode = process.argv[2] ?? 'seed'

  if (mode === 'seed') {
    // Unique phone per run avoids clashing with any existing row (phone is @unique)
    const phone = '+88017' + String(16000000000 + Math.floor(Math.random() * 8999999999)).slice(0, 9)
    await db.user.deleteMany({ where: { email: TEST_EMAIL } })
    const password = await bcrypt.hash(TEST_PASSWORD, 10)
    await db.user.create({
      data: {
        name: 'OAuth Flow Test',
        email: TEST_EMAIL,
        phone,
        password,
        emailVerified: true,
        isActive: true,
      },
    })
    console.log(`seeded ${TEST_EMAIL}`)
  } else if (mode === 'expire-codes') {
    const r = await db.oAuthAuthorizationCode.updateMany({
      where: { usedAt: null },
      data: { expiresAt: new Date(Date.now() - 3_600_000) },
    })
    console.log(`expired ${r.count} unused code(s)`)
  } else if (mode === 'cleanup') {
    const r = await db.user.deleteMany({ where: { email: TEST_EMAIL } })
    console.log(`removed ${r.count} test user(s)`)
  } else {
    throw new Error(`unknown mode: ${mode}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
