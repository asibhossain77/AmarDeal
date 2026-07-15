import nodemailer from 'nodemailer';

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS — overridden by PlatformSetting DB values
   ═══════════════════════════════════════════════════════════════ */
const DEFAULTS = {
  email_site_name:       'আমারডিল.বাংলা',
  email_from_name:       'আমারডিল.বাংলা',
  email_site_url:        'https://xn--94b8cubil3ej.xn--54b7fta0cc',
  email_header_subtitle: 'নিরাপদ অনলাইন লেনদেনের বিশ্বস্ত প্ল্যাটফর্ম',
  email_footer_tagline:  'নিরাপদে কিনুন, নিরাপদে বিক্রি করুন',
  brevo_smtp_key:        '',
  brevo_smtp_user:       '',
  brevo_from_email:      '',
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

/** Sync getter — must call loadEmailSettings() first */
function s(key: keyof typeof DEFAULTS): string {
  return _settingsCache?.[key] ?? DEFAULTS[key];
}

/** Force clear cache (after admin update) */
export function clearEmailSettingsCache() {
  _settingsCache = null;
  _settingsLoadedAt = 0;
  _transporter = null; // recreate with new creds
}

const YEAR = new Date().getFullYear();

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
  return settings?.brevo_from_email || process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER || 'noreply@amardeal.com';
}

/* ═══════════════════════════════════════════════════════════════
   MODERN EMAIL TEMPLATE SYSTEM — আমারডিল.বাংলা
   ═══════════════════════════════════════════════════════════════ */

/* Website-matched palette — Parrot/Lime Green #84CC16 */
const brandLime   = '#84CC16';
const brandDark   = '#365314';
const brandDeep   = '#1a2e05';
const brandLight  = '#F7FEE7';
const brandMint   = '#ECFCCB';
const brandGlow   = '#BEF264';
const brandLabel  = '#4D7C0F';
const brandRowLbl = '#65A30D';
const brandSuccTxt= '#3F6212';
const textDark    = '#0f172a';
const textMuted   = '#475569';
const borderColor = '#e2e8f0';

