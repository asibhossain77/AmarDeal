import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getVapidPublicKey } from '@/lib/push';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;

    if (!sessionId) {
      return NextResponse.json({ enabled: false, vapidKey: '' });
    }

    const subCount = await db.pushSubscription.count({
      where: { userId: sessionId },
    });

    return NextResponse.json({
      enabled: subCount > 0,
      subscriptionCount: subCount,
      vapidKey: getVapidPublicKey(),
    });
  } catch {
    return NextResponse.json({ enabled: false, vapidKey: getVapidPublicKey() });
  }
}
