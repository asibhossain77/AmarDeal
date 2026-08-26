/* ═══════════════════════════════════════════════════════════════
   WhatsApp Cloud API Notification System — মিডম্যান
   Same pattern as email.ts: PlatformSetting DB values,
   in-memory cache with 5min TTL, fire-and-forget batch.
   ═══════════════════════════════════════════════════════════════ */

/* ── DEFAULTS — overridden by PlatformSetting DB values ── */
const DEFAULTS = {
  wa_phone_number_id:   '',
  wa_access_token:      '',
  wa_template_namespace: '',
} as const;

const WA_SETTING_KEYS = Object.keys(DEFAULTS);

type WaSettings = Record<string, string>;

/* In-memory cache */
let _settingsCache: WaSettings | null = null;
let _settingsLoadedAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000; // 5 min

/** Load WhatsApp settings from DB (call before sending) */
export async function loadWaSettings(): Promise<WaSettings> {
  const now = Date.now();
  if (_settingsCache && now - _settingsLoadedAt < SETTINGS_TTL) return _settingsCache;
  try {
    const { db } = await import('@/lib/db');
    const rows = await db.platformSetting.findMany({
      where: { key: { in: WA_SETTING_KEYS } },
    });
    const overrides: WaSettings = {};
    for (const r of rows) overrides[r.key] = r.value;
    _settingsCache = { ...DEFAULTS, ...overrides };
    _settingsLoadedAt = now;
  } catch (e) {
    console.error('[WA SETTINGS] DB load failed, using defaults', e);
    _settingsCache = { ...DEFAULTS };
    _settingsLoadedAt = now;
  }
  return _settingsCache;
}

/** Force clear cache (after admin update) */
export function clearWaSettingsCache() {
  _settingsCache = null;
  _settingsLoadedAt = 0;
}

/** Sync getter — only call after loadWaSettings() */
function s(key: string): string {
  return _settingsCache?.[key] ?? (DEFAULTS as Record<string, string>)[key] ?? '';
}

/* ── Disabled-template cache (mirrors email.ts pattern) ── */
let _disabledTemplates: Set<string> | null = null;
let _disabledLoadedAt = 0;
const DISABLED_TTL = 2 * 60 * 1000;

async function loadDisabledTemplates(): Promise<Set<string>> {
  const now = Date.now();
  if (_disabledTemplates && now - _disabledLoadedAt < DISABLED_TTL) return _disabledTemplates;
  try {
    const { db } = await import('@/lib/db');
    const rows = await db.platformSetting.findMany({
      where: { key: { startsWith: 'wa_off_' } },
    });
    _disabledTemplates = new Set(rows.map((r) => r.key.replace('wa_off_', '')));
  } catch {
    _disabledTemplates = new Set();
  }
  _disabledLoadedAt = now;
  return _disabledTemplates;
}

/** Clear disabled templates cache */
export function clearWaDisabledTemplatesCache() {
  _disabledTemplates = null;
  _disabledLoadedAt = 0;
}

/** Check if a template type is enabled */
export async function isWaTemplateEnabled(type: string): Promise<boolean> {
  const disabled = await loadDisabledTemplates();
  return !disabled.has(type);
}

/* ═══════════════════════════════════════════════════════════════
   PHONE NUMBER FORMATTING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Convert a Bangladeshi phone number to WhatsApp format.
 * Accepts: "01712345678", "+8801712345678", "8801712345678", "1712345678"
 * Returns: "8801712345678"
 */
export function formatWaPhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('880') && digits.length === 13) return digits;
  if (digits.startsWith('+880')) return digits.slice(1);
  if (digits.startsWith('01') && digits.length === 11) return '880' + digits;
  if (digits.length === 10) return '880' + digits;
  return digits;
}

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP MESSAGE TEMPLATES (Bangla text messages)
   Each returns a string ready to be sent.
   ═══════════════════════════════════════════════════════════════ */

export function dealCreatedWa(toName: string, dealTitle: string, amount: number, creatorName: string, role: string): string {
  const roleBn = role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা';
  return `🔔 *নতুন ডিল অনুরোধ*

প্রিয় ${toName},

${creatorName} আপনাকে *${roleBn}* হিসেবে একটি নতুন ডিল পাঠিয়েছেন।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
👤 আপনার ভূমিকা: ${roleBn}

ড্যাশবোর্ডে লগইন করে ডিলটি গ্রহণ বা বাতিল করুন।`;
}

