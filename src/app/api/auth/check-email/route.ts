import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'সঠিক ইমেইল দিন' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email: normalized },
      select: { id: true, emailVerified: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      emailVerified: user.emailVerified,
      name: user.name,
    });
  } catch {
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 });
  }
}