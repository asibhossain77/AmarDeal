import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.notification.update({
      where: { id },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'আপডেট করতে সমস্যা' }, { status: 500 })
  }
}

// Mark all as read
export async function PUT(
  req: NextRequest,
) {
  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'আপডেট করতে সমস্যা' }, { status: 500 })
  }
}