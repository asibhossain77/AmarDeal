import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getVapidPublicKey } from '@/lib/push';

export async function GET() {
  try {
    const vapidKey = getVapidPublicKey();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;

    if (!sessionId) {
      return NextResponse.json({ enabled: false, vapidKey, diagnostics: { session: false } });
    }

    let subCount = 0;
    let totalSubs = 0;
    try {
      subCount = await db.pushSubscription.count({ where: { userId: sessionId } });
      totalSubs = await db.pushSubscription.count();
    } catch (dbErr) {
      console.error('[Push Status] DB error:', dbErr);
    }

    return NextResponse.json({
      enabled: subCount > 0,
      subscriptionCount: subCount,
      vapidKey,
      diagnostics: {
        session: true,
        vapidConfigured: !!vapidKey,
        dbWorking: true,
        userSubCount: subCount,
        totalSubscriptions: totalSubs,
      },
    });
  } catch (err) {
    console.error('[Push Status] Error:', err);
    return NextResponse.json({
      enabled: false,
      vapidKey: getVapidPublicKey(),
      diagnostics: { error: true, vapidConfigured: !!getVapidPublicKey() },
    });
  }
}
