import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, loginNotificationEmail } from '@/lib/email'
import { comparePassword, hashPassword, needsRehash } from '@/lib/password'

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'ইমেইল/মোবাইল এবং পাসওয়ার্ড দিন' },
        { status: 400 }
      )
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: { admin: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'ইমেইল/মোবাইল বা পাসওয়ার্ড ভুল হয়েছে' },
        { status: 401 }
      )
    }

    // Compare password (handles both bcrypt hash and legacy plaintext)
    const match = await comparePassword(password, user.password)
    if (!match) {
      return NextResponse.json(
        { error: 'ইমেইল/মোবাইল বা পাসওয়ার্ড ভুল হয়েছে' },
        { status: 401 }
      )
    }

    // Block unverified users
    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: 'আপনার ইমেইল এখনো ভেরিফাই হয়েনি। ইমেইলে পাঠানো কোড দিয়ে ভেরিফাই করুন।',
          needsVerification: true,
          userId: user.id,
          email: user.email,
        },
        { status: 403 }
      )
    }

    // Auto-migrate: if password is still plaintext, re-hash it now
    if (needsRehash(user.password)) {
      const hashed = await hashPassword(password)
      db.user.update({ where: { id: user.id }, data: { password: hashed } }).catch(() => {})
    }

    // 2FA check for admin/support/staff accounts with TOTP enabled
    if (user.admin?.totpEnabled) {
      return NextResponse.json({
        requires2FA: true,
        userId: user.id,
        name: user.name,
        email: user.email,
      })
    }

    const adminPermissions = user.admin?.permissions ? JSON.parse(user.admin.permissions) : []

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: !!user.admin,
      adminRole: user.admin?.role ?? null,
      permissions: adminPermissions,
      isSeller: user.isSeller,
      imageLink: user.imageLink ?? null,
    })

    // Login notification email (fire-and-forget)
    if (user.email) {
      const loginTime = new Date().toLocaleString('en', { timeZone: 'Asia/Dhaka' })
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'অজানা'
      sendEmail(user.email, () => loginNotificationEmail(user.name || 'ইউজার', loginTime, clientIp), 'login_notification').catch(() => {})
    }

    // Set session cookie for server-side auth (used by deal-guard, chat, etc.)
    response.cookies.set('midman_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'লগইনে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}