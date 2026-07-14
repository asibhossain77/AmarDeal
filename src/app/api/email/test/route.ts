import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, welcomeEmail, dealCreatedEmail, paymentSubmittedEmail, paymentVerifiedEmail, deliveryStartedEmail, dealCompletedEmail, dealCancelledEmail, disputeRaisedEmail, loginNotificationEmail, payoutRequestedEmail, payoutCompletedEmail, disputeResolvedEmail } from '@/lib/email';

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
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, to } = body;

    // Config check — return 400 (not 500) so UI knows config is present
    if (!process.env.BREVO_SMTP_KEY) {
      return NextResponse.json(
        { success: false, error: 'BREVO_SMTP_KEY সেট করা নেই। .env ফাইলে যোগ করুন।' },
        { status: 400 }
      );
    }

    // Special __check__ type — just verify config
    if (type === '__check__') {
      return NextResponse.json({ success: true, message: 'Brevo SMTP configured' });
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