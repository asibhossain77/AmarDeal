import nodemailer from 'nodemailer';

const SITE_NAME = 'আমারডিল.বাংলা';
const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';
const YEAR = new Date().getFullYear();

/* ── Brevo SMTP Transport (lazy init) ── */
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.BREVO_SMTP_KEY) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER || '',
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }
  return _transporter;
}

const FROM_ADDRESS = process.env.BREVO_FROM_EMAIL
  || process.env.BREVO_SMTP_USER
  || 'noreply@amardeal.com';
const FROM_NAME = 'আমারডিল.বাংলা';

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
const textDark    = '#1a1a2e';
const textMuted   = '#64748b';
const borderColor = '#e2e8f0';

/* Reusable style blocks */
const reset = `*{margin:0;padding:0;box-sizing:border-box}body{margin:0;padding:0;background:#F2F4F7;font-family:'Segoe UI',system-ui,-apple-system,Tahoma,sans-serif;-webkit-font-smoothing:antialiased}`;
const base = `
  ${reset}
  img{border:none;outline:none;text-decoration:none}
  a{text-decoration:none;color:${brandLime}}

  /* ── Outer wrapper ── */
  .email-wrapper{max-width:540px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(132,204,22,0.08),0 1px 3px rgba(0,0,0,0.04)}

  /* ── Header (no logo, name only) ── */
  .header-bg{background:linear-gradient(145deg,#84CC16 0%,#65A30D 50%,#4D7C0F 100%);padding:44px 32px 38px;text-align:center;position:relative;overflow:hidden}
  .header-bg::before{content:'';position:absolute;top:-50%;right:-25%;width:280px;height:280px;background:radial-gradient(circle,rgba(255,255,255,0.15) 0%,transparent 70%);border-radius:50%}
  .header-bg::after{content:'';position:absolute;bottom:-35%;left:-15%;width:220px;height:220px;background:radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%);border-radius:50%}
  .header-inner{position:relative;z-index:1}
  .header-title{color:#ffffff;font-size:28px;font-weight:900;letter-spacing:-0.5px;margin:0;line-height:1.2}
  .header-sub{color:rgba(255,255,255,0.85);font-size:13px;margin-top:8px;font-weight:400;letter-spacing:0.3px}
  .header-border{height:4px;background:linear-gradient(to right,${brandGlow},${brandLime},${brandGlow})}

  /* ── Body ── */
  .body{padding:32px 30px 28px}
  .body h2{font-size:20px;font-weight:700;color:${textDark};margin-bottom:6px;line-height:1.3}
  .body .greeting{font-size:15px;color:${textDark};margin-bottom:16px;line-height:1.65}
  .body .greeting strong{font-weight:600}
  .body p{font-size:14px;color:${textMuted};line-height:1.75;margin-bottom:14px}

  /* Info card — lime green */
  .card{border-radius:14px;padding:18px 22px;margin:18px 0}
  .card-green{background:linear-gradient(145deg,#F7FEE7 0%,#ECFCCB 100%);border:1px solid #D9F99D;box-shadow:0 1px 4px rgba(132,204,22,0.06)}
  .card-green .card-icon{font-size:12.5px;margin-bottom:10px;color:${brandLabel};font-weight:700;letter-spacing:0.8px;text-transform:uppercase}
  .card-green .card-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13.5px;border-bottom:1px solid rgba(132,204,22,0.1)}
  .card-green .card-row:last-child{border-bottom:none}
  .card-green .card-row .lbl{color:${brandRowLbl};font-weight:500}
  .card-green .card-row .val{color:${brandDark};font-weight:700;font-size:14px}

  /* Success card */
  .card-success{background:linear-gradient(145deg,#F7FEE7 0%,#ECFCCB 100%);border:1px solid #D9F99D;text-align:center;padding:24px 20px;box-shadow:0 2px 8px rgba(132,204,22,0.08)}
  .card-success .check{font-size:32px;margin-bottom:8px}
  .card-success .msg{font-size:15px;color:${brandSuccTxt};font-weight:600;line-height:1.5}

  /* Warning card */
  .card-warn{background:linear-gradient(145deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fde68a;border-radius:14px;padding:16px 22px;margin:18px 0}
  .card-warn p{margin:0;font-size:13.5px;color:#92400e;line-height:1.6}
  .card-warn p strong{font-weight:600}

  /* Danger card */
  .card-danger{background:linear-gradient(145deg,#fef2f2 0%,#fecaca 100%);border:1px solid #fca5a5;border-radius:14px;padding:16px 22px;margin:18px 0}
  .card-danger p{margin:0;font-size:13.5px;color:#991b1b;line-height:1.6}

  /* OTP card — enhanced with individual digit boxes */
  .otp-card{background:linear-gradient(145deg,${brandLight} 0%,#ECFCCB 50%,${brandLight} 100%);border:2px solid ${brandGlow};border-radius:18px;padding:30px 24px 24px;text-align:center;margin:22px auto;max-width:300px;position:relative;box-shadow:0 4px 16px rgba(132,204,22,0.08)}
  .otp-card::before{content:'';position:absolute;top:-1px;left:20%;right:20%;height:2px;background:linear-gradient(to right,transparent,${brandLime},transparent);border-radius:1px}
  .otp-label{font-size:11px;font-weight:700;color:${brandLabel};letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}
  .otp-digits{display:inline-flex;gap:8px;direction:ltr}
  .otp-digits span{display:inline-flex;align-items:center;justify-content:center;width:42px;height:50px;background:#ffffff;border:2px solid ${brandGlow};border-radius:10px;font-size:24px;font-weight:800;color:${brandDark};font-family:'Courier New',monospace;box-shadow:0 2px 6px rgba(132,204,22,0.08)}
  .otp-hint{font-size:11.5px;color:#6b7280;margin-top:14px;line-height:1.4}

  /* Legacy OTP fallback (plain text code) */
  .otp-code{font-size:36px;font-weight:900;letter-spacing:10px;color:${brandDark};font-family:'Courier New',monospace;line-height:1.2}

  /* CTA button */
  .btn-wrap{text-align:center;margin:24px 0 10px}
  .btn{display:inline-block;background:linear-gradient(145deg,#84CC16 0%,#65A30D 100%);color:#ffffff !important;padding:14px 40px;border-radius:14px;font-weight:600;font-size:15px;letter-spacing:0.2px;box-shadow:0 4px 16px rgba(132,204,22,0.3),0 1px 3px rgba(0,0,0,0.06);transition:all 0.2s}
  .btn:hover{box-shadow:0 6px 24px rgba(132,204,22,0.4);transform:translateY(-1px)}

  /* Divider */
  .divider{height:1px;background:linear-gradient(to right,transparent,${borderColor},transparent);margin:22px 0}

  /* Footer */
  .footer{background:linear-gradient(to bottom,#f8fafc,#f1f5f9);border-top:1px solid ${borderColor};padding:28px 30px;text-align:center}
  .footer-brand{font-size:16px;font-weight:800;color:${brandDark};margin-bottom:3px;letter-spacing:-0.2px}
  .footer-tagline{font-size:12px;color:${textMuted};margin-bottom:14px}
  .footer-links{display:inline-flex;gap:22px;margin-bottom:16px}
  .footer-links a{font-size:12px;color:#94a3b8;text-decoration:none;font-weight:500}
  .footer-links a:hover{color:${brandLime}}
  .footer-copy{font-size:11px;color:#cbd5e1;line-height:1.5}
  .footer-copy a{color:#94a3b8}
  .footer-social{display:inline-flex;gap:12px;margin-top:14px}
  .footer-social a{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:rgba(132,204,22,0.08);border-radius:8px;font-size:14px;text-decoration:none;transition:background 0.2s}
  .footer-social a:hover{background:rgba(132,204,22,0.15)}

  @media only screen and (max-width:520px){
    .email-wrapper{border-radius:0;margin:0}
    .body{padding:24px 20px 20px}
    .header-bg{padding:32px 20px 28px}
    .otp-digits span{width:36px;height:44px;font-size:20px}
    .otp-code{font-size:30px;letter-spacing:7px}
    .btn{padding:12px 28px;font-size:14px}
    .card-green .card-row{flex-direction:column;align-items:flex-start;gap:2px}
  }
`;

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="bn" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${SITE_NAME}</title><style>${base}</style></head><body style="background:#F2F4F7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F4F7;padding:28px 0">
  <tr><td align="center">
    <div class="email-wrapper">
      <div class="header-bg">
        <div class="header-inner">
          <div class="header-title">${SITE_NAME}</div>
          <div class="header-sub">নিরাপদ অনলাইন লেনদেনের বিশ্বস্ত প্ল্যাটফর্ম</div>
        </div>
      </div>
      <div class="header-border"></div>
      <div class="body">${bodyHtml}</div>
      <div class="footer">
        <div class="footer-brand">${SITE_NAME}</div>
        <div class="footer-tagline">নিরাপদে কিনুন, নিরাপদে বিক্রি করুন</div>
        <div class="footer-links">
          <a href="${SITE_URL}">ওয়েবসাইট</a>
          <a href="${SITE_URL}">সাহায্য কেন্দ্র</a>
          <a href="${SITE_URL}">যোগাযোগ</a>
        </div>
        <div class="footer-social">
          <a href="${SITE_URL}" title="ফেসবুক">📘</a>
          <a href="${SITE_URL}" title="গ্রুপ">👥</a>
          <a href="${SITE_URL}" title="ওয়েবসাইট">🌐</a>
        </div>
        <div class="footer-copy">© ${YEAR} ${SITE_NAME}। সর্বস্বত্ব সংরক্ষিত।<br>এই ইমেইলটি স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</div>
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
    subject: `নতুন ডিল অনুরোধ: "${dealTitle}" — ${SITE_NAME}`,
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function dealAcceptedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডিল গ্রহণ করা হয়েছে: "${dealTitle}" — ${SITE_NAME}`,
    html: wrap(`
      <h2>✅ ডিল গ্রহণ করা হয়েছে</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${sellerName}</strong> আপনার ডিলটি গ্রহণ করেছেন। এখন পেমেন্ট করুন:</p>
      ${infoCard('ডিলের তথ্য', [
        infoRow('ডিল', dealTitle),
        infoRow('পরিমাণ', `৳${amount.toLocaleString('bn-BD')}`),
      ])}
      <p>ড্যাশবোর্ডে গিয়ে পেমেন্ট জমা দিন। টাকা এসক্রোতে সুরক্ষিত থাকবে।</p>
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">পেমেন্ট করুন →</a></div>
    `),
  };
}

export function paymentSubmittedEmail(toName: string, dealTitle: string, amount: number) {
  return {
    subject: `পেমেন্ট জমা হয়েছে: "${dealTitle}" — ${SITE_NAME}`,
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
    subject: `পেমেন্ট ভেরিফাইড: "${dealTitle}" — ${SITE_NAME}`,
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
           <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ডেলিভারি কনফার্ম করুন →</a></div>`
      }
    `),
  };
}

export function deliveryStartedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডেলিভারি শুরু: "${dealTitle}" — ${SITE_NAME}`,
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ডেলিভারি কনফার্ম করুন →</a></div>
    `),
  };
}

export function dealCompletedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isSeller = role === 'seller';
  return {
    subject: `ডিল সম্পন্ন: "${dealTitle}" — ${SITE_NAME}`,
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
           <div class="btn-wrap"><a href="${SITE_URL}" class="btn">পেআউট রিকোয়েস্ট করুন →</a></div>`
        : `<p>ধন্যবাদ যে ${SITE_NAME} ব্যবহার করেছেন। আপনার সম্পূর্ণ লেনদেন নিরাপদ ছিল!</p>`
      }
    `),
  };
}

export function dealCancelledEmail(toName: string, dealTitle: string, cancelledByName: string) {
  return {
    subject: `ডিল বাতিল: "${dealTitle}" — ${SITE_NAME}`,
    html: wrap(`
      <h2>❌ ডিল বাতিল</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${cancelledByName}</strong> "${dealTitle}" ডিলটি বাতিল করেছেন।</p>
      <div class="card card-danger"><p>⚠️ এই ডিল আর সক্রিয় নেই।</p></div>
      <p>নতুন ডিল তৈরি করতে ড্যাশবোর্ডে যান।</p>
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">নতুন ডিল তৈরি করুন →</a></div>
    `),
  };
}

export function disputeRaisedEmail(toName: string, dealTitle: string, buyerName: string, amount: number) {
  return {
    subject: `⚠️ বিরোধ দায়ের: "${dealTitle}" — ${SITE_NAME}`,
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function welcomeEmail(toName: string) {
  return {
    subject: `স্বাগতম ${SITE_NAME} এ! 🎉`,
    html: wrap(`
      <h2>🎊 স্বাগতম, ${toName}!</h2>
      <p class="greeting">${SITE_NAME} পরিবারে আপনাকে স্বাগত জানাই!</p>
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">শুরু করুন →</a></div>
    `),
  };
}

export function loginNotificationEmail(toName: string, loginTime: string, loginIp: string) {
  return {
    subject: `🔐 নতুন লগইন সনাক্ত — ${SITE_NAME}`,
    html: wrap(`
      <h2>🔐 নতুন লগইন সনাক্ত</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টে একটি নতুন লগইন সনাক্ত করা হয়েছে।</p>
      ${infoCard('লগইন তথ্য', [
        infoRow('🕐 সময়', loginTime),
        infoRow('🌐 আইপি', loginIp),
      ])}
      <div class="card card-warn"><p>⚠️ যদি এটি আপনার করা না হয়, তবে দ্রুত পাসওয়ার্ড পরিবর্তন করুন।</p></div>
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান →</a></div>
    `),
  };
}

export function payoutRequestedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSeller = payoutType === 'seller_payout';
  const title = isSeller ? '💰 পেআউট অনুরোধ' : '🔄 রিফান্ড অনুরোধ';
  return {
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} অনুরোধ: "${dealTitle}" — ${SITE_NAME}`,
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
    subject: `${isSeller ? 'পেআউট' : 'রিফান্ড'} সম্পন্ন: "${dealTitle}" — ${SITE_NAME}`,
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
    subject: `⚖️ বিরোধ নিষ্পত্তি: "${dealTitle}" — ${SITE_NAME}`,
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান →</a></div>
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">অ্যাডমিন প্যানেলে যান →</a></div>
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
      <div class="btn-wrap"><a href="${SITE_URL}" class="btn">অ্যাডমিন প্যানেলে যান →</a></div>
    `),
  };
}

function otpDigitsHtml(otp: string): string {
  const digits = otp.split('');
  return `<div class="otp-digits">${digits.map((d) => `<span>${d}</span>`).join('')}</div>`;
}

export function passwordResetOtpEmail(toName: string, otp: string) {
  return {
    subject: `🔑 পাসওয়ার্ড রিসেট কোড — ${SITE_NAME}`,
    html: wrap(`
      <h2>🔑 পাসওয়ার্ড রিসেট</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের জন্য একটি ভেরিফিকেশন কোড পাঠানো হয়েছে।</p>
      <div class="otp-card">
        <div class="otp-label">✦ ভেরিফিকেশন কোড</div>
        ${otpDigitsHtml(otp)}
        <div class="otp-hint">⏱️ কোডটি ৫ মিনিটের জন্য বৈধ</div>
      </div>
      <div class="card card-warn"><p>🔒 কাউকে এই কোড <strong>শেয়ার করবেন না</strong>। ${SITE_NAME} কখনো আপনাকে কোড জানতে চাইবে না।</p></div>
      <p>আপনি পাসওয়ার্ড রিসেট অনুরোধ করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

export function emailVerificationOtpEmail(toName: string, otp: string) {
  return {
    subject: `✉️ ইমেইল ভেরিফিকেশন কোড — ${SITE_NAME}`,
    html: wrap(`
      <h2>✉️ ইমেইল ভেরিফিকেশন</h2>
      <p class="greeting">হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার <strong>${SITE_NAME}</strong> অ্যাকাউন্ট যাচাই করতে নিচের কোডটি ব্যবহার করুন।</p>
      <div class="otp-card">
        <div class="otp-label">✦ ভেরিফিকেশন কোড</div>
        ${otpDigitsHtml(otp)}
        <div class="otp-hint">⏱️ কোডটি ১০ মিনিটের জন্য বৈধ</div>
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
  const transporter = getTransporter();
  if (!transporter) throw new Error('BREVO_SMTP_KEY সেট করা নেই। .env ফাইলে যোগ করুন।');

  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
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