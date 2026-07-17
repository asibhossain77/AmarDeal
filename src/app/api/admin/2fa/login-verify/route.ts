import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import * as otplib from 'otplib'

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json()

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'ইউজার আইডি এবং কোড দিন' },
        { status: 400 }
      )
    }

    // Verify user is admin and has totpEnabled
    const user = await db.user.findFirst({
      where: { id: userId },
      include: { admin: true },
    })

    if (!user || !user.admin) {
      return NextResponse.json(
        { error: 'অ্যাডমিন পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    if (!user.admin.totpEnabled || !user.admin.totpSecret) {
      return NextResponse.json(
        { error: '2FA চালু নেই' },
        { status: 400 }
      )
    }

    // Validate the TOTP code
    const isValid = otplib.authenticator.verify({
      token: code,
      secret: user.admin.totpSecret,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'টু-ফ্যাক্টর কোড ভুল হয়েছে' },
        { status: 401 }
      )
    }

    const adminPermissions = user.admin.permissions
      ? JSON.parse(user.admin.permissions)
      : []

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: true,
      adminRole: user.admin.role,
      permissions: adminPermissions,
      isSeller: user.isSeller,
    })

    // Set session cookie (same as login route)
    response.cookies.set('amdeal_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (err) {
    console.error('2FA login verify error:', err)
    return NextResponse.json(
      { error: 'টু-ফ্যাক্টর যাচাইয়ে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}