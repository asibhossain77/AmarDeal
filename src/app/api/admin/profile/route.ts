import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-Id')
    const cookie = req.cookies.get('amdeal_session')?.value
    const id = userId || cookie

    if (!id) {
      return NextResponse.json({ error: 'অনুমোদন নেই' }, { status: 401 })
    }

    // Verify admin
    const admin = await db.admin.findUnique({ where: { userId: id } })
    if (!admin) {
      return NextResponse.json({ error: 'অ্যাডমিন অনুমোদন নেই' }, { status: 403 })
    }

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    const body = await req.json()
    const { action, currentPassword, newPassword, email, phone } = body

    /* ─── Change Email ─── */
    if (action === 'change_email') {
      if (!email || !email.trim()) {
        return NextResponse.json({ error: 'ইমেইল দিন' }, { status: 400 })
      }
      const trimmed = email.trim().toLowerCase()
      const existing = await db.user.findFirst({ where: { email: trimmed, id: { not: id } } })
      if (existing) {
        return NextResponse.json({ error: 'এই ইমেইল আগেই ব্যবহৃত' }, { status: 409 })
      }
      await db.user.update({ where: { id }, data: { email: trimmed } })
      return NextResponse.json({ success: true, message: 'ইমেইল সফলভাবে পরিবর্তন হয়েছে', email: trimmed })
    }

    /* ─── Change Phone ─── */
    if (action === 'change_phone') {
      if (!phone || !phone.trim()) {
        return NextResponse.json({ error: 'ফোন নম্বর দিন' }, { status: 400 })
      }
      const trimmed = phone.trim()
      const existing = await db.user.findFirst({ where: { phone: trimmed, id: { not: id } } })
      if (existing) {
        return NextResponse.json({ error: 'এই নম্বর আগেই ব্যবহৃত' }, { status: 409 })
      }
      await db.user.update({ where: { id }, data: { phone: trimmed } })
      return NextResponse.json({ success: true, message: 'ফোন নম্বর সফলভাবে পরিবর্তন হয়েছে', phone: trimmed })
    }

    /* ─── Change Password ─── */
    if (action === 'change_password') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'বর্তমান ও নতুন পাসওয়ার্ড দিন' }, { status: 400 })
      }
      if (currentPassword !== user.password) {
        return NextResponse.json({ error: 'বর্তমান পাসওয়ার্ড ভুল হয়েছে' }, { status: 401 })
      }
      if (newPassword.length < 4) {
        return NextResponse.json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে' }, { status: 400 })
      }
      await db.user.update({ where: { id }, data: { password: newPassword } })
      return NextResponse.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' })
    }

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('Admin profile error:', err)
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 })
  }
}