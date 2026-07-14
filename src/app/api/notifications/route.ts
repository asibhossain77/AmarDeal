import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: { userId, read: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ error: 'নোটিফিকেশন লোড করতে সমস্যা' }, { status: 500 })
  }
}