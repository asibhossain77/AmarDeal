import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, passwordResetOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'ইমেইল দিন' },
        { status: 400 }
      );
    }

    const normalized = email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalized } });

    if (!user) {
      return NextResponse.json(
        { error: 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি' },
        { status: 404 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'আপনার ইমেইল এখনো ভেরিফাইড হয়নি। প্রথমে ইমেইল ভেরিফাই করুন।' },
        { status: 403 }
      );
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.user.update({
      where: { id: user.id },
      data: { resetToken: otp, resetTokenExpiry: expiry },
    });

    // Send OTP email (fire-and-forget)
    sendEmail(user.email, () => passwordResetOtpEmail(user.name, otp)).catch((err) => {
      console.error('[FORGOT PASSWORD EMAIL ERROR]', err);
    });

    return NextResponse.json({ success: true, message: 'ইমেইল পাঠানো হয়েছে' });
  } catch {
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন' },
      { status: 500 }
    );
  }
}