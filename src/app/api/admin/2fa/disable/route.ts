import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { code } = await req.json()

    if (!code) {
      return NextResponse.json(
        { error: 'কোড দিন' },
        { status: 400 }
      )
    }

    // Verify user is admin and has 2FA enabled
    const admin = await db.admin.findFirst({
      where: { userId: guard.admin.userId },
      include: { user: true },
    })

    if (!admin || !admin.user) {
      return NextResponse.json(
        { error: 'অ্যাডমিন পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    if (!admin.totpEnabled || !admin.totpSecret) {
      return NextResponse.json(
        { error: '2FA চালু নেই' },
        { status: 400 }
      )
    }

    // Validate the current TOTP code
    const { authenticator } = await import('otplib')
    const isValid = authenticator.verify({
      token: code,
      secret: admin.totpSecret,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'ভুল কোড। আবার চেষ্টা করুন।' },
        { status: 400 }
      )
    }

    // Disable 2FA and clear the secret
    await db.admin.update({
      where: { id: admin.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
      },
    })

    return NextResponse.json({
      message: 'টু-ফ্যাক্টর অথেনটিকেশন বন্ধ হয়েছে',
    })
  } catch (err) {
    console.error('2FA disable error:', err)
    return NextResponse.json(
      { error: '2FA বন্ধ করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}