import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    // Overview stats
    const [totalAffiliates, totalEarnings, pendingWithdrawals, completedWithdrawals] =
      await Promise.all([
        db.user.count({ where: { affiliateBalance: { gt: 0 } } }),
        db.affiliateEarning.aggregate({ _sum: { amount: true } }),
        db.affiliateWithdrawal.count({ where: { status: 'pending' } }),
        db.affiliateWithdrawal.aggregate({ where: { status: 'approved' }, _sum: { amount: true } }),
      ])

    // Top affiliates (by balance)
    const topAffiliates = await db.user.findMany({
      where: { affiliateBalance: { gt: 0 } },
      select: {
        id: true, name: true, email: true, phone: true,
        referralCode: true, affiliateBalance: true, isActive: true,
        _count: { select: { referredUsers: true, affiliateEarnings: true } },
      },
      orderBy: { affiliateBalance: 'desc' },
      take: 20,
    })

    // Recent earnings
    const recentEarnings = await db.affiliateEarning.findMany({
      include: {
        affiliate: { select: { name: true, referralCode: true } },
        referredUser: { select: { name: true } },
        deal: { select: { title: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Pending withdrawals
    const pendingWdList = await db.affiliateWithdrawal.findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Commission % setting
    let commissionPercent = 30
    try {
      const setting = await db.platformSetting.findUnique({ where: { key: 'affiliate_commission_percent' } })
      if (setting?.value) {
        const parsed = parseFloat(setting.value)
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) commissionPercent = parsed
      }
    } catch { /* use default */ }

    return NextResponse.json({
      stats: {
        activeAffiliates: totalAffiliates,
        totalEarningsDistributed: totalEarnings._sum.amount || 0,
        pendingWithdrawals,
        completedWithdrawalAmount: completedWithdrawals._sum.amount || 0,
      },
      topAffiliates,
      recentEarnings,
      pendingWithdrawals: pendingWdList,
      commissionPercent,
    })
  } catch (err) {
    console.error('[ADMIN AFFILIATE ERROR]', err)
    return NextResponse.json({ error: 'তথ্য পেতে সমস্যা' }, { status: 500 })
  }
}

/** Update commission percentage */
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    const { commissionPercent } = await req.json()
    const num = Number(commissionPercent)
    if (isNaN(num) || num <= 0 || num > 100) {
      return NextResponse.json({ error: 'সঠিক শতাংশ দিন (1-100)' }, { status: 400 })
    }

    await db.platformSetting.upsert({
      where: { key: 'affiliate_commission_percent' },
      update: { value: String(num) },
      create: { key: 'affiliate_commission_percent', value: String(num) },
    })

    return NextResponse.json({ success: true, message: 'কমিশন শতাংশ আপডেট হয়েছে' })
  } catch {
    return NextResponse.json({ error: 'আপডেটে সমস্যা' }, { status: 500 })
  }
}
