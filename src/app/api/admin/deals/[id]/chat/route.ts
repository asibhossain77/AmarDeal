import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Verify admin via cookie
async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('midman_session')?.value
  if (!session) return null
  return db.admin.findFirst({ where: { userId: session } })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 })
    }

    const { id } = await params
    const messages = await db.chatMessage.findMany({
      where: { dealId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(messages)
  } catch {
    return NextResponse.json({ error: 'চ্যাট লোড করতে সমস্যা' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminRecord = await verifyAdmin()
    if (!adminRecord) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 })
    }

    const { id } = await params
    const { text } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'মেসেজ দিন' }, { status: 400 })
    }

    // Verify deal exists
    const deal = await db.deal.findUnique({
      where: { id },
      include: { buyer: { select: { name: true } } },
    })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    // Get admin user name
    const adminUser = await db.user.findUnique({ where: { id: adminRecord.userId } })
    const senderName = adminUser?.name || 'অ্যাডমিন'

    const message = await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: adminRecord.userId,
        role: 'admin',
        senderName,
        text: text.trim(),
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'মেসেজ পাঠাতে সমস্যা' }, { status: 500 })
  }
}