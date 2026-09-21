/**
 * One-off: ensure the two E2E test users exist in the LOCAL dev database
 * (cookie value = user id, so these ids make the test cookies work).
 * Run: bun scripts/ensure-e2e-users.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const USERS = [
  {
    id: 'cmrar4fgy0000vcitwu695oe7',
    name: 'E2E Admin',
    email: 'e2e-admin@test.local',
    phone: '01700000001',
    isSeller: true,
  },
  {
    id: 'cmrbj7oum0000tnuw9m7kzkjx',
    name: 'E2E Buyer',
    email: 'e2e-buyer@test.local',
    phone: '01700000002',
    isSeller: false,
  },
]

async function main() {
  for (const u of USERS) {
    const existing = await db.user.findUnique({ where: { id: u.id } })
    if (existing) {
      console.log(`exists: ${u.email}`)
      continue
    }
    await db.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        password: 'e2e-no-login',
        isSeller: u.isSeller,
        emailVerified: true,
      },
    })
    console.log(`created: ${u.email}`)
  }
  const admin = await db.user.findUnique({ where: { id: USERS[0].id } })
  if (admin && !(await db.admin.findUnique({ where: { userId: admin.id } }))) {
    await db.admin.create({ data: { userId: admin.id } })
    console.log('admin record created')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