export function dealAcceptedWa(toName: string, dealTitle: string, amount: number, sellerName: string): string {
  return `✅ *ডিল গ্রহণ করা হয়েছে*

প্রিয় ${toName},

${sellerName} আপনার ডিলটি গ্রহণ করেছেন। এখন পেমেন্ট করুন।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}

ড্যাশবোর্ডে গিয়ে পেমেন্ট জমা দিন। টাকা এসক্রোতে সুরক্ষিত থাকবে।`;
}

export function paymentSubmittedWa(toName: string, dealTitle: string, amount: number): string {
  return `💳 *পেমেন্ট জমা হয়েছে*

প্রিয় ${toName},

"${dealTitle}" ডিলে পেমেন্ট সফলভাবে জমা হয়েছে।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}

⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত ১-২ ঘন্টার মধ্যে ভেরিফাই হয়।`;
}

export function paymentVerifiedWa(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller'): string {
  const isBuyer = role === 'buyer';
  const extra = isBuyer
    ? 'বিক্রেতা এখন পণ্য/সেবা ডেলিভারি দেবেন। ডেলিভারি পেলে কনফার্ম করুন।'
    : 'আপনার কাজ শুরু করুন! কাজ শেষে ডেলিভারি বাটনে ক্লিক করুন।';
  return `✅ *পেমেন্ট ভেরিফাইড*

প্রিয় ${toName},

"${dealTitle}" ডিলের পেমেন্ট অ্যাডমিন কর্তৃক ভেরিফাইড হয়েছে।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
📌 অবস্থা: ভেরিফাইড

${extra}`;
}

export function deliveryStartedWa(toName: string, dealTitle: string, amount: number, sellerName: string): string {
  return `📦 *ডেলিভারি শুরু হয়েছে*

প্রিয় ${toName},

${sellerName} "${dealTitle}" ডিলের কাজ সম্পন্ন করেছেন।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
👤 বিক্রেতা: ${sellerName}

দয়া করে পণ্য/সেবা যাচাই করুন এবং কনফার্ম করুন। কোনো সমস্যা হলে বিরোধ দায়ের করুন।`;
}

export function dealCompletedWa(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller'): string {
  const isSeller = role === 'seller';
  const extra = isSeller
    ? 'পেআউট রিকোয়েস্ট করুন — টাকা শীঘ্রই আপনার অ্যাকাউন্টে পৌঁছে যাবে।'
    : 'ধন্যবাদ যে মিডম্যান ব্যবহার করেছেন। আপনার সম্পূর্ণ লেনদেন নিরাপদ ছিল!';
  return `🎉 *ডিল সফলভাবে সম্পন্ন*

প্রিয় ${toName},

*লেনদেন নিরাপদে সম্পন্ন হয়েছে!*

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
📌 অবস্থা: সম্পন্ন

${extra}`;
}

export function dealCancelledWa(toName: string, dealTitle: string, cancelledByName: string): string {
  return `❌ *ডিল বাতিল*

প্রিয় ${toName},

${cancelledByName} "${dealTitle}" ডিলটি বাতিল করেছেন।

⚠️ এই ডিল আর সক্রিয় নেই।

নতুন ডিল তৈরি করতে ড্যাশবোর্ডে যান।`;
}

export function dealRejectedWa(toName: string, dealTitle: string): string {
  return `❌ *ডিল প্রত্যাখ্যাত*

প্রিয় ${toName},

অ্যাডমিন "${dealTitle}" ডিলের পেমেন্ট প্রত্যাখ্যাত করেছেন।

⚠️ এই ডিল আর সক্রিয় নেই।`;
}

export function disputeRaisedWa(toName: string, dealTitle: string, buyerName: string, amount: number): string {
  return `⚠️ *ডিলে বিরোধ দায়ের*

প্রিয় ${toName},

${buyerName} "${dealTitle}" ডিলে বিরোধ দায়ের করেছেন। অ্যাডমিন এখন পর্যালোচনা করবেন।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
👤 ক্রেতা: ${buyerName}

অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবেন।`;
}

