import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'midman_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

export async function POST(request: NextRequest) {
  try {
    const { userId, name, phone } = await request.json()

    if (!userId || !name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'নাম ও ফোন নম্বর দিন' }, { status: 400 })
    }

    if (phone.trim().length < 11) {
      return NextResponse.json({ error: 'সঠিক ফোন নম্বর দিন (কমপক্ষে ১১ ডিজিট)' }, { status: 400 })
    }

    // Check for duplicate phone
    const existingPhone = await db.user.findFirst({
      where: { phone: phone.trim(), NOT: { id: userId } },
    })
    if (existingPhone) {
      return NextResponse.json({ error: 'এই ফোন নম্বরে আগে থেকেই একটি অ্যাকাউন্ট আছে' }, { status: 400 })
    }

    // Update user
    const user = await db.user.update({
      where: { id: userId },
      data: { name: name.trim(), phone: phone.trim() },
    })

    // Build user info response
    const isAdmin = !!(await db.admin.findUnique({ where: { userId: user.id } }))
    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin,
      adminRole: isAdmin ? (await db.admin.findUnique({ where: { userId: user.id } }))?.role || '' : '',
      permissions: isAdmin ? JSON.parse((await db.admin.findUnique({ where: { userId: user.id } }))?.permissions || '[]') : [],
      isSeller: user.isSeller,
      imageLink: user.imageLink,
    }

    const response = NextResponse.json({ success: true, user: userInfo })
    response.cookies.set(SESSION_COOKIE, user.id, COOKIE_OPTIONS)
    return response
  } catch (err) {
    console.error('[COMPLETE PROFILE] Error:', err)
    return NextResponse.json({ error: 'সার্ভারে সমস্যা হয়েছে' }, { status: 500 })
  }
}
