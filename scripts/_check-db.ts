import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const users = await p.user.count()
  const orders = await p.marketplaceOrder.count()
  const admins = await p.admin.count()
  const products = await p.digitalProduct.count()
  console.log({ users, orders, admins, products })
  const sample = await p.marketplaceOrder.findMany({
    take: 8,
    select: { orderNumber: true, status: true, paymentStatus: true, totalAmount: true, sellerId: true, productId: true },
  })
  console.log(JSON.stringify(sample, null, 1))
  await p.$disconnect()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
