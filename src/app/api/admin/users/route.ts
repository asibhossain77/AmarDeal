import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        isSeller: true,
        sellerDisabled: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            role: true,
            permissions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Flatten for frontend: add isAdmin, adminRole, adminPermissions
    const flattened = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      isSeller: u.isSeller,
      sellerDisabled: u.sellerDisabled,
      isAdmin: !!u.admin,
      adminRole: u.admin?.role ?? null,
      adminPermissions: u.admin?.permissions ? JSON.parse(u.admin.permissions) : [],
      createdAt: u.createdAt,
    }))

    return NextResponse.json(flattened)
  } catch {
    return NextResponse.json(
      { error: 'ইউজার লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}