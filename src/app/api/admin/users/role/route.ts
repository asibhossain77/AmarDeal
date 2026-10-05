import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { hashPassword } from '@/lib/password'
import { deleteFromR2 } from '@/lib/r2'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const caller = guard.admin;
    const { userId, action, value } = await req.json()

    // ── Server-side role hierarchy (the UI gates panels client-side only —
    // the API is what actually matters) ──
    // super_admin: everything. support: plain-user management. staff: only
    // plain-user management when they hold the 'users' permission.
    const callerIsSuper = caller.role === 'super_admin'
    let staffHasUsersPerm = false
    if (caller.role === 'staff') {
      try { staffHasUsersPerm = (JSON.parse(caller.permissions || '[]') as string[]).includes('users') } catch { staffHasUsersPerm = false }
    }
    const canManagePlainUsers = callerIsSuper || caller.role === 'support' || staffHasUsersPerm
    const forbidden = (extra?: string) =>
      NextResponse.json(
        { error: extra ?? 'এই কাজের জন্য সুপার অ্যাডমিন অনুমতি প্রয়োজন', code: 'FORBIDDEN' },
        { status: 403 }
      )

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'ইউজার আইডি ও অ্যাকশন প্রদান করুন' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      // admin relation is needed by the delete_user super-admin check below —
      // without include it is undefined at runtime and the check never fires.
      include: { admin: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: 'ইউজার পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    /* ─── Toggle Active/Deactive ─── */
    if (action === 'toggle_active') {
      // Deactivating an admin (incl. self) is super_admin territory
      if (user.admin && !callerIsSuper) return forbidden()
      if (!canManagePlainUsers && !user.admin) return forbidden()
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

    /* ─── Toggle Seller Disabled ─── */
    if (action === 'toggle_seller_disabled') {
      if (user.admin && !callerIsSuper) return forbidden()
      if (!canManagePlainUsers && !user.admin) return forbidden()
      if (!user.isSeller) {
        return NextResponse.json(
          { error: 'এই ইউজার সেলার নয়' },
          { status: 400 }
        )
      }
      const newStatus = value === true || value === 'true'
      await db.user.update({
        where: { id: userId },
        data: { sellerDisabled: newStatus },
      })
      return NextResponse.json({
        success: true,
        message: newStatus ? 'সেলার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে' : 'সেলার অ্যাকাউন্ট সক্রিয় করা হয়েছে',
      })
    }

    /* ─── Change Password ─── */
    if (action === 'change_password') {
      // Resetting an ADMIN's password = account takeover vector → super only
      if (user.admin && !callerIsSuper) return forbidden()
      if (!canManagePlainUsers && !user.admin) return forbidden()
      const newPassword = typeof value === 'string' ? value.trim() : ''
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' },
          { status: 400 }
        )
      }
      const hashedPassword = await hashPassword(newPassword)
      await db.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      })
      return NextResponse.json({
        success: true,
        message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে',
      })
    }

    if (action === 'set_admin') {
      // Only super_admin may create/modify admins — otherwise any staff member
      // could elevate themselves (verified exploitable before this fix).
      if (!callerIsSuper) return forbidden()

      const ALLOWED_ROLES = ['super_admin', 'support', 'staff'] as const
      const adminRole = ALLOWED_ROLES.includes(value) ? value : 'support'

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
      // Granting permissions is super_admin-only (staff could otherwise
      // grant themselves any permission)
      if (!callerIsSuper) return forbidden()
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
      if (!callerIsSuper) return forbidden()
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

    /* ─── Delete User ─── */
    if (action === 'delete_user') {
      if (user.admin && !callerIsSuper) return forbidden()
      if (!canManagePlainUsers && !user.admin) return forbidden()
      // Prevent deleting admin users through this action (user.admin is
      // reliably loaded via include above)
      if (user.admin?.role === 'super_admin') {
        const superAdminCount = await db.admin.count({ where: { role: 'super_admin' } })
        if (superAdminCount <= 1) {
          return NextResponse.json(
            { error: 'শেষ সুপার অ্যাডমিনকে ডিলিট করা যাবে না' },
            { status: 400 }
          )
        }
      }

      // Check if user has any deals — prevent deletion to preserve financial records
      const dealCount = await db.deal.count({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId },
            { creatorId: userId },
          ],
        },
      })
      if (dealCount > 0) {
        return NextResponse.json(
          { error: `এই ইউজারের ${dealCount}টি ডিল আছে। ডিল থাকা অবস্থায় ইউজার ডিলিট করা যাবে না। ইউজার ডিঅ্যাক্টিভেট করুন।` },
          { status: 400 }
        )
      }

      // Delete user's profile image from R2
      if (user.imageLink) {
        await deleteFromR2(user.imageLink)
      }

      // Delete digital product images from R2
      const products = await db.digitalProduct.findMany({
        where: { sellerId: userId },
        select: { id: true, image: true },
      })
      for (const p of products) {
        if (p.image) await deleteFromR2(p.image)
      }

      // Clean up relations in a transaction
      await db.$transaction([
        // Delete product chat messages
        db.productChatMessage.deleteMany({ where: { senderId: userId } }),
        // Delete digital products (cascade deletes their chat messages)
        db.digitalProduct.deleteMany({ where: { sellerId: userId } }),
        // Delete seller applications
        db.sellerApplication.deleteMany({ where: { userId } }),
        // Null out reviews
        db.review.updateMany({ where: { userId }, data: { userId: null } }),
        // Delete affiliate earnings
        db.affiliateEarning.deleteMany({ where: { affiliateId: userId } }),
        // Delete affiliate withdrawals
        db.affiliateWithdrawal.deleteMany({ where: { userId } }),
        // Null out referral references from other users
        db.user.updateMany({ where: { referredBy: userId }, data: { referredBy: null } }),
        // Delete admin record if exists
        db.admin.deleteMany({ where: { userId } }),
        // Notifications will cascade delete automatically
        // Finally delete the user
        db.user.delete({ where: { id: userId } }),
      ])

      return NextResponse.json({
        success: true,
        message: 'ইউজার সফলভাবে ডিলিট করা হয়েছে',
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