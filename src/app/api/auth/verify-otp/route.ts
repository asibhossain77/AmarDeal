import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// In-memory brute-force protection: email → { count, windowStart }
const _attempts = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 min window

function checkRateLimit(email: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = _attempts.get(email);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    _attempts.set(email, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count };
}

function invalidateOtp(email: string) {
  // Invalidate the OTP by clearing it from DB (fire-and-forget)
  db.user
    .updateMany({
      where: { email: email.trim().toLowerCase(), resetToken: { not: null } },
      data: { resetToken: null, resetTokenExpiry: null },
    })
    .catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'ইমেইল এবং কোড দিন' }, { status: 400 });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: '৬ সংখ্যার বৈধ কোড দিন' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting
    const rateCheck = checkRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      // Also invalidate the OTP to prevent further attempts
      invalidateOtp(normalizedEmail);
      return NextResponse.json(
        { error: 'বেশি চেষ্টা করেছেন। আবার নতুন কোড নিন।', blocked: true },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Don't reveal if user exists — but do check rate limit above
    if (!user) {
      return NextResponse.json(
        { error: 'ভেরিফিকেশন কোড অবৈধ বা মেয়াদোত্তীর্ণ হয়েছে' },
        { status: 400 }
      );
    }

    // Check OTP
    if (!user.resetToken || user.resetToken !== otp) {
      const isLastAttempt = rateCheck.remaining <= 1;
      if (isLastAttempt) {
        // Invalidate OTP on last attempt to prevent brute force
        invalidateOtp(normalizedEmail);
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

    // Check expiry
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: 'কোডের মেয়াদ শেষ হয়েছে। আবার নতুন কোড নিন।' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'কোড সঠিক',
      remainingAttempts: rateCheck.remaining,
    });
  } catch {
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন' },
      { status: 500 }
    );
  }
}