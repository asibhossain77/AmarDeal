import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { generateUniqueReferralCode } from '@/lib/referral-code'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Fetch user with affiliate data
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        referralCode: true,
        referredBy: true,
        affiliateBalance: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    // Auto-generate referral code if missing
    let referralCode = user.referralCode
    if (!referralCode) {
      referralCode = await generateUniqueReferralCode(user.name)
      await db.user.update({
        where: { id: userId },
        data: { referralCode },
      })
    }

    // Count referred users
    const referredCount = await db.user.count({
      where: { referredBy: userId },
    })

    // Fetch affiliate earnings (no include — relations not defined in schema)
    const earnings = await db.affiliateEarning.findMany({
      where: { affiliateId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Batch-resolve deal titles and referred user names
    const dealIds = [...new Set(earnings.map((e) => e.dealId))]
    const userIds = [...new Set(earnings.map((e) => e.referredUserId))]

    let dealMap: Record<string, { id: string; title: string; amount: number }> = {}
    let userMap: Record<string, { id: string; name: string }> = {}

    try {
      if (dealIds.length > 0) {
        const deals = await db.deal.findMany({
          where: { id: { in: dealIds } },
          select: { id: true, title: true, amount: true },
        })
        dealMap = Object.fromEntries(deals.map((d) => [d.id, d]))
      }
    } catch { /* ignore if deal lookup fails */ }

    try {
      if (userIds.length > 0) {
        const users = await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
        userMap = Object.fromEntries(users.map((u) => [u.id, u]))
      }
    } catch { /* ignore if user lookup fails */ }

    // Stats
    const totalEarnings = await db.affiliateEarning.aggregate({
      where: { affiliateId: userId },
      _sum: { amount: true },
    })
    const pendingEarnings = await db.affiliateEarning.aggregate({
      where: { affiliateId: userId, status: 'pending' },
      _sum: { amount: true },
    })
    const paidEarnings = await db.affiliateEarning.aggregate({
      where: { affiliateId: userId, status: 'paid' },
      _sum: { amount: true },
    })

    // Get commission percentage from settings
    let commissionPercent = 30
    try {
      const setting = await db.platformSetting.findUnique({
        where: { key: 'affiliate_commission_percent' },
      })
      if (setting?.value) {
        const parsed = parseFloat(setting.value)
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          commissionPercent = parsed
        }
      }
    } catch { /* use default */ }

    // Build referral link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''
    const referralLink = `${baseUrl}/ref/${referralCode}`

    return NextResponse.json({
      referralCode,
      referralLink,
      affiliateBalance: user.affiliateBalance,
      referredCount,
      totalEarnings: totalEarnings._sum.amount || 0,
      pendingEarnings: pendingEarnings._sum.amount || 0,
      paidEarnings: paidEarnings._sum.amount || 0,
      commissionPercent,
      earnings: earnings.map((e) => ({
        id: e.id,
        amount: e.amount,
        percentage: e.percentage,
        status: e.status,
        createdAt: e.createdAt,
        deal: dealMap[e.dealId] || null,
        referredUser: userMap[e.referredUserId] || null,
      })),
    })
  } catch (err) {
    console.error('[affiliate] Error:', err)
    return NextResponse.json({ error: 'তথ্য পেতে সমস্যা' }, { status: 500 })
  }
}
