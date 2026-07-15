import nodemailer from 'nodemailer';

const SITE_NAME = 'AmarDeal আমারডিল';
const SITE_URL = 'https://xn--94b8cubil3ej.xn--54b7fta0cc';

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

/* From address — uses Brevo verified sender or fallback */
const FROM_ADDRESS = process.env.BREVO_FROM_EMAIL
  || process.env.BREVO_SMTP_USER
  || 'noreply@amardeal.com';
const FROM_NAME = `${SITE_NAME}`;

/* ── Common email styles ── */
const baseStyles = `
  body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
  .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .header { background: #16a34a; padding: 24px 32px; text-align: center; }
  .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; }
  .content { padding: 32px; }
  .content h2 { margin: 0 0 12px; font-size: 18px; color: #18181b; }
  .content p { margin: 0 0 12px; font-size: 15px; color: #52525b; line-height: 1.6; }
  .info-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  .info-box p { margin: 0; font-size: 14px; color: #166534; }
  .info-box .label { font-weight: 600; color: #15803d; }
  .info-box .value { font-size: 16px; font-weight: 700; color: #166534; }
  .btn { display: inline-block; background: #16a34a; color: #ffffff !important; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 16px; }
  .btn:hover { background: #15803d; }
  .footer { padding: 20px 32px; border-top: 1px solid #e4e4e7; text-align: center; }
  .footer p { margin: 0; font-size: 12px; color: #a1a1aa; }
  .footer a { color: #16a34a; text-decoration: none; }
  .warning-box { background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  .warning-box p { margin: 0; font-size: 14px; color: #9a3412; }
  .danger-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  .danger-box p { margin: 0; font-size: 14px; color: #991b1b; }
  .success-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 16px 0; }
  .success-box p { margin: 0; font-size: 14px; color: #166534; }
`;

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${baseStyles}</style></head><body>
<div class="container">
  <div class="header"><h1>${SITE_NAME}</h1></div>
  <div class="content">${bodyHtml}</div>
  <div class="footer"><p>© ${new Date().getFullYear()} ${SITE_NAME} — নিরাপদ অনলাইন লেনদেন<br><a href="${SITE_URL}">${SITE_URL}</a></p></div>
</div></body></html>`;
}

/* ── Template functions ── */

export function dealCreatedEmail(toName: string, dealTitle: string, amount: number, creatorName: string, role: string) {
  return {
    subject: `নতুন ডিল অনুরোধ: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>নতুন ডিল অনুরোধ</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${creatorName}</strong> আপনাকে ${role === 'buyer' ? 'বিক্রেতা' : 'ক্রেতা'} হিসেবে একটি নতুন ডিল পাঠিয়েছেন:</p>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      <p>আপনার ড্যাশবোর্ডে লগইন করে ডিলটি গ্রহণ বা বাতিল করুন।</p>
      <a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান</a>
    `),
  };
}

export function dealAcceptedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডিল গ্রহণ করা হয়েছে: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ডিল গ্রহণ করা হয়েছে ✅</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${sellerName}</strong> আপনার ডিলটি গ্রহণ করেছেন। এখন পেমেন্ট করুন:</p>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      <p>ড্যাশবোর্ডে গিয়ে পেমেন্ট জমা দিন। টাকা এসক্রোতে সুরক্ষিত থাকবে।</p>
      <a href="${SITE_URL}" class="btn">পেমেন্ট করুন</a>
    `),
  };
}

export function paymentSubmittedEmail(toName: string, dealTitle: string, amount: number) {
  return {
    subject: `পেমেন্ট জমা হয়েছে: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>পেমেন্ট জমা হয়েছে 💰</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলে পেমেন্ট সফলভাবে জমা হয়েছে। অ্যাডমিন এখন ভেরিফিকেশন করছেন।</p>
      <div class="info-box">
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      <div class="warning-box">
        <p>⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত ১-২ ঘন্টার মধ্যে ভেরিফাই হয়।</p>
      </div>
    `),
  };
}