/* Reusable style blocks */
const reset = `*{margin:0;padding:0;box-sizing:border-box}body{margin:0;padding:0;background:#F2F4F7;font-family:'Segoe UI',system-ui,-apple-system,Tahoma,sans-serif;-webkit-font-smoothing:antialiased}`;
const base = `
  ${reset}
  img{border:none;outline:none;text-decoration:none}
  a{text-decoration:none;color:${brandLime}}

  /* ── Outer wrapper ── */
  .email-wrapper{max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.08),0 4px 16px rgba(132,204,22,0.06)}

  /* ── Header — premium gradient with mesh pattern ── */
  .header-bg{background:linear-gradient(135deg,#a3e635 0%,#84CC16 25%,#65A30D 60%,#4D7C0F 100%);padding:48px 36px 42px;text-align:center;position:relative;overflow:hidden}
  .header-bg::before{content:'';position:absolute;top:-60%;right:-20%;width:320px;height:320px;background:radial-gradient(circle,rgba(255,255,255,0.18) 0%,transparent 65%);border-radius:50%}
  .header-bg::after{content:'';position:absolute;bottom:-40%;left:-10%;width:240px;height:240px;background:radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 65%);border-radius:50%}
  .header-inner{position:relative;z-index:1}
  .header-title{color:#ffffff;font-size:30px;font-weight:900;letter-spacing:-0.6px;margin:0;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,0.15)}
  .header-sub{color:rgba(255,255,255,0.9);font-size:13.5px;margin-top:10px;font-weight:500;letter-spacing:0.4px}
  .header-border{height:4px;background:linear-gradient(90deg,${brandGlow},${brandLime} 30%,#ffffff 50%,${brandLime} 70%,${brandGlow})}

  /* ── Body ── */
  .body{padding:36px 34px 30px}
  .body h2{font-size:21px;font-weight:800;color:${textDark};margin-bottom:8px;line-height:1.35;letter-spacing:-0.2px}
  .body .greeting{font-size:15.5px;color:${textDark};margin-bottom:18px;line-height:1.7}
  .body .greeting strong{font-weight:700}
  .body p{font-size:14.5px;color:${textMuted};line-height:1.8;margin-bottom:14px}

  /* Info card — lime green with premium depth */
  .card{border-radius:16px;padding:20px 24px;margin:20px 0}
  .card-green{background:linear-gradient(160deg,#F7FEE7 0%,#ECFCCB 60%,#D9F99D 100%);border:1px solid #D9F99D;border-left:4px solid ${brandLime};box-shadow:0 2px 8px rgba(132,204,22,0.08),inset 0 1px 0 rgba(255,255,255,0.8)}
  .card-green .card-icon{font-size:12px;margin-bottom:12px;color:${brandLabel};font-weight:800;letter-spacing:1px;text-transform:uppercase}
  .card-green .card-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:13.5px;border-bottom:1px solid rgba(132,204,22,0.12)}
  .card-green .card-row:last-child{border-bottom:none}
  .card-green .card-row .lbl{color:${brandRowLbl};font-weight:600}
  .card-green .card-row .val{color:${brandDark};font-weight:800;font-size:14.5px}

  /* Success card — elevated feel */
  .card-success{background:linear-gradient(160deg,#F7FEE7 0%,#ECFCCB 100%);border:1px solid #D9F99D;text-align:center;padding:28px 24px;border-radius:18px;box-shadow:0 4px 20px rgba(132,204,22,0.12),inset 0 1px 0 rgba(255,255,255,0.8)}
  .card-success .check{font-size:36px;margin-bottom:10px}
  .card-success .msg{font-size:16px;color:${brandSuccTxt};font-weight:700;line-height:1.5}

  /* Warning card */
  .card-warn{background:linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:16px;padding:16px 22px;margin:18px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8)}
  .card-warn p{margin:0;font-size:13.5px;color:#92400e;line-height:1.65}
  .card-warn p strong{font-weight:700}

  /* Danger card */
  .card-danger{background:linear-gradient(160deg,#fef2f2 0%,#fecaca 100%);border:1px solid #fca5a5;border-left:4px solid #ef4444;border-radius:16px;padding:16px 22px;margin:18px 0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8)}
  .card-danger p{margin:0;font-size:13.5px;color:#991b1b;line-height:1.65}

  /* ══════════════════════════════════════════
     OTP CARD — Bold Premium Design
     ══════════════════════════════════════════ */
  .otp-card{
    background:linear-gradient(165deg,${brandDeep} 0%,#1a3a05 25%,${brandDark} 50%,#2d5016 75%,#3f6212 100%);
    border-radius:24px;
    padding:42px 36px 32px;
    text-align:center;
    margin:28px auto;
    max-width:420px;
    position:relative;
    box-shadow:0 12px 40px rgba(54,83,20,0.25),0 4px 12px rgba(0,0,0,0.1),inset 0 1px 0 rgba(255,255,255,0.1);
    overflow:hidden
  }
  .otp-card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:4px;
    background:linear-gradient(90deg,transparent,${brandGlow},${brandLime},${brandGlow},transparent)
  }
  .otp-card::after{
    content:'';position:absolute;bottom:-50%;right:-30%;width:300px;height:300px;
    background:radial-gradient(circle,rgba(132,204,22,0.15) 0%,transparent 65%);border-radius:50%
  }
  .otp-label{
    position:relative;z-index:1;
    font-size:11.5px;font-weight:800;
    color:${brandGlow};
    letter-spacing:3px;
    text-transform:uppercase;
    margin-bottom:24px;
    text-shadow:0 0 20px rgba(190,242,100,0.3)
  }
  .otp-digits{
    position:relative;z-index:1;
    display:inline-flex;gap:12px;direction:ltr
  }
  .otp-digits span{
    display:inline-flex;align-items:center;justify-content:center;
    width:60px;height:74px;
    background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
    border:2px solid rgba(190,242,100,0.5);
    border-bottom:4px solid ${brandLime};
    border-radius:14px;
    font-size:38px;font-weight:900;
    color:${brandDeep};
    font-family:'Courier New','SF Mono',monospace;
    box-shadow:0 4px 16px rgba(0,0,0,0.15),0 1px 3px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,1);
    letter-spacing:0
  }
  .otp-hint{
    position:relative;z-index:1;
    font-size:12.5px;color:rgba(190,242,100,0.85);
    margin-top:20px;line-height:1.5;font-weight:500
  }

  /* Legacy OTP fallback (plain text code) */
  .otp-code{font-size:38px;font-weight:900;letter-spacing:12px;color:${brandDark};font-family:'Courier New',monospace;line-height:1.2}

  /* CTA button — elevated glass effect */
  .btn-wrap{text-align:center;margin:28px 0 12px}
  .btn{display:inline-block;background:linear-gradient(145deg,#a3e635 0%,#84CC16 40%,#65A30D 100%);color:#ffffff !important;padding:15px 44px;border-radius:14px;font-weight:700;font-size:15px;letter-spacing:0.3px;box-shadow:0 6px 24px rgba(132,204,22,0.35),0 2px 4px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.25);transition:all 0.2s;border:1px solid rgba(255,255,255,0.15)}
  .btn:hover{box-shadow:0 8px 32px rgba(132,204,22,0.45);transform:translateY(-1px)}

  /* Divider — subtle gradient */
  .divider{height:1px;background:linear-gradient(to right,transparent,${borderColor} 30%,#cbd5e1 50%,${borderColor} 70%,transparent);margin:24px 0}

  /* Footer — refined */
  .footer{background:linear-gradient(to bottom,#f8fafc,#f1f5f9);border-top:1px solid ${borderColor};padding:32px 34px;text-align:center}
  .footer-brand{font-size:17px;font-weight:900;color:${brandDark};margin-bottom:4px;letter-spacing:-0.3px}
  .footer-tagline{font-size:12.5px;color:${textMuted};margin-bottom:16px;font-weight:500}
  .footer-links{display:inline-flex;gap:24px;margin-bottom:18px}
  .footer-links a{font-size:12.5px;color:#94a3b8;text-decoration:none;font-weight:600;border-bottom:1px solid transparent;transition:border-color 0.2s}
  .footer-links a:hover{color:${brandLime};border-bottom-color:${brandLime}}
  .footer-copy{font-size:11px;color:#cbd5e1;line-height:1.6}
  .footer-copy a{color:#94a3b8}
  .footer-social{display:inline-flex;gap:12px;margin-top:16px}
  .footer-social a{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:rgba(132,204,22,0.08);border-radius:10px;font-size:14px;text-decoration:none;border:1px solid rgba(132,204,22,0.06)}
  .footer-social a:hover{background:rgba(132,204,22,0.16)}

  @media only screen and (max-width:520px){
    .email-wrapper{border-radius:0;margin:0}
    .body{padding:28px 22px 22px}
    .header-bg{padding:36px 22px 32px}
    .header-title{font-size:26px}
    .otp-digits span{width:48px;height:60px;font-size:30px;border-radius:12px}
    .otp-digits{gap:8px}
    .otp-card{max-width:340px;padding:32px 24px 26px;border-radius:20px}
    .otp-code{font-size:30px;letter-spacing:7px}
    .btn{padding:13px 30px;font-size:14px}
    .card-green .card-row{flex-direction:column;align-items:flex-start;gap:3px}
    .footer{padding:24px 22px}
  }
`;

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="bn" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s('email_site_name')}</title><style>${base}</style></head><body style="background:#F2F4F7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:28px 0">
  <tr><td align="center">
    <div class="email-wrapper">
      <div class="header-bg">
        <div class="header-inner">
          <div class="header-title">${s('email_site_name')}</div>
          <div class="header-sub">${s('email_header_subtitle')}</div>
        </div>
      </div>
      <div class="header-border"></div>
      <div class="body">${bodyHtml}</div>
      <div class="footer">
        <div class="footer-brand">${s('email_site_name')}</div>
        <div class="footer-tagline">${s('email_footer_tagline')}</div>
        <div class="footer-links">
          <a href="${s('email_site_url')}">ওয়েবসাইট</a>
          <a href="${s('email_site_url')}">সাহায্য কেন্দ্র</a>
          <a href="${s('email_site_url')}">যোগাযোগ</a>
        </div>
        <div class="footer-social">
          <a href="${s('email_site_url')}" title="ফেসবুক">📘</a>
          <a href="${s('email_site_url')}" title="গ্রুপ">👥</a>
          <a href="${s('email_site_url')}" title="ওয়েবসাইট">🌐</a>
        </div>
        <div class="footer-copy">© ${YEAR} ${s('email_site_name')}। সর্বস্বত্ব সংরক্ষিত।<br>এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</div>
      </div>
    </div>
  </td></tr>
