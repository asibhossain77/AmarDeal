import nodemailer from 'nodemailer';

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS — overridden by PlatformSetting DB values
   ═══════════════════════════════════════════════════════════════ */
const DEFAULTS = {
  email_site_name:         'মিডম্যান',
  email_from_name:         'মিডম্যান',
  email_site_url:          'https://midman.bd',
  email_header_subtitle:   'নিরাপদ অনলাইন লেনদেনের বিশ্বস্ত প্ল্যাটফর্ম',
  email_footer_tagline:    'নিরাপদে কিনুন, নিরাপদে বিক্রি করুন',
  email_footer_year:       '',  // empty = auto (current year)
  email_footer_copyright:  'সর্বস্বত্ব সংরক্ষিত',
  email_footer_notice:     'এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে',
  brevo_smtp_key:          '',
  brevo_smtp_user:         '',
  brevo_from_email:        '',
} as const;

const EMAIL_SETTING_KEYS = Object.keys(DEFAULTS);

type EmailSettings = Record<string, string>;

/* In-memory cache */
let _settingsCache: EmailSettings | null = null;
let _settingsLoadedAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000; // 5 min

/** Load email settings from DB (call before sending) */
export async function loadEmailSettings(): Promise<EmailSettings> {
  const now = Date.now();
  if (_settingsCache && now - _settingsLoadedAt < SETTINGS_TTL) return _settingsCache;
  try {
    const { db } = await import('@/lib/db');
    const rows = await db.platformSetting.findMany({
      where: { key: { in: EMAIL_SETTING_KEYS } },
    });
    const overrides: EmailSettings = {};
    for (const r of rows) overrides[r.key] = r.value;
    _settingsCache = { ...DEFAULTS, ...overrides };
    _settingsLoadedAt = now;
  } catch (e) {
    console.error('[EMAIL SETTINGS] DB load failed, using defaults', e);
    _settingsCache = { ...DEFAULTS };
    _settingsLoadedAt = now;
  }
  return _settingsCache;
}

/** Force clear cache (after admin update) */
export function clearEmailSettingsCache() {
  _settingsCache = null;
  _settingsLoadedAt = 0;
  _transporter = null;
}

/* YEAR is now dynamic — read from settings or auto-detect inside wrap() */

/** Sync getter — only call after loadEmailSettings() */
function s(key: string): string {
  return _settingsCache?.[key] ?? (DEFAULTS as Record<string, string>)[key] ?? '';
}

/* ── Brevo SMTP Transport (lazy init — uses DB overrides if set) ── */
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(settings?: EmailSettings): nodemailer.Transporter | null {
  const smtpKey = settings?.brevo_smtp_key || process.env.BREVO_SMTP_KEY;
  if (!smtpKey) return null;
  if (!_transporter) {
    const smtpUser = settings?.brevo_smtp_user || process.env.BREVO_SMTP_USER || '';
    _transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpKey },
    });
  }
  return _transporter;
}

function getFromAddress(settings?: EmailSettings): string {
  return settings?.brevo_from_email || process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER || 'noreply@midman.bd';
}

/* ═══════════════════════════════════════════════════════════════
   MINIMALIST EMAIL TEMPLATE SYSTEM — মিডম্যান
   Clean • No Gradients • No Decorative Borders • White Space
   ═══════════════════════════════════════════════════════════════ */

const primary  = '#65A30D';
const textDark = '#1a1a1a';
const textBody = '#444444';
const textMuted= '#888888';
const border   = '#e5e5e5';

