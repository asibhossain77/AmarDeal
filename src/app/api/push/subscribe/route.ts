import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;
    if (!sessionId) {
      console.log('[FCM Subscribe] No session cookie');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: sessionId } });
    if (!user || !user.isActive) {
      console.log('[FCM Subscribe] User not found or inactive:', sessionId);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { token, userAgent } = body;

    if (!token) {
      console.log('[FCM Subscribe] Invalid data - token:', !!token);
      return NextResponse.json({ error: 'Invalid token data' }, { status: 400 });
    }

    console.log('[FCM Subscribe] Saving for user:', user.id, 'token:', token.substring(0, 40) + '...');

    // Upsert: replace if same token exists
    await db.fcmToken.upsert({
      where: { token },
      update: {
        userId: user.id,
        userAgent: userAgent || req.headers.get('user-agent') || undefined,
      },
      create: {
        userId: user.id,
        token,
        platform: 'web',
        userAgent: userAgent || req.headers.get('user-agent') || undefined,
      },
    });

    // Verify it was saved
    const count = await db.fcmToken.count({ where: { userId: user.id } });
    console.log('[FCM Subscribe] Saved! User', user.id, 'now has', count, 'token(s)');

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error('[FCM Subscribe] ERROR:', err);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
