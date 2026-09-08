import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { ensureVerificationColumn, generateVerificationCode, withVerificationColumn } from '@/lib/seller-verify'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { whatsappNumber } = body

    const wa = typeof whatsappNumber === 'string' ? whatsappNumber.trim() : ''
    if (!wa) {
      return NextResponse.json(
        { error: 'WhatsApp নম্বর দিন' },
        { status: 400 }
      )
    }
    if (!/^[+]?[0-9\s-]{6,20}$/.test(wa)) {
      return NextResponse.json(
        { error: 'সঠিক WhatsApp নম্বর দিন' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: '\u0987\u0989\u099C\u09BE\u09B0 \u09AA\u09BE\u0993\u09AF\u09BC\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF' },
        { status: 404 }
      )
    }

    if (user.isSeller) {
      return NextResponse.json(
        { error: '\u0986\u09AA\u09A8\u09BF \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u098F\u0995\u099C\u09A8 \u09B8\u09C7\u09B2\u09BE\u09B0' },
        { status: 400 }
      )
    }

    const existing = await withVerificationColumn(() =>
      db.sellerApplication.findFirst({
        where: { userId, status: 'pending' },
      })
    )
    if (existing) {
      return NextResponse.json(
        { error: '\u0986\u09AA\u09A8\u09BE\u09B0 \u0986\u09AC\u09C7\u09A6\u09A8 \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7 \u09AA\u09C7\u09A8\u09CD\u09A1\u09BF\u0982 \u0986\u099B\u09C7', pending: true },
        { status: 400 }
      )
    }

    await ensureVerificationColumn()

    const verificationCode = generateVerificationCode()

    await db.sellerApplication.create({
      data: {
        userId,
        businessName: '',
        email: user.email || '',
        phone: user.phone || '',
        whatsappNumber: wa,
        verificationCode,
        status: 'pending',
      },
    })

    // The code is returned ONLY here (shown once in the code box).
    // It is never exposed again through user-facing GETs — the admin sends it via WhatsApp.
    return NextResponse.json({ success: true, verificationCode })
  } catch (err) {
    console.error('Become seller error:', err)
    return NextResponse.json(
      { error: '\u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const application = await db.sellerApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ application })
  } catch (err) {
    console.error('Get seller application error:', err)
    return NextResponse.json(
      { error: '\u09B8\u09AE\u09B8\u09CD\u09AF\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7' },
      { status: 500 }
    )
  }
}
