import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

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
        referralCode: true,
        referredBy: true,
        affiliateBalance: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    // Count referred users
    const referredCount = await db.user.count({
      where: { referredBy: userId },
    })

    // Fetch affiliate earnings with deal info
    const earnings = await db.affiliateEarning.findMany({
      where: { affiliateId: userId },
      include: {
        deal: {
          select: { id: true, title: true, amount: true },
        },
        referredUser: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

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
    const referralLink = user.referralCode ? `${baseUrl}/ref/${user.referralCode}` : null

    return NextResponse.json({
      referralCode: user.referralCode,
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
        deal: e.deal,
        referredUser: e.referredUser,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'তথ্য পেতে সমস্যা' }, { status: 500 })
  }
}