export function paymentVerifiedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isBuyer = role === 'buyer';
  return {
    subject: `পেমেন্ট ভেরিফাইড: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>পেমেন্ট ভেরিফাইড ✅</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলের পেমেন্ট অ্যাডমিন কর্তৃক ভেরিফাইড হয়েছে।</p>
      <div class="info-box">
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      ${isBuyer
        ? `<p>বিক্রেতা এখন পণ্য/সেবা ডেলিভারি দেবেন। ডেলিভারি পেলে কনফার্ম করুন।</p>`
        : `<p>আপনার কাজ শুরু করুন! কাজ শেষে ডেলিভারি বাটনে ক্লিক করুন।</p>
           <a href="${SITE_URL}" class="btn">ডেলিভারি কনফার্ম করুন</a>`
      }
    `),
  };
}

export function deliveryStartedEmail(toName: string, dealTitle: string, amount: number, sellerName: string) {
  return {
    subject: `ডেলিভারি শুরু: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ডেলিভারি শুরু হয়েছে 📦</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${sellerName}</strong> "${dealTitle}" ডিলের কাজ সম্পন্ন করেছেন।</p>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      <p>দয়া করে পণ্য/সেবা যাচাই করুন এবং কনফার্ম করুন। কোনো সমস্যা হলে বিরোধ দায়ের করুন।</p>
      <a href="${SITE_URL}" class="btn">ডেলিভারি কনফার্ম করুন</a>
    `),
  };
}

export function dealCompletedEmail(toName: string, dealTitle: string, amount: number, role: 'buyer' | 'seller') {
  const isSeller = role === 'seller';
  return {
    subject: `ডিল সম্পন্ন: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ডিল সফলভাবে সম্পন্ন 🎉</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলটি সফলভাবে সম্পন্ন হয়েছে!</p>
      <div class="success-box">
        <p>✅ লেনদেন নিরাপদে সম্পন্ন</p>
      </div>
      <div class="info-box">
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
      </div>
      ${isSeller
        ? `<p>পেআউট রিকোয়েস্ট করুন — টাকা শীঘ্রই আপনার অ্যাকাউন্টে পৌঁছে যাবে।</p>
           <a href="${SITE_URL}" class="btn">পেআউট রিকোয়েস্ট করুন</a>`
        : `<p>ধন্যবাদ যে ${SITE_NAME} ব্যবহার করেছেন। আপনার সম্পূর্ণ লেনদেন নিরাপদ ছিল!</p>`
      }
    `),
  };
}

export function dealCancelledEmail(toName: string, dealTitle: string, cancelledByName: string) {
  return {
    subject: `ডিল বাতিল: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ডিল বাতিল ❌</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${cancelledByName}</strong> "${dealTitle}" ডিলটি বাতিল করেছেন।</p>
      <div class="danger-box">
        <p>এই ডিল আর সক্রিয় নেই।</p>
      </div>
      <p>নতুন ডিল তৈরি করতে ড্যাশবোর্ডে যান।</p>
      <a href="${SITE_URL}" class="btn">নতুন ডিল তৈরি করুন</a>
    `),
  };
}

export function disputeRaisedEmail(toName: string, dealTitle: string, buyerName: string, amount: number) {
  return {
    subject: `⚠️ বিরোধ দায়ের: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ডিলে বিরোধ দায়ের ⚠️</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p><strong>${buyerName}</strong> "${dealTitle}" ডিলে বিরোধ দায়ের করেছেন। অ্যাডমিন এখন পর্যালোচনা করবেন।</p>
      <div class="danger-box">
        <p>ডিলের পরিমাণ: ৳${amount.toLocaleString('bn-BD')}</p>
      </div>
      <p>অ্যাডমিন উভয় পক্ষের কথা শুনে সিদ্ধান্ত নেবেন। দয়া করে ড্যাশবোর্ডে চেক করুন।</p>
      <a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান</a>
    `),
  };
}

