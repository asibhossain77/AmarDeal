import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, welcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, password } = await req.json()

    if (!name || !phone || !email || !password) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' },
        { status: 400 }
      )
    }

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'এই ইমেইল বা মোবাইল নাম্বার দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে' },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: { name, phone, email, password },
    })

    // Welcome email
    if (user.email) {
      sendEmail(user.email, welcomeEmail(user.name || 'ইউজার')).catch(() => {})
    }

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: false,
      adminRole: null,
      isSeller: false,
    })

    // Set session cookie so refresh keeps the user logged in
    response.cookies.set('amdeal_session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'নিবন্ধনে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}