import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'সব ফিল্ড পূরণ করুন' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'ভেরিফিকেশন কোড অবৈধ' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ইমেইল পাওয়া যায়নি' },
        { status: 404 }
      );
    }

    // ── Strict OTP verification ──
    if (!user.resetToken) {
      return NextResponse.json(
        { error: 'আগে ভেরিফিকেশন কোড নিন' },
        { status: 400 }
      );
    }

    if (user.resetToken !== otp) {
      // Wrong OTP → invalidate immediately
      await db.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return NextResponse.json(
        { error: 'ভেরিফিকেশন কোড অবৈধ। আবার নতুন কোড নিন।' },
        { status: 400 }
      );
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      await db.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return NextResponse.json(
        { error: 'কোডের মেয়াদ শেষ হয়েছে। আবার নতুন কোড নিন।' },
        { status: 400 }
      );
    }

    // Hash the new password and clear reset token
    const hashedPassword = await hashPassword(newPassword);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' });
  } catch {
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন' },
      { status: 500 }
    );
  }
}