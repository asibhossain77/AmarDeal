import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { generateUniqueReferralCode } from '@/lib/referral-code'

/**
 * POST /api/admin/generate-referral-codes
 * Admin-only endpoint to batch-generate referral codes for existing users
 * who don't have one yet.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.ok) return guard.response

  try {
    // Find all users without a referral code
    const users = await db.user.findMany({
      where: { referralCode: null },
      select: { id: true, name: true },
    })

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'সকল ইউজারের ইতিমধ্যে রেফারেল কোড আছে',
        generated: 0,
      })
    }

    let generated = 0
    let failed = 0

    for (const user of users) {
      try {
        const code = await generateUniqueReferralCode(user.name)
        await db.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        })
        generated++
      } catch {
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${generated} জন ইউজারের রেফারেল কোড তৈরি হয়েছে${failed > 0 ? `, ${failed} জনের ব্যর্থ` : ''}`,
      generated,
      failed,
    })
  } catch (err) {
    console.error('[GENERATE REFERRAL CODES ERROR]', err)
    return NextResponse.json(
      { error: 'রেফারেল কোড তৈরিতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