const base = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{margin:0;padding:0;background:#f5f5f5;font-family:'Hind Siliguri',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
  a{text-decoration:none;color:${primary}}

  .wrapper{max-width:520px;margin:40px auto;background:#ffffff}

  /* ── Header ── */
  .header{text-align:center;padding:36px 32px 28px}
  .header-name{font-size:24px;font-weight:800;color:${primary};letter-spacing:-0.3px}
  .header-subtitle{font-size:12px;color:${textMuted};margin-top:6px;line-height:1.5}
  .header-divider{height:1px;background:#f0f0f0;margin:0 32px}

  /* ── Body ── */
  .body{padding:32px}
  .body h2{font-size:18px;font-weight:700;color:${textDark};margin-bottom:16px;line-height:1.4}
  .body .greeting{font-size:15px;color:${textDark};margin-bottom:20px;line-height:1.7}
  .body p{font-size:14px;color:${textBody};line-height:1.8;margin-bottom:16px}
  .body p:last-child{margin-bottom:0}

  /* ── Info Table ── */
  .info-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}
  .info-table tr{border-bottom:1px solid #f0f0f0}
  .info-table tr:last-child{border-bottom:none}
  .info-table td{padding:10px 0;vertical-align:top}
  .info-table .lbl{color:${textMuted};font-weight:400;width:40%;padding-right:12px}
  .info-table .val{color:${textDark};font-weight:600;text-align:right}

  /* ── OTP — Plain text, no boxes ── */
  .otp-section{text-align:center;margin:32px 0}
  .otp-label{font-size:15px;color:${textBody};margin-bottom:16px}
  .otp-code{font-size:56px;font-weight:900;color:${primary};letter-spacing:18px;font-family:'Courier New',monospace;line-height:1.3}
  .otp-hint{font-size:12px;color:${textMuted};margin-top:14px}

  /* ── Simple Alert ── */
  .alert{padding:14px 18px;border-radius:8px;margin:20px 0;font-size:13.5px;line-height:1.6}
  .alert-warn{background:#fefce8;border-left:3px solid #eab308;color:#854d0e}
  .alert-warn strong{font-weight:600}
  .alert-danger{background:#fef2f2;border-left:3px solid #ef4444;color:#991b1b}
  .alert-danger strong{font-weight:600}
  .alert-success{background:#f0fdf4;border-left:3px solid ${primary};color:#365314}
  .alert-success strong{font-weight:600}

  /* ── CTA Button ── */
  .btn-wrap{text-align:center;margin:28px 0 8px}
  .btn{display:inline-block;background:${primary};color:#ffffff !important;padding:13px 36px;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.2px}
  .btn:hover{opacity:0.9}

  /* ── Divider ── */
  .divider{height:1px;background:#f0f0f0;margin:24px 0}

  /* ── Footer ── */
  .footer{padding:24px 32px;text-align:center}
  .footer-powered{font-size:12px;color:${textMuted}}
  .footer-powered a{font-weight:600;color:${primary}}
  .footer-tagline{font-size:11.5px;color:${textBody};margin-top:6px;line-height:1.5}
  .footer-copy{font-size:11px;color:#bbbbbb;margin-top:10px;line-height:1.6}
  .footer-copy a{color:#bbbbbb}

  @media only screen and (max-width:520px){
    .wrapper{margin:0;border-radius:0}
    .header{padding:28px 24px 22px}
    .header-name{font-size:21px}
    .body{padding:24px}
    .otp-code{font-size:44px;letter-spacing:12px}
    .info-table .lbl,.info-table .val{display:block;width:100%;text-align:left}
    .info-table .lbl{padding-bottom:2px;font-size:12px}
    .info-table .val{padding-top:0}
    .footer{padding:20px 24px}
  }
`;

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="bn" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s('email_site_name')}</title><style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');${base}</style></head><body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:0">
  <tr><td align="center">
    <div class="wrapper">
      <div class="header">
        <span class="header-name">${s('email_site_name')}</span>
        ${s('email_header_subtitle') ? `<p class="header-subtitle">${s('email_header_subtitle')}</p>` : ''}
      </div>
      <div class="header-divider"></div>
      <div class="body">${bodyHtml}</div>
      <div class="header-divider"></div>
      <div class="footer">
        <div class="footer-powered">Powered by <a href="${s('email_site_url')}">${s('email_site_name')}</a></div>
        ${s('email_footer_tagline') ? `<p class="footer-tagline">${s('email_footer_tagline')}</p>` : ''}
        <div class="footer-copy">© ${s('email_footer_year') || String(new Date().getFullYear())} ${s('email_site_name')}${s('email_footer_copyright') ? '। ' + s('email_footer_copyright') : ''}।${s('email_footer_notice') ? '<br>' + s('email_footer_notice') + '।' : ''}</div>
      </div>
    </div>
  </td></tr>
</table></body></html>`;
}

/* ── Helpers ── */
function infoRow(label: string, value: string): string {
  return `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;
}
function infoTable(rows: string[]): string {
  return `<table class="info-table">${rows.join('')}</table>`;
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
   ═══════════════════════════════════════════════════════════════ */

export function dealCreatedEmail(toName: string, dealTitle: string, amount: number, creatorName: string, role: string) {
  return {
    subject: `নতুন ডিল অনুরোধ: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>নতুন ডিল অনুরোধ</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p><strong>${creatorName}</strong> আপনাকে <strong>${role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা'}</strong> হিসেবে একটি নতুন ডিল পাঠিয়েছেন:</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('পক্ষ', role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা'),
      ])}
      <p>আপনার ড্যাশবোর্ডে লগইন করে ডিলটি গ্রহণ বা বাতিল করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান</a></div>
    `),
  };
}

export function dealAcceptedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডিল গ্রহণ করা হয়েছে: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ডিল গ্রহণ করা হয়েছে</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p><strong>${sellerName}</strong> আপনার ডিলটি গ্রহণ করেছেন। এখন পেমেন্ট করুন:</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
      ])}
      <p>ড্যাশবোর্ডে গিয়ে পেমেন্ট জমা দিন। টাকা এসক্রোতে সুরক্ষিত থাকবে।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">পেমেন্ট করুন</a></div>
    `),
  };
}

export function paymentSubmittedEmail(toName: string, dealTitle: string, amount: number) {
  return {
    subject: `পেমেন্ট জমা হয়েছে: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>পেমেন্ট জমা হয়েছে</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>"${dealTitle}" ডিলে পেমেন্ট সফলভাবে জমা হয়েছে।</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
      ])}
      <div class="alert alert-warn"><p>অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত <strong>১-২ ঘন্টার</strong> মধ্যে ভেরিফাই হয়।</p></div>
    `),
  };
}

export function paymentVerifiedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isBuyer = role === 'buyer';
  return {
    subject: `পেমেন্ট ভেরিফাইড: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>পেমেন্ট ভেরিফাইড</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>"${dealTitle}" ডিলের পেমেন্ট অ্যাডমিন কর্তৃক ভেরিফাইড হয়েছে।</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('অবস্থা', 'ভেরিফাইড'),
      ])}
      ${isBuyer
        ? `<p>বিক্রেতা এখন পণ্য/সেবা ডেলিভারি দেবেন। ডেলিভারি পেলে কনফার্ম করুন।</p>`
        : `<p>আপনার কাজ শুরু করুন! কাজ শেষে ডেলিভারি বাটনে ক্লিক করুন।</p>
           <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ডেলিভারি কনফার্ম করুন</a></div>`
      }
    `),
  };
}

export function deliveryStartedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডেলিভারি শুরু: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ডেলিভারি শুরু হয়েছে</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p><strong>${sellerName}</strong> "${dealTitle}" ডিলের কাজ সম্পন্ন করেছেন।</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('বিক্রেতা', sellerName),
      ])}
      <p>দয়া করে পণ্য/সেবা যাচাই করুন এবং কনফার্ম করুন। কোনো সমস্যা হলে বিরোধ দায়ের করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ডেলিভারি কনফার্ম করুন</a></div>
    `),
  };
}

export function dealCompletedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isSeller = role === 'seller';
  return {
    subject: `ডিল সম্পন্ন: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ডিল সফলভাবে সম্পন্ন</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <div class="alert alert-success"><strong>লেনদেন নিরাপদে সম্পন্ন হয়েছে!</strong></div>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('অবস্থা', 'সম্পন্ন'),
      ])}
      ${isSeller
        ? `<p>পেআউট রিকোয়েস্ট করুন — টাকা শীঘ্রই আপনার অ্যাকাউন্টে পৌঁছে যাবে।</p>
           <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">পেআউট রিকোয়েস্ট করুন</a></div>`
        : `<p>ধন্যবাদ যে ${s('email_site_name')} ব্যবহার করেছেন। আপনার সম্পূর্ণ লেনদেন নিরাপদ ছিল!</p>`
      }
    `),
  };
}

export function dealCancelledEmail(toName: string, dealTitle: string, cancelledByName: string) {
  return {
    subject: `ডিল বাতিল: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ডিল বাতিল</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p><strong>${cancelledByName}</strong> "${dealTitle}" ডিলটি বাতিল করেছেন।</p>
      <div class="alert alert-danger"><strong>এই ডিল আর সক্রিয় নেই।</strong></div>
      <p>নতুন ডিল তৈরি করতে ড্যাশবোর্ডে যান।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">নতুন ডিল তৈরি করুন</a></div>
    `),
  };
}

export function disputeRaisedEmail(toName: string, dealTitle: string, buyerName: string, amount: number) {
  return {
    subject: `বিরোধ দায়ের: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ডিলে বিরোধ দায়ের</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p><strong>${buyerName}</strong> "${dealTitle}" ডিলে বিরোধ দায়ের করেছেন। অ্যাডমিন এখন পর্যালোচনা করবেন।</p>
      <div class="alert alert-danger">বিরোধিত পরিমাণ: <strong>৳${amount.toLocaleString('en')}</strong></div>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('ক্রেতা', buyerName),
      ])}
      <p>অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবেন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান</a></div>
    `),
  };
}

export function welcomeEmail(toName: string) {
  return {
    subject: `স্বাগতম ${s('email_site_name')} এ!`,
    html: wrap(`
      <h2>স্বাগতম, ${toName}!</h2>
      <p class="greeting">${s('email_site_name')} পরিবারে আপনাকে স্বাগত জানাই!</p>
      <div class="alert alert-success"><strong>আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে</strong></div>
      <div class="divider"></div>
      <p style="font-weight:600;color:${textDark};margin-bottom:12px">আপনি যা পাচ্ছেন:</p>
      ${infoTable([
        infoRow('এসক্রো সুরক্ষা', 'প্রতিটি লেনদেন নিরাপদ'),
        infoRow('দ্বৈত সুরক্ষা', 'ক্রেতা ও বিক্রেতা উভয়ের জন্য'),
        infoRow('দ্রুত পেআউট', 'ডিল সম্পন্নে দ্রুত পেমেন্ট'),
        infoRow('লাইভ চ্যাট', 'রিয়েল-টাইম যোগাযোগ'),
      ])}
      <p>এখনই আপনার প্রথম ডিল তৈরি করুন!</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">শুরু করুন</a></div>
    `),
  };
}

export function loginNotificationEmail(toName: string, loginTime: string, loginIp: string) {
  return {
    subject: `নতুন লগইন সনাক্ত — ${s('email_site_name')}`,
    html: wrap(`
      <h2>নতুন লগইন সনাক্ত</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>আপনার অ্যাকাউন্টে একটি নতুন লগইন সনাক্ত করা হয়েছে।</p>
      ${infoTable([
        infoRow('সময়', loginTime),
        infoRow('আইপি', loginIp),
      ])}
      <div class="alert alert-warn"><strong>যদি এটি আপনার করা না হয়, তবে দ্রুত পাসওয়ার্ড পরিবর্তন করুন।</strong></div>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান</a></div>
    `),
  };
}

export function payoutRequestedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSeller = payoutType === 'seller_payout';
  return {
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} অনুরোধ: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>${isSeller ? 'পেআউট অনুরোধ' : 'রিফান্ড অনুরোধ'}</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>"${dealTitle}" ডিলের জন্য আপনার ${isSeller ? 'পেআউট' : 'রিফান্ড'} অনুরোধ গ্রহণ করা হয়েছে।</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('en')}`),
        infoRow('অ্যাকাউন্ট', `${accountType} — ${accountNumber}`),
      ])}
      <div class="alert alert-warn">অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত <strong>১-২ ঘন্টার</strong> মধ্যে প্রক্রিয়া সম্পন্ন হয়।</div>
    `),
  };
}

export function payoutCompletedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSeller = payoutType === 'seller_payout';
  return {
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} সম্পন্ন: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>${isSeller ? 'পেআউট' : 'রিফান্ড'} সম্পন্ন</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>"${dealTitle}" ডিলের ${isSeller ? 'পেআউট' : 'রিফান্ড'} সফলভাবে সম্পন্ন হয়েছে!</p>
      <div class="alert alert-success">৳${amount.toLocaleString('en')} — আপনার অ্যাকাউন্টে পাঠানো হয়েছে</div>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('অ্যাকাউন্ট', `${accountType} — ${accountNumber}`),
      ])}
      <p>অ্যাকাউন্টে টাকা পৌঁছাতে কিছুটা সময় লাগতে পারে। সমস্যা হলে আমাদের জানান।</p>
    `),
  };
}