</table></body></html>`;
}

/* ── Helper: info card rows ── */
function infoRow(label: string, value: string): string {
  return `<div class="card-row"><span class="lbl">${label}</span><span class="val">${value}</span></div>`;
}

function infoCard(title: string, rows: string[]): string {
  return `<div class="card card-green"><div class="card-icon">${title}</div>${rows.join('')}</div>`;
}

/* ═══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
   ═══════════════════════════════════════════════════════════════ */

export function dealCreatedEmail(toName: string, dealTitle: string, amount: number, creatorName: string, role: string) {
  return {
    subject: `নতুন ডিল অনুরোধ: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>📌 নতুন ডিল অনুরোধ</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${creatorName}</strong> আপনাকে <strong>${role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা'}</strong> হিসেবে একটি নতুন ডিল পাঠিয়েছেন:</p>
      ${infoCard('ডিলের বিবরণ', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('পক্ষ', role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা'),
      ])}
      <p>আপনার ড্যাশবোর্ডে লগইন করে ডিলটি গ্রহণ বা বাতিল করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function dealAcceptedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডিল গ্রহণ করা হয়েছে: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>✅ ডিল গ্রহণ করা হয়েছে</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${sellerName}</strong> আপনার ডিলটি গ্রহণ করেছেন। এখন পেমেন্ট করুন:</p>
      ${infoCard('ডিলের তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
      ])}
      <p>ড্যাশবোর্ডে গিয়ে পেমেন্ট জমা দিন। টাকা এসক্রোতে সুরক্ষিত থাকবে।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">পেমেন্ট করুন →</a></div>
    `),
  };
}

export function paymentSubmittedEmail(toName: string, dealTitle: string, amount: number) {
  return {
    subject: `পেমেন্ট জমা হয়েছে: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>💰 পেমেন্ট জমা হয়েছে</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলে পেমেন্ট সফলভাবে জমা হয়েছে।</p>
      ${infoCard('পেমেন্ট তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
      ])}
      <div class="card card-warn"><p>⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত <strong>১-২ ঘন্টার</strong> মধ্যে ভেরিফাই হয়।</p></div>
    `),
  };
}

export function paymentVerifiedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isBuyer = role === 'buyer';
  return {
    subject: `পেমেন্ট ভেরিফাইড: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>✅ পেমেন্ট ভেরিফাইড</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলের পেমেন্ট অ্যাডমিন কর্তৃক ভেরিফাইড হয়েছে।</p>
      ${infoCard('পেমেন্ট তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('অবস্থা', '✅ ভেরিফাইড'),
      ])}
      ${isBuyer
        ? `<p>বিক্রেতা এখন পণ্য/সেবা ডেলিভারি দেবেন। ডেলিভারি পেলে কনফার্ম করুন।</p>`
        : `<p>আপনার কাজ শুরু করুন! কাজ শেষে ডেলিভারি বাটনে ক্লিক করুন।</p>
           <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ডেলিভারি কনফার্ম করুন →</a></div>`
      }
    `),
  };
}

export function deliveryStartedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডেলিভারি শুরু: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>📦 ডেলিভারি শুরু হয়েছে</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${sellerName}</strong> "${dealTitle}" ডিলের কাজ সম্পন্ন করেছেন।</p>
      ${infoCard('ডিলের তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('বিক্রেতা', sellerName),
      ])}
      <p>দয়া করে পণ্য/সেবা যাচাই করুন এবং কনফার্ম করুন। কোনো সমস্যা হলে বিরোধ দায়ের করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ডেলিভারি কনফার্ম করুন →</a></div>
    `),
  };
}

