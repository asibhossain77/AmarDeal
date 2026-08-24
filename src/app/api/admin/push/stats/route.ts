import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('midman_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: sessionId }, include: { admin: true } });
    if (!user?.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const count = await db.pushSubscription.count({
      where: { user: { isActive: true } },
    });

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[Admin Push Stats]', err);
    return NextResponse.json({ count: 0 });
  }
}
