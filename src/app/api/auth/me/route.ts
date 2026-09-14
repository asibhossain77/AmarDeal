import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { ensureDigitalSchema } from '@/lib/digital-access'

const SESSION_COOKIE = 'midman_session'

export async function GET(req: NextRequest) {
  try {
    // One-time-per-process schema healing for the digital product system
    // (new columns/table) — keeps deploys safe before manual migration.
    await ensureDigitalSchema().catch(() => {})

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
      sellerDisabled: user.sellerDisabled,
      imageLink: user.imageLink ?? null,
    })
  } catch (err) {
    console.error('Session check error:', err)
    return NextResponse.json({ error: 'SESSION_ERROR' }, { status: 500 })
  }
}