import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import * as otplib from 'otplib'

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

    // Verify user is admin and has a totpSecret stored
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

    if (!admin.totpSecret) {
      return NextResponse.json(
        { error: 'প্রথমে 2FA সেটআপ করুন' },
        { status: 400 }
      )
    }

    // Validate the TOTP code
    const isValid = otplib.authenticator.verify({
      token: code,
      secret: admin.totpSecret,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'ভুল কোড। আবার চেষ্টা করুন।' },
        { status: 400 }
      )
    }

    // Enable 2FA
    await db.admin.update({
      where: { id: admin.id },
      data: { totpEnabled: true },
    })

    return NextResponse.json({
      message: 'টু-ফ্যাক্টর অথেনটিকেশন সফলভাবে চালু হয়েছে',
    })
  } catch (err) {
    console.error('2FA enable error:', err)
    return NextResponse.json(
      { error: '2FA চালু করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}