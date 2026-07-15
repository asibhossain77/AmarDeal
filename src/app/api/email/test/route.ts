import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, loadEmailSettings, welcomeEmail, dealCreatedEmail, paymentSubmittedEmail, paymentVerifiedEmail, deliveryStartedEmail, dealCompletedEmail, dealCancelledEmail, disputeRaisedEmail, loginNotificationEmail, payoutRequestedEmail, payoutCompletedEmail, disputeResolvedEmail, passwordResetOtpEmail, emailVerificationOtpEmail } from '@/lib/email';

export const maxDuration = 30; // Vercel serverless timeout 30s

const TEST_TO_FALLBACK = 'asibhossain77@gmail.com';

// Map template type → generator function
function getTestPayload(type: string, toName: string) {
  switch (type) {
    case 'welcome':
      return welcomeEmail(toName,);
    case 'deal_created':
      return dealCreatedEmail(toName, 'টেস্ট ডিল', 5000, 'টেস্ট ইউজার', 'buyer');
    case 'payment_submitted':
      return paymentSubmittedEmail(toName, 'টেস্ট ডিল', 5000);
    case 'payment_verified':
      return paymentVerifiedEmail(toName, 'টেস্ট ডিল', 5000, 'buyer');
    case 'delivery_started':
      return deliveryStartedEmail(toName, 'টেস্ট ডিল', 5000, 'টেস্ট সেলার');
    case 'deal_completed':
      return dealCompletedEmail(toName, 'টেস্ট ডিল', 5000, 'buyer');
    case 'deal_cancelled':
      return dealCancelledEmail(toName, 'টেস্ট ডিল', 'টেস্ট ইউজার');
    case 'dispute_raised':
      return disputeRaisedEmail(toName, 'টেস্ট ডিল', 'টেস্ট ক্রেতা', 5000);
    case 'login_notification':
      return loginNotificationEmail(toName, new Date().toLocaleString('bn-BD'), '192.168.1.1');
    case 'payout_requested':
      return payoutRequestedEmail(toName, 'টেস্ট ডিল', 5000, 'বিকাশ', '০১৭XXXXXXXXX', 'seller_payout');
    case 'payout_completed':
      return payoutCompletedEmail(toName, 'টেস্ট ডিল', 5000, 'বিকাশ', '০১৭XXXXXXXXX', 'seller_payout');
    case 'dispute_resolved':
      return disputeResolvedEmail(toName, 'টেস্ট ডিল', 'complete', 'পণ্য সঠিক পাওয়া গেছে।');
    case 'password_reset_otp':
      return passwordResetOtpEmail(toName, '123456');
    case 'email_verification_otp':
      return emailVerificationOtpEmail(toName, '654321');
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, to } = body;

    // Load email settings so templates use DB values
    const settings = await loadEmailSettings();

    // Special __check__ type — verify config
    if (type === '__check__') {
      const hasKey = !!(settings.brevo_smtp_key || process.env.BREVO_SMTP_KEY);
      if (!hasKey) {
        return NextResponse.json(
          { success: false, error: 'SMTP Key সেট করা নেই। অ্যাডমিন প্যানেলে বা .env ফাইলে যোগ করুন।' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: 'Brevo SMTP configured' });
    }

    const hasKey = !!(settings.brevo_smtp_key || process.env.BREVO_SMTP_KEY);
    if (!hasKey) {
      return NextResponse.json(
        { success: false, error: 'SMTP Key সেট করা নেই। অ্যাডমিন প্যানেলে বা .env ফাইলে যোগ করুন।' },
        { status: 400 }
      );
    }

    // Special __verify__ type — actually send a test email to verify connection
    if (type === '__verify__') {
      const recipient = to || TEST_TO_FALLBACK;
      const testPayload = welcomeEmail('Admin',);
      await sendEmail(recipient, testPayload);
      return NextResponse.json({
        success: true,
        message: `ভেরিফিকেশন ইমেইল পাঠানো হয়েছে → ${recipient}`,
      });
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'type প্যারামিটার দরকার।' },
        { status: 400 }
      );
    }

    const recipientEmail = to || TEST_TO_FALLBACK;
    const payload = getTestPayload(type, 'টেস্ট ইউজার');

    if (!payload) {
      return NextResponse.json(
        { success: false, error: `অজানা টেমপ্লেট: ${type}` },
        { status: 400 }
      );
    }

    await sendEmail(recipientEmail, payload);

    return NextResponse.json({
      success: true,
      message: `ইমেইল পাঠানো হয়েছে → ${recipientEmail}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ইমেইল পাঠাতে সমস্যা হয়েছে।';
    console.error('[EMAIL TEST ERROR]', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}