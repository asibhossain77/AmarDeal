import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'amdeal_session'

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.cookies.get(SESSION_COOKIE)?.value

    if (!sessionId) {
      return NextResponse.json({ error: 'NO_SESSION' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: sessionId },
      include: { admin: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 401 })
    }

    const adminPermissions = user.admin?.permissions ? JSON.parse(user.admin.permissions) : []

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: !!user.admin,
      adminRole: user.admin?.role ?? null,
      permissions: adminPermissions,
      isSeller: user.isSeller,
      imageLink: user.imageLink ?? null,
    })
  } catch (err) {
    console.error('Session check error:', err)
    return NextResponse.json({ error: 'SESSION_ERROR' }, { status: 500 })
  }
}