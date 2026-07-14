import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

async function getAdminUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('amdeal_session');
  if (session?.value) return session.value;
  return null;
}

export async function GET() {
  try {
    const userId = await getAdminUserId();
    if (!userId) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 });
    }

    const admin = await db.admin.findUnique({ where: { userId } });
    if (!admin) {
      return NextResponse.json({ error: 'অ্যাডমিন পাওয়া যায়নি' }, { status: 403 });
    }

    const settings = await db.platformSetting.findMany({
      where: {
        key: {
          in: ['contract_content', 'admin_display_name', 'admin_image_url'],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json({
      content: map['contract_content'] || '',
      adminName: map['admin_display_name'] || '',
      adminImageUrl: map['admin_image_url'] || '',
    });
  } catch {
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getAdminUserId();
    if (!userId) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 });
    }

    const admin = await db.admin.findUnique({ where: { userId } });
    if (!admin) {
      return NextResponse.json({ error: 'অ্যাডমিন পাওয়া যায়নি' }, { status: 403 });
    }

    const body = await req.json();
    const { action, content, adminName, adminImageUrl } = body;

    if (action === 'save_content') {
      if (typeof content !== 'string') {
        return NextResponse.json({ error: 'কন্টেন্ট স্ট্রিং হতে হবে' }, { status: 400 });
      }
      await db.platformSetting.upsert({
        where: { key: 'contract_content' },
        update: { value: content },
        create: { key: 'contract_content', value: content },
      });
      return NextResponse.json({ message: 'চুক্তির কন্টেন্ট সেভ হয়েছে' });
    }

    if (action === 'save_admin_info') {
      if (typeof adminName !== 'string' || !adminName.trim()) {
        return NextResponse.json({ error: 'নাম দিন' }, { status: 400 });
      }
      await db.platformSetting.upsert({
        where: { key: 'admin_display_name' },
        update: { value: adminName.trim() },
        create: { key: 'admin_display_name', value: adminName.trim() },
      });
      await db.platformSetting.upsert({
        where: { key: 'admin_image_url' },
        update: { value: (adminImageUrl || '').trim() },
        create: { key: 'admin_image_url', value: (adminImageUrl || '').trim() },
      });
      return NextResponse.json({ message: 'অ্যাডমিন তথ্য সেভ হয়েছে' });
    }

    return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা' },
      { status: 500 }
    );
  }
}