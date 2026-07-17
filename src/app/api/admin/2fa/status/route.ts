import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const admin = await db.admin.findUnique({
      where: { userId: guard.admin.userId },
      select: { totpEnabled: true },
    })

    if (!admin) {
      return NextResponse.json({ totpEnabled: false })
    }

    return NextResponse.json({ totpEnabled: admin.totpEnabled })
  } catch {
    return NextResponse.json({ totpEnabled: false })
  }
}