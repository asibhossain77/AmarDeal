import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// In-memory brute-force protection
const _attempts = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = _attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    _attempts.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  if (entry.count >= MAX_ATTEMPTS) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, otp } = await request.json();

    if (!userId || !otp) {
      return NextResponse.json({ error: 'তথ্য পাওয়া যায়নি' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: '৬ সংখ্যার বৈধ কোড দিন' }, { status: 400 });
    }

    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      // Invalidate OTP on rate limit
      db.user
        .update({ where: { id: userId }, data: { resetToken: null, resetTokenExpiry: null } })
        .catch(() => {});
      return NextResponse.json(
        { error: 'বেশি চেষ্টা করেছেন। আবার নতুন কোড নিন।', blocked: true },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'অ্যাকাউন্ট পাওয়া যায়নি' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    if (!user.resetToken || user.resetToken !== otp) {
      const isLast = rateCheck.remaining <= 1;
      if (isLast) {
        await db.user.update({
          where: { id: userId },
          data: { resetToken: null, resetTokenExpiry: null },
        });
        return NextResponse.json(
          { error: 'বেশি ভুল চেষ্টা। আবার নতুন কোড নিন।', blocked: true },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `ভেরিফিকেশন কোড ভুল হয়েছে (${rateCheck.remaining}টি চেষ্টা বাকি)` },
        { status: 400 }
      );
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      await db.user.update({
        where: { id: userId },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return NextResponse.json(
        { error: 'কোডের মেয়াদ শেষ হয়েছে। আবার নতুন কোড নিন।', expired: true },
        { status: 400 }
      );
    }

    // ✅ Mark email as verified
    await db.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true, message: 'ইমেইল সফলভাবে ভেরিফাইড হয়েছে' });
  } catch {
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন' },
      { status: 500 }
    );
  }
}