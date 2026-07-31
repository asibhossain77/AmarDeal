import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

const ALL_KEYS = [
  'email_site_name',
  'email_from_name',
  'email_site_url',
  'email_header_subtitle',
  'email_footer_tagline',
  'email_footer_year',
  'email_footer_copyright',
  'email_footer_notice',
  'brevo_smtp_key',
  'brevo_smtp_user',
  'brevo_from_email',
] as const;

const TEMPLATE_DEFAULTS: Record<string, string> = {
  email_site_name:         'মিডম্যান',
  email_from_name:         'মিডম্যান',
  email_site_url:          'https://midman.bd',
  email_header_subtitle:   'নিরাপদ অনলাইন লেনদেনের বিশ্বস্ত প্ল্যাটফর্ম',
  email_footer_tagline:    'নিরাপদে কিনুন, নিরাপদে বিক্রি করুন',
  email_footer_year:       '',
  email_footer_copyright:  'সর্বস্বত্ব সংরক্ষিত',
  email_footer_notice:     'এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে',
  brevo_smtp_key:          '',
  brevo_smtp_user:         '',
  brevo_from_email:        '',
};

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const rows = await db.platformSetting.findMany({
      where: { key: { in: [...ALL_KEYS] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const result: Record<string, string> = {};
    for (const k of ALL_KEYS) result[k] = map[k] || TEMPLATE_DEFAULTS[k] || '';

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'ইমেইল সেটিংস লোড করতে সমস্যা' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const body = await req.json();

    for (const key of ALL_KEYS) {
      if (body[key] !== undefined && typeof body[key] === 'string') {
        await db.platformSetting.upsert({
          where: { key },
          create: { key, value: body[key] },
          update: { value: body[key] },
        });
      }
    }

    // Clear in-memory cache so next email send picks up new values
    const { clearEmailSettingsCache } = await import('@/lib/email');
    clearEmailSettingsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[EMAIL TEMPLATE SETTINGS SAVE ERROR]', err);
    return NextResponse.json(
      { error: 'ইমেইল সেটিংস সেভ করতে সমস্যা' },
      { status: 500 },
    );
  }
}