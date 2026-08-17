import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth-admin';

export async function GET() {
  try {
    await getAdminUser();
    const methods = await db.affiliatePaymentMethod.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(methods);
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await getAdminUser();
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const maxOrder = await db.affiliatePaymentMethod.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const method = await db.affiliatePaymentMethod.create({
      data: {
        name: name.trim(),
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(method, { status: 201 });
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}