export function disputeResolvedWa(toName: string, dealTitle: string, action: 'complete' | 'refund_buyer'): string {
  const isComplete = action === 'complete';
  const decision = isComplete
    ? '✅ সিদ্ধান্ত: ডিল কমপ্লিট — বিক্রেতাকে পেমেন্ট দেওয়া হবে'
    : '↩️ সিদ্ধান্ত: ক্রেতাকে রিফান্ড — ক্রেতার টাকা ফেরত দেওয়া হবে';
  return `⚖️ *বিরোধ নিষ্পত্তি*

প্রিয় ${toName},

"${dealTitle}" ডিলে দায়ের করা বিরোধটি অ্যাডমিন কর্তৃক নিষ্পত্তি করা হয়েছে।

${decision}

বিরোধ সম্পর্কে কোনো প্রশ্ন থাকলে ড্যাশবোর্ড থেকে যোগাযোগ করুন।`;
}

export function payoutRequestedWa(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund'): string {
  const label = payoutType === 'seller_payout' ? 'পেআউট' : 'রিফান্ড';
  return `💵 *${label} অনুরোধ*

প্রিয় ${toName},

"${dealTitle}" ডিলের জন্য আপনার ${label} অনুরোধ গ্রহণ করা হয়েছে।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ৳${amount.toLocaleString('en')}
🏦 অ্যাকাউন্ট: ${accountType} — ${accountNumber}

⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত ১-২ ঘন্টার মধ্যে প্রক্রিয়া সম্পন্ন হয়।`;
}

export function payoutCompletedWa(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund'): string {
  const label = payoutType === 'seller_payout' ? 'পেআউট' : 'রিফান্ড';
  return `✅ *${label} সম্পন্ন*

প্রিয় ${toName},

"${dealTitle}" ডিলের ${label} সফলভাবে সম্পন্ন হয়েছে!

💰 ৳${amount.toLocaleString('en')} — আপনার অ্যাকাউন্টে পাঠানো হয়েছে
🏦 অ্যাকাউন্ট: ${accountType} — ${accountNumber}

অ্যাকাউন্টে টাকা পৌঁছাতে কিছুটা সময় লাগতে পারে। সমস্যা হলে আমাদের জানান।`;
}

export function adminNewDealWa(adminName: string, dealTitle: string, amount: string, creatorName: string, buyerName: string, sellerName: string): string {
  return `🔔 *নতুন ডিল তৈরি হয়েছে*

প্রিয় ${adminName},

প্ল্যাটফর্মে একটি নতুন ডিল তৈরি হয়েছে।

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ${amount}
👤 তৈরিকারক: ${creatorName}
👤 ক্রেতা: ${buyerName}
👤 বিক্রেতা: ${sellerName || 'অপেক্ষমান'}

ডিলটি পর্যালোচনা করুন এবং প্রয়োজনীয় ব্যবস্থা গ্রহণ করুন।`;
}

export function adminDisputeWa(adminName: string, dealTitle: string, amount: string, buyerName: string, sellerName: string): string {
  return `🚨 *নতুন বিরোধ দায়ের*

প্রিয় ${adminName},

প্ল্যাটফর্মে একটি নতুন বিরোধ দায়ের করা হয়েছে। *দ্রুত পর্যালোচনা প্রয়োজন।*

📋 ডিল: ${dealTitle}
💰 পরিমাণ: ${amount}
👤 ক্রেতা: ${buyerName}
👤 বিক্রেতা: ${sellerName}

⚠️ দ্রুত ব্যবস্থা নিন — উভয় পক্ষ অপেক্ষমান আছে।`;
}

/* ═══════════════════════════════════════════════════════════════
   SEND HELPERS
   ═══════════════════════════════════════════════════════════════ */

type WaPayload = { body: string };
type WaInput = WaPayload | (() => WaPayload);

/** Resolve WA input — if it's a function, call it AFTER settings are loaded */
function resolvePayload(input: WaInput): WaPayload {
  return typeof input === 'function' ? input() : input;
}

/**
 * Send a WhatsApp template message to a single phone number.
 * Uses WhatsApp Cloud API text messages (not pre-approved templates).
 *
 * @param to - Recipient phone (Bangladeshi format like "01712345678")
 * @param input - Message payload (string or function returning it)
 * @param templateType - Type key for disable-check (e.g. 'deal_created')
 */