export function welcomeEmail(toName: string) {
  return {
    subject: `স্বাগতম ${SITE_NAME} এ! — রেজিস্ট্রেশন সফল 🎉`,
    html: wrapHtml(`
      <h2>স্বাগতম ${toName}! 🎉</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>${SITE_NAME} এ সফলভাবে রেজিস্ট্রেশন সম্পন্ন হয়েছে। আমরা আপনাকে পরিবারে স্বাগত জানাই!</p>
      <div class="success-box">
        <p>✅ আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।</p>
      </div>
      <div class="info-box">
        <p>🛡️ <span class="label">এসক্রো সুরক্ষা:</span> প্রতিটি লেনদেন নিরাপদ এসক্রো সিস্টেমে সুরক্ষিত</p>
        <p>🔒 <span class="label">সুরক্ষিত লেনদেন:</span> ক্রেতা ও বিক্রেতা উভয়ের জন্য সম্পূর্ণ নিরাপত্তা</p>
        <p>⚡ <span class="label">দ্রুত পেআউট:</span> ডিল সম্পন্ন হলে দ্রুত পেমেন্ট পান</p>
      </div>
      <p>এখনই আপনার প্রথম ডিল তৈরি করুন এবং নিরাপদে লেনদেন শুরু করুন!</p>
      <a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান</a>
    `),
  };
}

export function loginNotificationEmail(toName: string, loginTime: string, loginIp: string) {
  return {
    subject: `নতুন লগইন সনাক্ত — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>নতুন লগইন সনাক্ত 🔐</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টে একটি নতুন লগইন সনাক্ত করা হয়েছে।</p>
      <div class="info-box">
        <p><span class="label">সময়:</span> <span class="value">${loginTime}</span></p>
        <p><span class="label">আইপি ঠিকানা:</span> <span class="value">${loginIp}</span></p>
      </div>
      <div class="warning-box">
        <p>⚠️ যদি এটি আপনার করা না হয়, তবে দ্রুত আপনার পাসওয়ার্ড পরিবর্তন করুন এবং অ্যাকাউন্ট সুরক্ষিত করুন।</p>
      </div>
      <a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান</a>
    `),
  };
}

export function payoutRequestedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSellerPayout = payoutType === 'seller_payout';
  return {
    subject: isSellerPayout
      ? `পেআউট অনুরোধ: "${dealTitle}" — ${SITE_NAME}`
      : `রিফান্ড অনুরোধ: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>${isSellerPayout ? 'পেআউট অনুরোধ' : 'রিফান্ড অনুরোধ'} 💰</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>${isSellerPayout
        ? `"${dealTitle}" ডিলের জন্য আপনার পেআউট অনুরোধ গ্রহণ করা হয়েছে। অ্যাডমিন এখন প্রক্রিয়া করবেন।`
        : `"${dealTitle}" ডিলের জন্য আপনার রিফান্ড অনুরোধ গ্রহণ করা হয়েছে। অ্যাডমিন এখন প্রক্রিয়া করবেন।`
      }</p>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">${isSellerPayout ? 'পেআউট' : 'রিফান্ড'} পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
        <p><span class="label">অ্যাকাউন্ট ধরন:</span> <span class="value">${accountType}</span></p>
        <p><span class="label">অ্যাকাউন্ট নম্বর:</span> <span class="value">${accountNumber}</span></p>
      </div>
      <div class="warning-box">
        <p>⏳ অ্যাডমিন ভেরিফিকেশনের জন্য অপেক্ষা করুন। সাধারণত ১-২ ঘন্টার মধ্যে ${isSellerPayout ? 'পেআউট' : 'রিফান্ড'} প্রক্রিয়া সম্পন্ন হয়।</p>
      </div>
    `),
  };
}