export function dealCompletedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isSeller = role === 'seller';
  return {
    subject: `ডিল সম্পন্ন: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>🎉 ডিল সফলভাবে সম্পন্ন</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <div class="card card-success">
        <div class="check">🏆</div>
        <div class="msg">লেনদেন নিরাপদে সম্পন্ন হয়েছে!</div>
      </div>
      ${infoCard('সারাংশ', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('অবস্থা', '✅ সম্পন্ন'),
      ])}
      ${isSeller
        ? `<p>পেআউট রিকোয়েস্ট করুন — টাকা শীঘ্রই আপনার অ্যাকাউন্টে পৌঁছে যাবে।</p>
           <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">পেআউট রিকোয়েস্ট করুন →</a></div>`
        : `<p>ধন্যবাদ যে ${s('email_site_name')} ব্যবহার করেছেন। আপনার সম্পূর্ণ লেনদেন নিরাপদ ছিল!</p>`
      }
    `),
  };
}

export function dealCancelledEmail(toName: string, dealTitle: string, cancelledByName: string) {
  return {
    subject: `ডিল বাতিল: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>❌ ডিল বাতিল</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${cancelledByName}</strong> "${dealTitle}" ডিলটি বাতিল করেছেন।</p>
      <div class="card card-danger"><p>⚠️ এই ডিল আর সক্রিয় নেই।</p></div>
      <p>নতুন ডিল তৈরি করতে ড্যাশবোর্ডে যান।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">নতুন ডিল তৈরি করুন →</a></div>
    `),
  };
}

export function disputeRaisedEmail(toName: string, dealTitle: string, buyerName: string, amount: number) {
  return {
    subject: `⚠️ বিরোধ দায়ের: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>⚠️ ডিলে বিরোধ দায়ের</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${buyerName}</strong> "${dealTitle}" ডিলে বিরোধ দায়ের করেছেন। অ্যাডমিন এখন পর্যালোচনা করবেন।</p>
      <div class="card card-danger"><p>⚡ বিরোধিত পরিমাণ: <strong>৳${amount.toLocaleString('bn-BD')}</strong></p></div>
      ${infoCard('ডিলের তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('ক্রেতা', buyerName),
      ])}
      <p>অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবেন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function welcomeEmail(toName: string) {
  return {
    subject: `স্বাগতম ${s('email_site_name')} এ! 🎉`,
    html: wrap(`
      <h2>🎊 স্বাগতম, ${toName}!</h2>
      <p class="greeting">${s('email_site_name')} পরিবারে আপনাকে স্বাগত জানাই!</p>
      <div class="card card-success">
        <div class="check">✅</div>
        <div class="msg">আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে</div>
      </div>
      <div class="divider"></div>
      <p style="font-weight:600;color:${textDark};font-size:14px;margin-bottom:12px">আপনি যা পাচ্ছেন:</p>
      ${infoCard('বিশেষ সুবিধা', [
        infoRow('🛡️ এসক্রো সুরক্ষা', 'প্রতিটি লেনদেন নিরাপদ'),
        infoRow('🔒 দ্বৈত সুরক্ষা', 'ক্রেতা ও বিক্রেতা উভয়ের জন্য'),
        infoRow('⚡ দ্রুত পেআউট', 'ডিল সম্পন্নে দ্রুত পেমেন্ট'),
        infoRow('💬 লাইভ চ্যাট', 'রিয়েল-টাইম যোগাযোগ'),
      ])}
      <p>এখনই আপনার প্রথম ডিল তৈরি করুন!</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">শুরু করুন →</a></div>
    `),
  };
}

