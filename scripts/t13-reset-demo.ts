/* Reset demo account passwords for local E2E (plaintext legacy — login auto-rehashes) */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const emails = ['user@demo.com', 'dash@test.com', 'admin@demo.com', 'seller@demo.com']
  for (const email of emails) {
    const u = await db.user.update({ where: { email }, data: { password: 'test1234', isActive: true, emailVerified: true } })
    console.log('reset', u.email)
  }
  // Make sure the admin row exists for admin@demo.com (super_admin)
  const admin = await db.user.findUnique({ where: { email: 'admin@demo.com' } })
  if (admin) {
    await db.admin.upsert({
      where: { userId: admin.id },
      update: { role: 'super_admin' },
      create: { userId: admin.id, role: 'super_admin', permissions: '[]' },
    })
    console.log('admin row ensured for', admin.id)
  }
  // Clean any leftover pending applications for the test accounts (idempotent E2E)
  const cleaned = await db.sellerApplication.deleteMany({ where: { status: 'pending', email: { in: ['user@demo.com', 'dash@test.com'] } } })
  console.log('cleaned pending apps:', cleaned.count)

  // Fresh one-shot E2E users (recreated each run so flows are repeatable)
  for (const email of ['biz-e2e@midman.test', 'pers-e2e@midman.test']) {
    await db.sellerApplication.deleteMany({ where: { email } })
    await db.user.deleteMany({ where: { email } })
    const u = await db.user.create({
      data: {
        name: email === 'biz-e2e@midman.test' ? 'Biz E2E' : 'Pers E2E',
        email,
        phone: email === 'biz-e2e@midman.test' ? '01700001111' : '01700002222',
        password: 'test1234',
        isActive: true,
        emailVerified: true,
      },
    })
    console.log('fresh E2E user', u.email, u.id)
  }
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
