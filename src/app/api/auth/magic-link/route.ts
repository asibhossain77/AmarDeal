import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendOtpEmail, magicLinkEmail } from '@/lib/email'
import { hashPassword } from '@/lib/password'
import { v4 as uuid } from 'uuid'

const SESSION_COOKIE = 'midman_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'সঠিক ইমেইল দিন' }, { status: 400 })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    // Get site URL from settings
    const siteUrlSetting = await db.platformSetting.findUnique({ where: { key: 'email_site_url' } })
    const siteNameSetting = await db.platformSetting.findUnique({ where: { key: 'email_site_name' } })
    const siteUrl = siteUrlSetting?.value || process.env.NEXT_PUBLIC_SITE_URL || ''
    const siteName = siteNameSetting?.value || 'মিডম্যান'

    // Check if user exists
    let user = await db.user.findUnique({ where: { email: trimmedEmail } })

    if (user) {
      // Existing user — update token
      await db.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiry: expiresAt },
      })
    } else {
      // New user — create with minimal data
      user = await db.user.create({
        data: {
          email: trimmedEmail,
          name: '', // Will be completed later
          phone: '', // Will be completed later
          password: await hashPassword(uuid()),
          resetToken: token,
          resetTokenExpiry: expiresAt,
          emailVerified: true, // Verified via magic link
        },
      })
    }

    // Check referral cookie
    const refCookie = request.cookies.get('midman_ref')
    if (refCookie && !user.referredBy) {
      try {
        const ref = JSON.parse(refCookie.value)
        if (ref.referrerId) {
          await db.user.update({ where: { id: user.id }, data: { referredBy: ref.referrerId } })
        }
      } catch {}
    }

    // Send magic link email
    const verifyUrl = `${siteUrl}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(trimmedEmail)}`
    const isNew = !user.name // no name = profile incomplete

    try {
      await sendOtpEmail(trimmedEmail, magicLinkEmail(user.name || 'ব্যবহারকারী', verifyUrl, siteName, isNew))
    } catch (emailErr) {
      console.error('[MAGIC LINK] Email send failed:', emailErr)
      return NextResponse.json({ error: 'ইমেইল পাঠাতে সমস্যা হয়েছে' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'ইমেইলে লগইন লিংক পাঠানো হয়েছে' })
  } catch (err) {
    console.error('[MAGIC LINK] Error:', err)
    return NextResponse.json({ error: 'সার্ভারে সমস্যা হয়েছে' }, { status: 500 })
  }
}