export function disputeResolvedEmail(toName: string, dealTitle: string, action: 'complete' | 'refund_buyer', adminNote?: string) {
  const isComplete = action === 'complete';
  return {
    subject: `বিরোধ নিষ্পত্তি: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>বিরোধ নিষ্পত্তি</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>"${dealTitle}" ডিলে দায়ের করা বিরোধটি অ্যাডমিন কর্তৃক নিষ্পত্তি করা হয়েছে।</p>
      ${isComplete
        ? `<div class="alert alert-success"><strong>সিদ্ধান্ত: ডিল কমপ্লিট — বিক্রেতাকে পেমেন্ট দেওয়া হবে</strong></div>`
        : `<div class="alert alert-warn"><strong>সিদ্ধান্ত: ক্রেতাকে রিফান্ড — ক্রেতার টাকা ফেরত দেওয়া হবে</strong></div>`
      }
      ${adminNote ? `<p style="font-size:13px;color:${textBody};margin-top:16px;padding:14px 18px;background:#f9fafb;border-radius:8px"><strong>অ্যাডমিন নোট:</strong> ${adminNote}</p>` : ''}
      <p>বিরোধ সম্পর্কে কোনো প্রশ্ন থাকলে ড্যাশবোর্ড থেকে যোগাযোগ করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান</a></div>
    `),
  };
}

