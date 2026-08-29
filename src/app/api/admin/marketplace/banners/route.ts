import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

// GET - public, returns active banners ordered by sortOrder
export async function GET() {
  try {
    const banners = await db.marketplaceBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(banners);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

// POST - admin only, creates a new banner
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { title, subtitle, image, link, isActive, sortOrder } = body;

    // validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'ব্যানার শিরোনাম প্রয়োজন' }, { status: 400 });
    }
    if (!image || !image.trim()) {
      return NextResponse.json({ error: 'ব্যানার ছবির লিংক প্রয়োজন' }, { status: 400 });
    }

    const banner = await db.marketplaceBanner.create({
      data: {
        title: title.trim(),
        subtitle: (subtitle || '').trim() || null,
        image: image.trim(),
        link: (link || '').trim() || null,
        isActive: isActive !== undefined ? !!isActive : true,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'সমস্যা হয়েছে';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
