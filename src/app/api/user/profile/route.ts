import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { comparePassword, hashPassword, needsRehash } from '@/lib/password'
import { deleteFromR2 } from '@/lib/r2'

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const id = guard.userId

    const body = await req.json()
    const { action, currentPassword, newPassword, email, phone, imageLink, name } = body

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

    /* ─── Update Permitted Profile Info (name / phone only — email, roles and
           seller/admin flags are identity or permission fields and can never
           be changed through this endpoint) ─── */
    if (action === 'update_info') {
      const updates: { name?: string; phone?: string } = {}

      if (name !== undefined) {
        const trimmedName = String(name).trim()
        if (trimmedName.length < 2 || trimmedName.length > 60) {
          return NextResponse.json({ error: 'নাম কমপক্ষে ২ অক্ষর এবং সর্বোচ্চ ৬০ অক্ষরের হতে হবে' }, { status: 400 })
        }
        updates.name = trimmedName
      }

      if (phone !== undefined) {
        const trimmedPhone = String(phone).trim()
        if (!/^[+]?[0-9\s-]{6,20}$/.test(trimmedPhone)) {
          return NextResponse.json({ error: 'সঠিক ফোন নম্বর দিন' }, { status: 400 })
        }
        // Prevent taking a phone number that belongs to another account
        if (trimmedPhone !== (user.phone || '')) {
          const duplicate = await db.user.findFirst({
            where: { phone: trimmedPhone, NOT: { id } },
            select: { id: true },
          })
          if (duplicate) {
            return NextResponse.json({ error: 'এই ফোন নম্বরটি অন্য অ্যাকাউন্টে ব্যবহৃত হচ্ছে' }, { status: 400 })
          }
        }
        updates.phone = trimmedPhone
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'পরিবর্তনের কিছু নেই' }, { status: 400 })
      }

      const updated = await db.user.update({ where: { id }, data: updates })
      return NextResponse.json({
        success: true,
        message: 'প্রোফাইল তথ্য আপডেট হয়েছে',
        user: { name: updated.name, phone: updated.phone },
      })
    }

    /* ─── Update Profile Image Link ─── */
    if (action === 'update_image_link') {
      const oldUrl = user.imageLink
      if (!imageLink && oldUrl) {
        await deleteFromR2(oldUrl)
      }
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