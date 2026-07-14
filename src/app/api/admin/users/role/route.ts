import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { userId, action, value } = await req.json()

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'ইউজার আইডি ও অ্যাকশন প্রদান করুন' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: 'ইউজার পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    /* ─── Toggle Active/Deactive ─── */
    if (action === 'toggle_active') {
      const newStatus = value === true || value === 'true'
      await db.user.update({
        where: { id: userId },
        data: { isActive: newStatus },
      })
      return NextResponse.json({
        success: true,
        message: newStatus ? 'ইউজার সক্রিয় করা হয়েছে' : 'ইউজার নিষ্ক্রিয় করা হয়েছে',
      })
    }

    /* ─── Change Password ─── */
    if (action === 'change_password') {
      const newPassword = typeof value === 'string' ? value.trim() : ''
      if (!newPassword || newPassword.length < 4) {
        return NextResponse.json(
          { error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে' },
          { status: 400 }
        )
      }
      await db.user.update({
        where: { id: userId },
        data: { password: newPassword },
      })
      return NextResponse.json({
        success: true,
        message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে',
      })
    }

    if (action === 'set_admin') {
      const adminRole = value || 'support'

      // ── Safeguard: prevent downgrading the LAST super admin ──
      const existingAdmin = await db.admin.findUnique({ where: { userId } })
      if (existingAdmin?.role === 'super_admin' && adminRole !== 'super_admin') {
        const superAdminCount = await db.admin.count({ where: { role: 'super_admin' } })
        if (superAdminCount <= 1) {
          return NextResponse.json(
            { error: 'শেষ সুপার অ্যাডমিনের রোল পরিবর্তন করা যাবে না। আগে অন্য কাউকে সুপার অ্যাডমিন বানান।' },
            { status: 400 }
          )
        }
      }

      if (existingAdmin) {
        await db.admin.update({
          where: { userId },
          data: {
            role: adminRole,
            permissions: '[]',
          },
        })
      } else {
        await db.admin.create({
          data: { userId, role: adminRole, permissions: '[]' },
        })
      }

      return NextResponse.json({
        success: true,
        message: adminRole === 'staff'
          ? 'স্টাফ হিসেবে সেট করা হয়েছে — এখন পারমিশন দিন'
          : 'অ্যাডমিন হিসেবে সেট করা হয়েছে',
      })
    }

    if (action === 'set_staff_permissions') {
      const permissions = Array.isArray(value) ? value : []
      const existing = await db.admin.findUnique({ where: { userId } })

      if (!existing || existing.role !== 'staff') {
        return NextResponse.json(
          { error: 'শুধুমাত্র স্টাফ অ্যাকাউন্টের জন্য পারমিশন সেট করা যায়' },
          { status: 400 }
        )
      }

      await db.admin.update({
        where: { userId },
        data: { permissions: JSON.stringify(permissions) },
      })

      return NextResponse.json({
        success: true,
        message: `${permissions.length}টি পারমিশন সেট করা হয়েছে`,
      })
    }

    if (action === 'remove_admin') {
      // ── Safeguard: prevent removing the LAST super admin ──
      const targetAdmin = await db.admin.findUnique({ where: { userId } })
      if (targetAdmin?.role === 'super_admin') {
        const superAdminCount = await db.admin.count({ where: { role: 'super_admin' } })
        if (superAdminCount <= 1) {
          return NextResponse.json(
            { error: 'শেষ সুপার অ্যাডমিনকে সরানো যাবে না। আগে অন্য কাউকে সুপার অ্যাডমিন বানান।' },
            { status: 400 }
          )
        }
      }

      await db.admin.deleteMany({ where: { userId } })
      return NextResponse.json({
        success: true,
        message: 'অ্যাডমিন থেকে সরানো হয়েছে',
      })
    }

    return NextResponse.json(
      { error: 'অবৈধ অ্যাকশন' },
      { status: 400 }
    )
  } catch (err) {
    console.error('User action error:', err)
    return NextResponse.json(
      { error: 'অ্যাকশন ব্যর্থ হয়েছে' },
      { status: 500 }
    )
  }
}