import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Verify admin via cookie
async function verifyAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('amdeal_session')?.value
  if (!session) return null
  return db.admin.findFirst({ where: { userId: session } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 })
    }

    const { id } = await params

    const deal = await db.deal.findUnique({ where: { id } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }

    if (!deal.adminCalled) {
      return NextResponse.json({ message: 'কল ইতিমধ্যে শেষ হয়েছে' })
    }

    await db.deal.update({
      where: { id },
      data: {
        adminCalled: false,
        adminCalledAt: null,
      },
    })

    // Add a system message to the chat to indicate admin left
    await db.chatMessage.create({
      data: {
        dealId: id,
        senderId: admin.userId,
        role: 'system',
        senderName: 'সিস্টেম',
        text: 'অ্যাডমিন চ্যাট শেষ করেছেন। প্রয়োজনে আবার অ্যাডমিন ডাকুন।',
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 })
  }
}