export function loginNotificationEmail(toName: string, loginTime: string, loginIp: string) {
  return {
    subject: `🔐 নতুন লগইন সনাক্ত — ${s('email_site_name')}`,
    html: wrap(`
      <h2>🔐 নতুন লগইন সনাক্ত</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টে একটি নতুন লগইন সনাক্ত করা হয়েছে।</p>
      ${infoCard('লগইন তথ্য', [
        infoRow('🕐 সময়', loginTime),
        infoRow('🌐 আইপি', loginIp),
      ])}
      <div class="card card-warn"><p>⚠️ যদি এটি আপনার করা না হয়, তবে দ্রুত পাসওয়ার্ড পরিবর্তন করুন।</p></div>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function payoutRequestedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSeller = payoutType === 'seller_payout';
  const title = isSeller ? '💰 পেআউট অনুরোধ' : '🔄 রিফান্ড অনুরোধ';
  return {
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} অনুরোধ: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>${title}</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলের জন্য আপনার ${isSeller ? 'পেআউট' : 'রিফান্ড'} অনুরোধ গ্রহণ করা হয়েছে।</p>
      ${infoCard(`${isSeller ? 'পেআউট' : 'রিফান্ড'} তথ্য`, [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
        infoRow('অ্যাকাউন্ট', `${accountType} — ${accountNumber}`),
      ])}
      <div class="card card-warn"><p>⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত <strong>১-২ ঘন্টার</strong> মধ্যে প্রক্রিয়া সম্পন্ন হয়।</p></div>
    `),
  };
}

