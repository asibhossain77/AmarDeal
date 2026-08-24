import { NextRequest, NextResponse } from 'next/server';
import { sendPushToUser, sendPushToUsers, sendPushToAll } from '@/lib/push';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: sessionId },
      include: { admin: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, userIds, broadcast, title, message, url, tag } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    }

    let sent = 0;

    if (broadcast && user.admin) {
      // Admin broadcast to all
      sent = await sendPushToAll(title, message, url);
    } else if (userIds && Array.isArray(userIds) && user.admin) {
      // Admin send to specific users
      sent = await sendPushToUsers(userIds, title, message, url, tag);
    } else if (userId) {
      // User can only send to themselves (test)
      if (userId !== user.id && !user.admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      sent = await sendPushToUser({ userId, title, body: message, url, tag });
    } else {
      return NextResponse.json({ error: 'Specify userId, userIds, or broadcast' }, { status: 400 });
    }

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error('[Push Send]', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