export function adminNewDealEmail(adminName: string, dealTitle: string, amount: string, creatorName: string, buyerName: string, sellerName: string) {
  return {
    subject: `নতুন ডিল: "${dealTitle}" — অ্যাডমিন`,
    html: wrap(`
      <h2>নতুন ডিল তৈরি হয়েছে</h2>
      <p class="greeting">প্রিয় ${adminName},</p>
      <p>প্ল্যাটফর্মে একটি নতুন ডিল তৈরি হয়েছে।</p>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', amount),
        infoRow('তৈরিকারক', creatorName),
        infoRow('ক্রেতা', buyerName),
        infoRow('বিক্রেতা', sellerName || 'অপেক্ষমান'),
      ])}
      <p>ডিলটি পর্যালোচনা করুন এবং প্রয়োজনীয় ব্যবস্থা গ্রহণ করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">অ্যাডমিন প্যানেলে যান</a></div>
    `),
  };
}

export function adminDisputeEmail(adminName: string, dealTitle: string, amount: string, buyerName: string, sellerName: string) {
  return {
    subject: `নতুন বিরোধ: "${dealTitle}" — অ্যাডমিন`,
    html: wrap(`
      <h2>নতুন বিরোধ দায়ের</h2>
      <p class="greeting">প্রিয় ${adminName},</p>
      <p>প্ল্যাটফর্মে একটি নতুন বিরোধ দায়ের করা হয়েছে। <strong>দ্রুত পর্যালোচনা প্রয়োজন।</strong></p>
      <div class="alert alert-danger">ডিলের পরিমাণ: <strong>${amount}</strong></div>
      ${infoTable([
        infoRow('ডিল', dealTitle),
        infoRow('ক্রেতা', buyerName),
        infoRow('বিক্রেতা', sellerName),
      ])}
      <div class="alert alert-warn">দ্রুত ব্যবস্থা নিন — উভয় পক্ষ অপেক্ষমান আছে।</div>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">অ্যাডমিন প্যানেলে যান</a></div>
    `),
  };
}

