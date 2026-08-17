import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Public endpoint: returns only active affiliate payment methods
export async function GET() {
  try {
    const methods = await db.affiliatePaymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });
    return NextResponse.json(methods);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
