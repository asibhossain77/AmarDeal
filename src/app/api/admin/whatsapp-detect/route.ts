import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { db } from '@/lib/db';

/**
 * Auto-detect WhatsApp Phone Number ID using the access token.
 * GET /api/admin/whatsapp-detect
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    // Get access token from DB or env
    const row = await db.platformSetting.findUnique({ where: { key: 'wa_access_token' } });
    const accessToken = row?.value || process.env.WA_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access Token সেট করুন আগে' },
        { status: 400 },
      );
    }

    // Call Meta API to get phone numbers
    const res = await fetch(
      'https://graph.facebook.com/v21.0/me/phone_numbers?access_token=' + accessToken,
    );

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      return NextResponse.json(
        { error: `Meta API error: ${JSON.stringify(data)}` },
        { status: 400 },
      );
    }

    const phoneNumbers = data.data as Array<Record<string, unknown>> | undefined;

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'কোনো WhatsApp Phone Number পাওয়া যায়নি। Meta Business Account-এ WhatsApp Number যুক্ত আছে কিনা দেখুন।' },
        { status: 404 },
      );
    }

    const first = phoneNumbers[0];
    const phoneNumberId = String(first.id || '');
    const displayPhone = String(first.display_phone_number || '');
    const name = String(first.verified_name || '');

    // Auto-save the Phone Number ID to DB
    if (phoneNumberId) {
      await db.platformSetting.upsert({
        where: { key: 'wa_phone_number_id' },
        create: { key: 'wa_phone_number_id', value: phoneNumberId },
        update: { value: phoneNumberId },
      });

      try {
        const { clearWaSettingsCache } = await import('@/lib/whatsapp');
        clearWaSettingsCache();
      } catch {}
    }

    return NextResponse.json({
      success: true,
      phoneNumberId,
      displayPhone,
      name,
      totalFound: phoneNumbers.length,
    });
  } catch (err) {
    console.error('[WA DETECT ERROR]', err);
    return NextResponse.json(
      { error: 'Phone Number ID খুঁজতে সমস্যা: ' + String(err) },
      { status: 500 },
    );
  }
}
