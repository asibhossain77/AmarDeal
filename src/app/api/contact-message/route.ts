import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, loadEmailSettings } from '@/lib/email';

/* ── Simple in-memory rate limit: max 5 messages / 15 min / IP ── */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const _hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (_hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    _hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  _hits.set(ip, arr);
  // occasional cleanup
  if (_hits.size > 500) {
    for (const [k, v] of _hits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) _hits.delete(k);
    }
  }
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' },
        { status: 429 }
      );
    }

    let body: { name?: string; email?: string; subject?: string; message?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'অনুরোধটি সঠিক নয়' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'অনুগ্রহ করে আপনার নাম লিখুন', field: 'name' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'অনুগ্রহ করে সঠিক ইমেইল ঠিকানা দিন', field: 'email' }, { status: 400 });
    }
    if (subject.length < 3 || subject.length > 150) {
      return NextResponse.json({ error: 'বিষয় কমপক্ষে ৩ অক্ষরের হতে হবে', field: 'subject' }, { status: 400 });
    }
    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json({ error: 'বার্তা কমপক্ষে ১০ অক্ষরের হতে হবে', field: 'message' }, { status: 400 });
    }

    // Recipient: support email from ContactInfo, fallback to Brevo from-address
    const info = await db.contactInfo.findFirst();
    const settings = await loadEmailSettings();
    const recipient = info?.email || settings.brevo_from_email || '';

    if (!recipient) {
      console.error('[CONTACT MESSAGE] No recipient configured (ContactInfo.email / brevo_from_email)');
      return NextResponse.json(
        { error: 'বার্তা পাঠানো যায়নি। অনুগ্রহ করে সরাসরি ফোন বা WhatsApp করুন।' },
        { status: 503 }
      );
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 4px;font-size:18px;">নতুন যোগাযোগ বার্তা — Midman</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#666;">ওয়েবসাইটের যোগাযোগ ফর্ম থেকে পাঠানো হয়েছে</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;background:#f6f8f5;font-weight:bold;width:110px;">নাম</td><td style="padding:8px;">${esc(name)}</td></tr>
          <tr><td style="padding:8px;background:#f6f8f5;font-weight:bold;">ইমেইল</td><td style="padding:8px;">${esc(email)}</td></tr>
          <tr><td style="padding:8px;background:#f6f8f5;font-weight:bold;">বিষয়</td><td style="padding:8px;">${esc(subject)}</td></tr>
        </table>
        <div style="margin-top:16px;padding:14px;background:#fafafa;border:1px solid #eee;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</div>
      </div>`;

    await sendEmail(
      recipient,
      {
        subject: `[যোগাযোগ] ${subject} — ${name}`,
        html,
      }
    ).catch((err) => {
      console.error('[CONTACT MESSAGE] send failed:', err?.message || err);
      throw new Error('SEND_FAILED');
    });

    return NextResponse.json({
      success: true,
      message: 'আপনার বার্তা সফলভাবে পাঠানো হয়েছে! আমরা শিগগিরই যোগাযোগ করব।',
    });
  } catch (err) {
    console.error('[CONTACT MESSAGE] error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'বার্তা পাঠানো যায়নি। অনুগ্রহ করে সরাসরি ফোন বা WhatsApp করুন।' },
      { status: 503 }
    );
  }
}