export function payoutCompletedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSeller = payoutType === 'seller_payout';
  return {
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} সম্পন্ন: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>✅ ${isSeller ? 'পেআউট' : 'রিফান্ড'} সম্পন্ন</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলের ${isSeller ? 'পেআউট' : 'রিফান্ড'} সফলভাবে সম্পন্ন হয়েছে!</p>
      <div class="card card-success">
        <div class="check">💵</div>
        <div class="msg">৳${amount.toLocaleString('bn-BD')} — আপনার অ্যাকাউন্টে পাঠানো হয়েছে</div>
      </div>
      ${infoCard('বিবরণ', [
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
    subject: `⚖️ বিরোধ নিষ্পত্তি: "${dealTitle}" — ${s('email_site_name')}`,
    html: wrap(`
      <h2>⚖️ বিরোধ নিষ্পত্তি</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলে দায়ের করা বিরোধটি অ্যাডমিন কর্তৃক নিষ্পত্তি করা হয়েছে।</p>
      ${isComplete
        ? `<div class="card card-success"><div class="check">✅</div><div class="msg">সিদ্ধান্ত: ডিল কমপ্লিট — বিক্রেতাকে পেমেন্ট দেওয়া হবে</div></div>`
        : `<div class="card card-warn"><p>🔄 সিদ্ধান্ত: <strong>ক্রেতাকে রিফান্ড</strong> — ক্রেতার টাকা ফেরত দেওয়া হবে</p></div>`
      }
      ${adminNote ? `<div class="card card-green"><div class="card-icon">📝 অ্যাডমিন নোট</div><div class="card-row" style="display:block"><span class="val" style="font-weight:400;font-size:13.5px">${adminNote}</span></div></div>` : ''}
      <p>বিরোধ সম্পর্কে কোনো প্রশ্ন থাকলে ড্যাশবোর্ড থেকে যোগাযোগ করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function adminNewDealEmail(adminName: string, dealTitle: string, amount: string, creatorName: string, buyerName: string, sellerName: string) {
  return {
    subject: `🆕 নতুন ডিল: "${dealTitle}" — অ্যাডমিন`,
    html: wrap(`
      <h2>🆕 নতুন ডিল তৈরি হয়েছে</h2>
      <p class="greeting">হ্যালো <strong>${adminName}</strong>,</p>
      <p>প্ল্যাটফর্মে একটি নতুন ডিল তৈরি হয়েছে।</p>
      ${infoCard('ডিলের বিবরণ', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', amount),
        infoRow('তৈরিকারক', creatorName),
        infoRow('ক্রেতা', buyerName),
        infoRow('বিক্রেতা', sellerName || 'অপেক্ষমান'),
      ])}
      <p>ডিলটি পর্যালোচনা করুন এবং প্রয়োজনীয় ব্যবস্থা গ্রহণ করুন।</p>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">অ্যাডমিন প্যানেলে যান →</a></div>
    `),
  };
}

export function adminDisputeEmail(adminName: string, dealTitle: string, amount: string, buyerName: string, sellerName: string) {
  return {
    subject: `🚨 নতুন বিরোধ: "${dealTitle}" — অ্যাডমিন`,
    html: wrap(`
      <h2>🚨 নতুন বিরোধ দায়ের</h2>
      <p class="greeting">হ্যালো <strong>${adminName}</strong>,</p>
      <p>প্ল্যাটফর্মে একটি নতুন বিরোধ দায়ের করা হয়েছে। <strong>দ্রুত পর্যালোচনা প্রয়োজন।</strong></p>
      <div class="card card-danger"><p>⚡ ডিলের পরিমাণ: <strong>${amount}</strong></p></div>
      ${infoCard('দলের তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('ক্রেতা', buyerName),
        infoRow('বিক্রেতা', sellerName),
      ])}
      <div class="card card-warn"><p>⏰ দ্রুত ব্যবস্থা নিন — উভয় পক্ষ অপেক্ষমান আছে।</p></div>
      <div class="btn-wrap"><a href="${s('email_site_url')}" class="btn">অ্যাডমিন প্যানেলে যান →</a></div>
    `),
  };
}

function otpDigitsHtml(otp: string): string {
  const digits = otp.split('');
  return `<div class="otp-digits">${digits.map((d) => `<span>${d}</span>`).join('')}</div>`;
}

export function passwordResetOtpEmail(toName: string, otp: string) {
  return {
    subject: `🔑 পাসওয়ার্ড রিসেট কোড — ${s('email_site_name')}`,
    html: wrap(`
      <h2>🔑 পাসওয়ার্ড রিসেট</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের জন্য একটি ভেরিফিকেশন কোড পাঠানো হয়েছে।</p>
      <div class="otp-card">
        <div class="otp-label">✦ VERIFICATION CODE</div>
        ${otpDigitsHtml(otp)}
        <div class="otp-hint">⏱ কোডটি ৫ মিনিটের জন্য বৈধ</div>
      </div>
      <div class="card card-warn"><p>🔒 কাউকে এই কোড <strong>শেয়ার করবেন না</strong>। ${s('email_site_name')} কখনো আপনাকে কোড জানতে চাইবে না।</p></div>
      <p>আপনি পাসওয়ার্ড রিসেট অনুরোধ করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

export function emailVerificationOtpEmail(toName: string, otp: string) {
  return {
    subject: `✉️ ইমেইল ভেরিফিকেশন কোড — ${s('email_site_name')}`,
    html: wrap(`
      <h2>✉️ ইমেইল ভেরিফিকেশন</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার <strong>${s('email_site_name')}</strong> অ্যাকাউন্ট যাচাই করতে নিচের কোডটি ব্যবহার করুন।</p>
      <div class="otp-card">
        <div class="otp-label">✦ VERIFICATION CODE</div>
        ${otpDigitsHtml(otp)}
        <div class="otp-hint">⏱ কোডটি ১০ মিনিটের জন্য বৈধ</div>
      </div>
      <div class="card card-warn"><p>🔒 কাউকে এই কোড <strong>শেয়ার করবেন না</strong>।</p></div>
      <p>আপনি অ্যাকাউন্ট তৈরি করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

/* ═══════════════════════════════════════════════════════════════
   SEND HELPERS
   ═══════════════════════════════════════════════════════════════ */

type EmailPayload = { subject: string; html: string };

export async function sendEmail(to: string, payload: EmailPayload): Promise<void> {
  const settings = await loadEmailSettings(); // refresh cache if stale
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

export function fireEmails(emails: Array<{ to: string; payload: EmailPayload }>) {
  for (const e of emails) {
    sendEmail(e.to, e.payload).catch((err) => {
      console.error(`[EMAIL ERROR] → ${e.to}:`, err);
    });
  }
}