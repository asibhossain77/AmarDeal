import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { sendTestWhatsApp } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { phone, message } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'ফোন নম্বর দিন' },
        { status: 400 },
      );
    }

    const result = await sendTestWhatsApp(
      phone,
      message || '🧪 এটি মিডম্যান থেকে একটি টেস্ট WhatsApp মেসেজ।',
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'পাঠাতে সমস্যা হয়েছে' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WA TEST ERROR]', err);
    return NextResponse.json(
      { error: 'টেস্ট মেসেজ পাঠাতে সমস্যা' },
      { status: 500 },
    );
  }
}
