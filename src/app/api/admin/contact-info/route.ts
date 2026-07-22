import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET() {
  try {
    const info = await db.contactInfo.findFirst();
    if (!info) {
      return NextResponse.json({
        phone: null,
        email: null,
        whatsapp: null,
        telegram: null,
        facebook: null,
        facebookPage: null,
        facebookGroup: null,
        telegramGroup: null,
        address: null,
      });
    }
    return NextResponse.json(info);
  } catch {
    return NextResponse.json(
      { error: 'যোগাযোগ তথ্য লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const body = await req.json();
    const { phone, email, whatsapp, telegram, facebook, facebookPage, facebookGroup, telegramGroup, address } = body;

    const existing = await db.contactInfo.findFirst();

    const data = {
      phone: phone || null,
      email: email || null,
      whatsapp: whatsapp || null,
      telegram: telegram || null,
      facebook: facebook || null,
      facebookPage: facebookPage || null,
      facebookGroup: facebookGroup || null,
      telegramGroup: telegramGroup || null,
      address: address || null,
    };

    if (existing) {
      const updated = await db.contactInfo.update({
        where: { id: existing.id },
        data,
      });
      return NextResponse.json(updated);
    } else {
      const created = await db.contactInfo.create({ data });
      return NextResponse.json(created);
    }
  } catch {
    return NextResponse.json(
      { error: 'যোগাযোগ তথ্য সংরক্ষণ করতে সমস্যা হয়েছে' },
      { status: 500 }
    );
  }
}