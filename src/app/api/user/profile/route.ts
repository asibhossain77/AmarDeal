import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { comparePassword, hashPassword, needsRehash } from '@/lib/password'

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const id = guard.userId

    const body = await req.json()
    const { action, currentPassword, newPassword, email, phone, imageLink } = body

    const user = await db.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'ইউজার পাওয়া যায়নি' }, { status: 404 })
    }

    /* ─── Change Password (user must provide current password) ─── */
    if (action === 'change_password') {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'বর্তমান ও নতুন পাসওয়ার্ড দিন' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' }, { status: 400 })
      }

      const match = await comparePassword(currentPassword, user.password)
      if (!match) {
        return NextResponse.json({ error: 'বর্তমান পাসওয়ার্ড ভুল হয়েছে' }, { status: 401 })
      }

      const hashedPassword = await hashPassword(newPassword)
      await db.user.update({
        where: { id },
        data: { password: hashedPassword },
      })
      return NextResponse.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' })
    }

    /* ─── Update Profile Image Link ─── */
    if (action === 'update_image_link') {
      await db.user.update({
        where: { id },
        data: { imageLink: imageLink || null },
      })
      return NextResponse.json({ success: true, message: 'প্রোফাইল ছবি আপডেট হয়েছে' })
    }

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
  } catch (err) {
    console.error('User profile error:', err)
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 })
  }
}