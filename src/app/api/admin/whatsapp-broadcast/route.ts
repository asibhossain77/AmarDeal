import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { sendWhatsAppBroadcast } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { message, userIds, limit } = await req.json();

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'মেসেজ দিন' },
        { status: 400 },
      );
    }

    if (message.length > 4096) {
      return NextResponse.json(
        { error: 'মেসেজ ৪০৯৬ ক্যারেক্টারের বেশি হতে পারে না' },
        { status: 400 },
      );
    }

    const result = await sendWhatsAppBroadcast(message.trim(), {
      userIds: userIds as string[] | undefined,
      limit: typeof limit === 'number' ? limit : 500,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[WA BROADCAST ERROR]', err);
    const msg = err instanceof Error ? err.message : 'ব্রডকাস্টে সমস্যা';
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