export function payoutCompletedEmail(toName: string, dealTitle: string, amount: number, accountType: string, accountNumber: string, payoutType: 'seller_payout' | 'buyer_refund') {
  const isSellerPayout = payoutType === 'seller_payout';
  return {
    subject: isSellerPayout
      ? `পেআউট সম্পন্ন: "${dealTitle}" — ${SITE_NAME}`
      : `রিফান্ড সম্পন্ন: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>${isSellerPayout ? 'পেআউট সম্পন্ন' : 'রিফান্ড সম্পন্ন'} ✅</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>${isSellerPayout
        ? `"${dealTitle}" ডিলের পেআউট সফলভাবে সম্পন্ন হয়েছে! টাকা আপনার অ্যাকাউন্টে পাঠানো হয়েছে।`
        : `"${dealTitle}" ডিলের রিফান্ড সফলভাবে সম্পন্ন হয়েছে! টাকা আপনার অ্যাকাউন্টে ফেরত পাঠানো হয়েছে।`
      }</p>
      <div class="success-box">
        <p>✅ ${isSellerPayout ? 'পেআউট' : 'রিফান্ড'} সফলভাবে সম্পন্ন হয়েছে</p>
        <p><span class="label">পরিমাণ:</span> <span class="value">৳${amount.toLocaleString('bn-BD')}</span></p>
        <p><span class="label">অ্যাকাউন্ট:</span> ${accountType} — ${accountNumber}</p>
      </div>
      <p>অ্যাকাউন্টে টাকা পৌঁছাতে কিছুটা সময় লাগতে পারে। সমস্যা হলে আমাদের জানান।</p>
    `),
  };
}

export function disputeResolvedEmail(toName: string, dealTitle: string, action: 'complete' | 'refund_buyer', adminNote?: string) {
  const isComplete = action === 'complete';
  return {
    subject: `বিরোধ নিষ্পত্তি: "${dealTitle}" — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>বিরোধ নিষ্পত্তি ⚖️</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>"${dealTitle}" ডিলে দায়ের করা বিরোধটি অ্যাডমিন কর্তৃক নিষ্পত্তি করা হয়েছে।</p>
      <div class="${isComplete ? 'success-box' : 'info-box'}">
        <p>${isComplete
          ? `✅ অ্যাডমিন সিদ্ধান্ত নিয়েছেন: <strong>ডিল কমপ্লিট</strong> — বিক্রেতাকে পেমেন্ট দেওয়া হবে।`
          : `🔄 অ্যাডমিন সিদ্ধান্ত নিয়েছেন: <strong>ক্রেতাকে রিফান্ড</strong> — ক্রেতার টাকা ফেরত দেওয়া হবে।`
        }</p>
      </div>
      ${adminNote
        ? `<div class="info-box">
            <p><span class="label">অ্যাডমিন নোট:</span> ${adminNote}</p>
          </div>`
        : ''
      }
      <p>বিরোধ সম্পর্কে কোনো প্রশ্ন থাকলে ড্যাশবোর্ড থেকে যোগাযোগ করুন।</p>
      <a href="${SITE_URL}" class="btn">ড্যাশবোর্ডে যান</a>
    `),
  };
}

export function adminNewDealEmail(adminName: string, dealTitle: string, amount: string, creatorName: string, buyerName: string, sellerName: string) {
  return {
    subject: `🆕 নতুন ডিল তৈরি: "${dealTitle}" — ${SITE_NAME} অ্যাডমিন`,
    html: wrapHtml(`
      <h2>নতুন ডিল তৈরি হয়েছে 🆕</h2>
      <p>হ্যালো <strong>${adminName}</strong>,</p>
      <p>প্ল্যাটফর্মে একটি নতুন ডিল তৈরি হয়েছে। বিস্তারিত নিচে দেওয়া হলো:</p>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">পরিমাণ:</span> <span class="value">${amount}</span></p>
        <p><span class="label">তৈরিকারক:</span> <span class="value">${creatorName}</span></p>
        <p><span class="label">ক্রেতা:</span> <span class="value">${buyerName}</span></p>
        <p><span class="label">বিক্রেতা:</span> <span class="value">${sellerName}</span></p>
      </div>
      <p>ডিলটি পর্যালোচনা করুন এবং প্রয়োজনীয় ব্যবস্থা গ্রহণ করুন।</p>
      <a href="${SITE_URL}" class="btn">অ্যাডমিন প্যানেলে যান</a>
    `),
  };
}

