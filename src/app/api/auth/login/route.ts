import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, loginNotificationEmail } from '@/lib/email'

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
        password,
      },
      include: { admin: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'ইমেইল/মোবাইল বা পাসওয়ার্ড ভুল হয়েছে' },
        { status: 401 }
      )
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
    })

    // Login notification email (fire-and-forget)
    if (user.email) {
      const loginTime = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'অজানা'
      sendEmail(user.email, loginNotificationEmail(user.name || 'ইউজার', loginTime, clientIp)).catch(() => {})
    }

    // Set session cookie for server-side auth (used by deal-guard, chat, etc.)
    response.cookies.set('amdeal_session', user.id, {
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