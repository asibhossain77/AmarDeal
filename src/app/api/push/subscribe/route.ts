import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { subscription } = body as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    }

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Upsert: if endpoint exists, update; otherwise create
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: req.headers.get('user-agent') || undefined,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint')

    if (endpoint) {
      // Delete specific endpoint
      await db.pushSubscription.deleteMany({
        where: { userId, endpoint },
      })
    } else {
      // Delete all subscriptions for this user
      await db.pushSubscription.deleteMany({ where: { userId } })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 })
  }
}
