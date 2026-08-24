import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;
    if (!sessionId) {
      console.log('[Push Subscribe] No session cookie');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: sessionId } });
    if (!user || !user.isActive) {
      console.log('[Push Subscribe] User not found or inactive:', sessionId);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys, userAgent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      console.log('[Push Subscribe] Invalid data - endpoint:', !!endpoint, 'p256dh:', !!keys?.p256dh, 'auth:', !!keys?.auth);
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    console.log('[Push Subscribe] Saving for user:', user.id, 'endpoint:', endpoint.substring(0, 80) + '...');

    // Upsert: replace if same endpoint exists
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get('user-agent') || null,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get('user-agent') || null,
      },
    });

    // Verify it was saved
    const count = await db.pushSubscription.count({ where: { userId: user.id } });
    console.log('[Push Subscribe] Saved! User', user.id, 'now has', count, 'subscription(s)');

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error('[Push Subscribe] ERROR:', err);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