export function adminDisputeEmail(adminName: string, dealTitle: string, amount: string, buyerName: string, sellerName: string) {
  return {
    subject: `⚠️ নতুন বিরোধ দায়ের: "${dealTitle}" — ${SITE_NAME} অ্যাডমিন`,
    html: wrapHtml(`
      <h2>নতুন বিরোধ দায়ের ⚠️</h2>
      <p>হ্যালো <strong>${adminName}</strong>,</p>
      <p>প্ল্যাটফর্মে একটি নতুন বিরোধ দায়ের করা হয়েছে। দ্রুত পর্যালোচনা প্রয়োজন।</p>
      <div class="danger-box">
        <p>⚠️ ডিলের পরিমাণ: ${amount}</p>
      </div>
      <div class="info-box">
        <p><span class="label">ডিল:</span> <span class="value">${dealTitle}</span></p>
        <p><span class="label">ক্রেতা:</span> <span class="value">${buyerName}</span></p>
        <p><span class="label">বিক্রেতা:</span> <span class="value">${sellerName}</span></p>
      </div>
      <div class="warning-box">
        <p>⏰ দ্রুত ব্যবস্থা নিন — উভয় পক্ষ অপেক্ষমান আছে।</p>
      </div>
      <a href="${SITE_URL}" class="btn">অ্যাডমিন প্যানেলে যান</a>
    `),
  };
}

export function passwordResetOtpEmail(toName: string, otp: string) {
  return {
    subject: `পাসওয়ার্ড রিসেট কোড — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>পাসওয়ার্ড রিসেট 🔑</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের জন্য একটি ভেরিফিকেশন কোড পাঠানো হয়েছে।</p>
      <div class="info-box" style="text-align: center; padding: 24px;">
        <p style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #16a34a;">${otp}</p>
      </div>
      <div class="warning-box">
        <p>⏳ এই কোডটি <strong>৫ মিনিট</strong>ের জন্য বৈধ। কাউকে এই কোড শেয়ার করবেন না।</p>
      </div>
      <p>আপনি পাসওয়ার্ড রিসেট অনুরোধ করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

export function emailVerificationOtpEmail(toName: string, otp: string) {
  return {
    subject: `ইমেইল ভেরিফিকেশন কোড — ${SITE_NAME}`,
    html: wrapHtml(`
      <h2>ইমেইল ভেরিফিকেশন ✉️</h2>
      <p>হ্যালো <strong>${toName}</strong>,</p>
      <p>আপনার ${SITE_NAME} অ্যাকাউন্ট যাচাই করতে নিচের কোডটি ব্যবহার করুন।</p>
      <div class="info-box" style="text-align: center; padding: 24px;">
        <p style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #16a34a;">${otp}</p>
      </div>
      <div class="warning-box">
        <p>⏳ এই কোডটি <strong>১০ মিনিট</strong>ের জন্য বৈধ। কাউকে এই কোড শেয়ার করবেন না।</p>
      </div>
      <p>আপনি অ্যাকাউন্ট তৈরি করেননি? তাহলে এই ইমেইল উপেক্ষা করুন।</p>
    `),
  };
}

/* ── Send helper ── */

type EmailPayload = { subject: string; html: string };

/**
 * Send an email via Brevo SMTP. Throws on error (use in test endpoints).
 * For production fire-and-forget, use fireEmails() instead.
 */
export async function sendEmail(to: string, payload: EmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('BREVO_SMTP_KEY সেট করা নেই। .env ফাইলে যোগ করুন।');
  }

  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to,
    subject: payload.subject,
    html: payload.html,
  });
  console.log(`[EMAIL SENT] → ${to}: ${payload.subject}`);
}

/* ── Convenience: fire-and-forget multiple emails (production use) ── */
export function fireEmails(emails: Array<{ to: string; payload: EmailPayload }>) {
  for (const e of emails) {
    // fire-and-forget: don't await, silently catch
    sendEmail(e.to, e.payload).catch((err) => {
      console.error(`[EMAIL ERROR] → ${e.to}:`, err);
    });
  }
}