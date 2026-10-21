/* Task 13 rebase verification: check seller-role columns + data integrity */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const userCols = (await db.$queryRawUnsafe(
    "SELECT name FROM pragma_table_info('User') WHERE name IN ('sellerRole','businessVerified')"
  )) as { name: string }[]
  const appCols = (await db.$queryRawUnsafe(
    "SELECT name FROM pragma_table_info('SellerApplication') WHERE name IN ('applicationType','idType','idNumber','documentImage')"
  )) as { name: string }[]
  console.log('User cols:', userCols.map((c) => c.name))
  console.log('SellerApplication cols:', appCols.map((c) => c.name))

  const users = await db.user.count()
  const sellers = await db.user.count({ where: { isSeller: true } })
  const products = await db.digitalProduct.count()
  const deals = await db.deal.count()
  const apps = await db.sellerApplication.count()
  console.log({ users, sellers, products, deals, apps })

  const roles = await db.user.groupBy({ by: ['sellerRole'], _count: true })
  console.log('sellerRole distribution:', roles)
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
