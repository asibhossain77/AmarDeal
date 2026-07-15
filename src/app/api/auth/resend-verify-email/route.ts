import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, emailVerificationOtpEmail } from '@/lib/email';

// Rate limit: max 3 resends per 10 min per user
const _resends = new Map<string, { count: number; windowStart: number }>();
const MAX_RESENDS = 3;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'তথ্য পাওয়া যায়নি' }, { status: 400 });
    }

    const now = Date.now();
    const entry = _resends.get(userId);
    if (entry && now - entry.windowStart < WINDOW_MS && entry.count >= MAX_RESENDS) {
      return NextResponse.json(
        { error: 'অতিরিক্ত রিসেন্ড করেছেন। কিছুক্ষণ পর আবার চেষ্টা করুন।' },
        { status: 429 }
      );
    }
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      _resends.set(userId, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }

    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'অ্যাকাউন্ট পাওয়া যায়নি' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    // Generate new OTP (10 min)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: userId },
      data: { resetToken: otp, resetTokenExpiry: otpExpiry },
    });

    sendEmail(user.email, emailVerificationOtpEmail(user.name, otp)).catch((err) => {
      console.error('[RESEND VERIFY EMAIL ERROR]', err);
    });

    return NextResponse.json({ success: true, message: 'নতুন কোড পাঠানো হয়েছে' });
  } catch {
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন' },
      { status: 500 }
    );
  }
}