export async function sendWhatsApp(to: string, input: WaInput, templateType?: string): Promise<void> {
  // Check if template is disabled
  if (templateType) {
    const enabled = await isWaTemplateEnabled(templateType);
    if (!enabled) {
      console.log(`[WA SKIPPED] Template disabled: ${templateType}`);
      return;
    }
  }

  const settings = await loadWaSettings();
  const phoneNumberId = s('wa_phone_number_id') || process.env.WA_PHONE_NUMBER_ID;
  const accessToken = s('wa_access_token') || process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('[WA SKIP] wa_phone_number_id or wa_access_token not configured');
    return;
  }

  const payload = resolvePayload(input);
  const recipientPhone = formatWaPhone(to);

  if (!recipientPhone || recipientPhone.length < 10) {
    console.error(`[WA ERROR] Invalid phone number: ${to}`);
    return;
  }

  const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: {
      body: payload.body,
      preview_url: false,
    },
  });

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      console.error(`[WA ERROR] ${res.status}:`, JSON.stringify(data));
      return;
    }

    console.log(`[WA SENT] → ${recipientPhone} (${templateType || 'custom'})`);
  } catch (err) {
    console.error(`[WA ERROR] → ${recipientPhone}:`, err);
  }
}

/**
 * Batch fire-and-forget — mirrors fireEmails() pattern.
 * Sends each WhatsApp message without awaiting.
 */
export function fireWhatsApps(messages: Array<{ to: string; payload: WaInput; type?: string }>) {
  for (const m of messages) {
    sendWhatsApp(m.to, m.payload, m.type).catch((err) => {
      console.error(`[WA ERROR] → ${m.to}:`, err);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN BROADCAST
   ═══════════════════════════════════════════════════════════════ */

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ phone: string; error: string }>;
}

/**
 * Send a WhatsApp broadcast message to all users (or a subset).
 *
 * @param messageText - The message body to send
 * @param options - Optional filters
 * @returns Result summary
 */
export async function sendWhatsAppBroadcast(
  messageText: string,
  options?: {
    userIds?: string[];   // If provided, only send to these users
    limit?: number;       // Max number of recipients (default 500)
  },
): Promise<BroadcastResult> {
  const settings = await loadWaSettings();
  const phoneNumberId = s('wa_phone_number_id') || process.env.WA_PHONE_NUMBER_ID;
  const accessToken = s('wa_access_token') || process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp কনফিগারেশন সম্পূর্ণ নয়। Phone Number ID এবং Access Token সেট করুন।');
  }

  const limit = options?.limit ?? 500;

  // Fetch users
  const { db } = await import('@/lib/db');
  const users = await db.user.findMany({
    where: {
      ...(options?.userIds ? { id: { in: options.userIds } } : {}),
      isActive: true,
    },
    select: { id: true, phone: true, name: true },
    take: limit,
  });

  const result: BroadcastResult = { total: users.length, sent: 0, failed: 0, errors: [] };
  const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  // Send sequentially with a small delay to avoid rate limits
  for (const user of users) {
    if (!user.phone) {
      result.failed++;
      result.errors.push({ phone: user.phone || user.id, error: 'No phone number' });
      continue;
    }

    const recipientPhone = formatWaPhone(user.phone);
    if (!recipientPhone || recipientPhone.length < 10) {
      result.failed++;
      result.errors.push({ phone: user.phone, error: 'Invalid phone format' });
      continue;
    }

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: {
        body: messageText,
        preview_url: false,
      },
    });

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (res.ok) {
        result.sent++;
      } else {
        const data = await res.json() as Record<string, unknown>;
        result.failed++;
        result.errors.push({ phone: user.phone, error: JSON.stringify(data) });
      }
    } catch (err) {
      result.failed++;
      result.errors.push({ phone: user.phone, error: String(err) });
    }
  }

  console.log(`[WA BROADCAST] Sent: ${result.sent}/${result.total}, Failed: ${result.failed}`);
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN TEST MESSAGE
   ═══════════════════════════════════════════════════════════════ */

/** Send a test WhatsApp message to a specific phone number */
export async function sendTestWhatsApp(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  const settings = await loadWaSettings();
  const phoneNumberId = s('wa_phone_number_id') || process.env.WA_PHONE_NUMBER_ID;
  const accessToken = s('wa_access_token') || process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp কনফিগারেশন সম্পূর্ণ নয়' };
  }

  const recipientPhone = formatWaPhone(to);
  if (!recipientPhone || recipientPhone.length < 10) {
    return { success: false, error: 'ফোন নম্বর সঠিক নয়' };
  }

  const apiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'text',
    text: {
      body: message,
      preview_url: false,
    },
  });

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (res.ok) {
      return { success: true };
    }

    const data = await res.json() as Record<string, unknown>;
    return { success: false, error: JSON.stringify(data) };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
