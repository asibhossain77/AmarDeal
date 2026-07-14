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

    const body = await req.json()
    const { action, currentPassword, newPassword, email, phone } = body

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    /* ─── Change Password (user must provide current password) ─── */
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
      await db.user.update({
        where: { id },
        data: { password: newPassword },
      })
      return NextResponse.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' })
    }

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('User profile error:', err)
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 })
  }
}