import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { isFcmConfigured } from '@/lib/fcm';

export async function GET() {
  try {
    const fcmConfigured = isFcmConfigured();
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;

    if (!sessionId) {
      return NextResponse.json({ enabled: false, fcmConfigured, vapidKey, subscriptionCount: 0, diagnostics: { session: false } });
    }

    let subCount = 0;
    let totalSubs = 0;
    try {
      subCount = await db.fcmToken.count({ where: { userId: sessionId } });
      totalSubs = await db.fcmToken.count();
    } catch (dbErr) {
      console.error('[FCM Status] DB error:', dbErr);
    }

    return NextResponse.json({
      enabled: subCount > 0,
      fcmConfigured,
      vapidKey,
      subscriptionCount: subCount,
      diagnostics: {
        session: true,
        fcmConfigured,
        dbWorking: true,
        userTokenCount: subCount,
        totalTokens: totalSubs,
      },
    });
  } catch (err) {
    console.error('[FCM Status] Error:', err);
    return NextResponse.json({
      enabled: false,
      fcmConfigured: isFcmConfigured(),
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      subscriptionCount: 0,
      diagnostics: { error: true, fcmConfigured: isFcmConfigured() },
    });
  }
}
