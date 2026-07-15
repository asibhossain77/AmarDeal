import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: {
    db: { url: 'file:/home/z/my-project/db/custom.db' }
  }
})

async function exportData() {
  const users = await db.user.findMany({ include: { admin: true } })
  const paymentMethods = await db.paymentMethod.findMany()
  const feeRules = await db.feeRule.findMany()
  const settings = await db.platformSetting.findMany()
  const contactInfo = await db.contactInfo.findMany()
  const deals = await db.deal.findMany()
  const notifications = await db.notification.findMany()
  const payouts = await db.payout.findMany()
  const chatMessages = await db.chatMessage.findMany()

  console.log(JSON.stringify({
    users, paymentMethods, feeRules, settings, contactInfo,
    deals, notifications, payouts, chatMessages
  }, null, 2))
}

exportData().catch(console.error)