/* ── OTP Emails — Plain text, no boxes ── */

export function passwordResetOtpEmail(toName: string, otp: string) {
  return {
    subject: `পাসওয়ার্ড রিসেট কোড — ${s('email_site_name')}`,
    html: wrap(`
      <h2>পাসওয়ার্ড রিসেট</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>আপনার অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের জন্য একটি ভেরিফিকেশন কোড পাঠানো হয়েছে।</p>
      <div class="otp-section">
        <p class="otp-label">আপনার ভেরিফিকেশন কোড:</p>
        <p class="otp-code">${otp}</p>
        <p class="otp-hint">কোডটি ৫ মিনিটের জন্য বৈধ</p>
      </div>
      <div class="alert alert-warn">কাউকে এই কোড <strong>শেয়ার করবেন না</strong>। ${s('email_site_name')} কখনো আপনাকে কোড জানতে চাইবে না।</div>
      <p>আপনি পাসওয়ার্ড রিসেট অনুরোধ করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

export function emailVerificationOtpEmail(toName: string, otp: string) {
  return {
    subject: `ইমেইল ভেরিফিকেশন কোড — ${s('email_site_name')}`,
    html: wrap(`
      <h2>ইমেইল ভেরিফিকেশন</h2>
      <p class="greeting">প্রিয় ${toName},</p>
      <p>আপনার <strong>${s('email_site_name')}</strong> অ্যাকাউন্ট যাচাই করতে নিচের কোডটি ব্যবহার করুন।</p>
      <div class="otp-section">
        <p class="otp-label">আপনার ভেরিফিকেশন কোড:</p>
        <p class="otp-code">${otp}</p>
        <p class="otp-hint">কোডটি ১০ মিনিটের জন্য বৈধ</p>
      </div>
      <div class="alert alert-warn">কাউকে এই কোড <strong>শেয়ার করবেন না</strong>।</div>
      <p>আপনি অ্যাকাউন্ট তৈরি করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

/* ═══════════════════════════════════════════════════════════════
   SEND HELPERS
   ═══════════════════════════════════════════════════════════════ */

type EmailPayload = { subject: string; html: string };
type EmailInput = EmailPayload | (() => EmailPayload);

/** Resolve email input — if it's a function, call it AFTER settings are loaded */
function resolvePayload(input: EmailInput): EmailPayload {
  return typeof input === 'function' ? input() : input;
}

export async function sendEmail(to: string, input: EmailInput): Promise<void> {
  const settings = await loadEmailSettings();
  const payload = resolvePayload(input);
  const transporter = getTransporter(settings);
  if (!transporter) throw new Error('BREVO_SMTP_KEY সেট করা নেই। .env ফাইলে বা অ্যাডমিন প্যানেলে যোগ করুন।');

  await transporter.sendMail({
    from: `${s('email_from_name')} <${getFromAddress(settings)}>`,
    to,
    subject: payload.subject,
    html: payload.html,
  });
  console.log(`[EMAIL SENT] → ${to}: ${payload.subject}`);
}

export function fireEmails(emails: Array<{ to: string; payload: EmailInput }>) {
  for (const e of emails) {
    sendEmail(e.to, e.payload).catch((err) => {
      console.error(`[EMAIL ERROR] → ${e.to}:`, err);
    });
  }
}