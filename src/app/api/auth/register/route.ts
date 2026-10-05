import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sendOtpEmail, emailVerificationOtpEmail } from '@/lib/email'
import { hashPassword } from '@/lib/password'
import { generateUniqueReferralCode } from '@/lib/referral-code'
import { sendMetaEvent, metaUserDataFromRequest, metaHashIdentity } from '@/lib/meta-capi'
import { notifyAdmins } from '@/lib/push'

const REFERRAL_COOKIE_NAME = 'midman_ref'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, password } = await req.json()

    if (!name || !phone || !email || !password) {
      return NextResponse.json(
        { error: 'সকল তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' },
        { status: 400 }
      )
    }

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'এই ইমেইল বা মোবাইল নাম্বার দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে' },
        { status: 409 }
      )
    }

    // Generate 6-digit OTP for email verification (10 min expiry)
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000)

    // Generate unique referral code
    const referralCode = await generateUniqueReferralCode(name)

    // Check referral cookie to link referredBy
    let referredBy: string | undefined
    try {
      const cookieStore = await cookies()
      const refCookie = cookieStore.get(REFERRAL_COOKIE_NAME)
      if (refCookie?.value) {
        const parsed = JSON.parse(refCookie.value)
        if (parsed?.referrerId) {
          // Verify the referrer exists and is active
          const referrer = await db.user.findUnique({
            where: { id: parsed.referrerId },
            select: { id: true, isActive: true },
          })
          if (referrer?.isActive) {
            referredBy = referrer.id
            console.log(`[REFERRAL] User registered via referral. referrerId=${parsed.referrerId}`)
          }
        }
      }
    } catch (err) {
      console.error('[REFERRAL COOKIE ERROR]', err)
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(password)

    const user = await db.user.create({
      data: {
        name,
        phone,
        email,
        password: hashedPassword,
        emailVerified: false,
        resetToken: otp,
        resetTokenExpiry: otpExpiry,
        referralCode,
        ...(referredBy ? { referredBy } : {}),
      },
    })

    // Notify admins about the new user registration (fire-and-forget)
    notifyAdmins({
      type: 'system_update',
      title: 'নতুন ইউজার রেজিস্ট্রেশন',
      message: `${user.name || 'একজন ইউজার'} (${user.phone || user.email}) নতুন একাউন্ট খুলেছেন।`,
      relatedType: 'user',
      relatedId: user.id,
    }).catch(() => {})

    // Clear referral cookie after successful registration
    if (referredBy) {
      try {
        const cookieStore = await cookies()
        cookieStore.delete(REFERRAL_COOKIE_NAME)
      } catch {
        // Ignore cookie deletion errors
      }
    }

    // Meta Conversions API — CompleteRegistration (server-side; no browser twin)
    await sendMetaEvent({
      eventName: 'CompleteRegistration',
      eventId: `reg-${user.id}`,
      userData: {
        ...metaUserDataFromRequest(req),
        ...metaHashIdentity({ email: user.email, phone: user.phone, userId: user.id }),
      },
      customData: { content_name: 'complete_registration', status: true },
      eventSourceUrl: req.headers.get('referer') || undefined,
    })

    // Send verification OTP email (fire-and-forget)
    sendOtpEmail(user.email, () => emailVerificationOtpEmail(user.name, otp)).catch((err) => {
      console.error('[REG VERIFY EMAIL ERROR]', err)
    })

    // Return user info but DO NOT set session cookie — user must verify first
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      needsVerification: true,
    })
  } catch {
    return NextResponse.json(
      { error: 'নিবন্ধনে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}