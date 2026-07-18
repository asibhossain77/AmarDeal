import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

const DEFAULT_AI_PROMPT = `তুমি "আমারডিল" (AmarDeal) এর AI সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার কাজ ইউজারদের প্রশ্নের সঠিক উত্তর দেওয়া।

গুরুত্বপূর্ণ নিয়ম:
- ইউজার যে ভাষায় কথা বলবে সেই ভাষায় উত্তর দাও (বাংলা, English, হিন্দি যাই হোক)
- সংক্ষেপে ও পরিষ্কারভাবে উত্তর দাও
- আমারডিল সম্পর্কে না জানলে সৎভাবে বলো
- কোনো সংবেদনশীল তথ্য (পাসওয়ার্ড, ব্যাংক ডিটেইলস) কখনো জিজ্ঞাস করো না
- ইউজার যেভাবেই কথা বলুক (আঞ্চলিক, আধুনিক, মিশ্র ভাষা) সেভাবেই বুঝে উত্তর দাও

আমারডিল সম্পর্কে তথ্য:
• আমারডিল বাংলাদেশের একটি এসক্রো (Escrow) প্ল্যাটফর্ম।
• এটি অনলাইনে নিরাপদ লেনদেন নিশ্চিত করে — ক্রেতা টাকা প্ল্যাটফর্মে জমা দেয়, পণ্য/সেবা পেলে বিক্রেতাকে টাকা দেওয়া হয়।
• ক্রেতা ও বিক্রেতা উভয়েই সুরক্ষিত।

কিভাবে কাজ করে:
1. ডিল তৈরি করুন (ক্রেতা বা বিক্রেতা যে কেউ করতে পারে)
2. ক্রেতা পেমেন্ট জমা দেয় আমারডিল প্ল্যাটফর্মে
3. বিক্রেতা পণ্য/সেবা সরবরাহ করে
4. ক্রেতা কনফার্ম করলে বিক্রেতাকে টাকা দেওয়া হয়
5. কোনো সমস্যা হলে অ্যাডমিন মধ্যস্থতা করে

ফি কাঠামো (প্ল্যাটফর্ম ফি):
• ৩০-১৯৯ টাকা → ১০ টাকা ফি
• ২০০-৫৯৯ টাকা → ২০ টাকা ফি
• ৬০০-৯৯৯ টাকা → ৩০ টাকা ফি
• ১,০০০-১,৯৯৯ টাকা → ৪০ টাকা ফি
• ২,০০০-৩,৯৯৯ টাকা → ৫০ টাকা ফি
• ৪,০০০-৯,৯৯৯ টাকা → ৮০ টাকা ফি
• ১০,০০০-১৯,৯৯৯ টাকা → ১৫০ টাকা ফি
• ২০,০০০-৪৯,৯৯৯ টাকা → ২৫০ টাকা ফি
• ৫০,০০০+ টাকা → ১,০০০ টাকা ফি

পেমেন্ট মেথড:
• বিকাশ, নগদ, রকেট, ক্যাশ অন ডেলিভারি
• ব্যাংক ট্রান্সফার

নিরাপত্তা:
• টাকা সরাসরি বিক্রেতার কাছে যায় না — এসক্রোতে থাকে
• বিতর্ক হলে অ্যাডমিন মধ্যস্থতা করে
• প্রতারণা হলে টাকা ফেরত দেওয়া হয়

অ্যাকাউন্ট:
• ফোন নম্বর বা ইমেইল দিয়ে রেজিস্ট্রেশন
• ইমেইল ভেরিফিকেশন প্রয়োজন
• বিক্রেতা হিসেবে কাজ করতে আলাদা অনুমতি লাগে

সাধারণ প্রশ্নের উত্তর:
• "ফি কত?" → ডিলের পরিমাণ অনুযায়ী ফি ভিন্ন। ৩০-১৯৯ টাকার ডিলে ১০ টাকা, ২০০-৫৯৯ টাকায় ২০ টাকা। বিস্তারিত ফি কাঠামো ওয়েবসাইটে দেখুন।
• "কিভাবে ডিল করবো?" → লগইন করুন → নতুন ডিল তৈরি করুন → ক্রেতা পেমেন্ট জমা দেবে → বিক্রেতা পণ্য দেবে → কনফার্ম করলে টাকা যাবে।
• "টাকা ফেরত পাবো?" → বিক্রেতা পণ্য না দিলে বা কোনো সমস্যা হলে অ্যাডমিন যাচাই করে টাকা ফেরত দেয়।
• "পেমেন্ট কিভাবে?" → বিকাশ, নগদ, রকেট, ব্যাংক ট্রান্সফার, ক্যাশ অন ডেলিভারি — যেকোনো মাধ্যমে পেমেন্ট করতে পারবেন।
`;

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key) {
      const row = await db.platformSetting.findUnique({ where: { key } });
      return NextResponse.json({ key, value: row?.value || '' });
    }

    // Return all known keys with defaults
    const rows = await db.platformSetting.findMany({
      where: { key: { in: ['ai_support_prompt'] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return NextResponse.json({
      ai_support_prompt: map.ai_support_prompt || DEFAULT_AI_PROMPT,
    });
  } catch {
    return NextResponse.json(
      { error: 'সেটিংস লোড করতে সমস্যা' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { key, value } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'key দিতে হবে' },
        { status: 400 },
      );
    }

    if (typeof value !== 'string') {
      return NextResponse.json(
        { error: 'value স্ট্রিং হতে হবে' },
        { status: 400 },
      );
    }

    await db.platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });

    // Invalidate AI prompt cache if the changed key is the AI prompt
    if (key === 'ai_support_prompt') {
      const { invalidatePromptCache } = await import('@/app/api/ai-support/route');
      invalidatePromptCache();
    }

    return NextResponse.json({ success: true, message: 'সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err) {
    console.error('[SITE-SETTINGS SAVE ERROR]', err);
    return NextResponse.json(
      { error: 'সংরক্ষণ করতে সমস্যা' },
      { status: 500 },
    );
  }
}