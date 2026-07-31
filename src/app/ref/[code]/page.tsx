import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const REFERRAL_COOKIE_NAME = 'amardeal_ref'
const REFERRAL_COOKIE_DAYS = 30

interface Props {
  params: Promise<{ code: string }>
}

export default async function ReferralPage({ params }: Props) {
  const { code } = await params

  try {
    // Look up the referral code
    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true, name: true },
    })

    const cookieStore = await cookies()

    if (referrer) {
      // Valid referral code — set cookie for 30 days
      cookieStore.set(REFERRAL_COOKIE_NAME, JSON.stringify({
        code,
        referrerId: referrer.id,
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: REFERRAL_COOKIE_DAYS * 24 * 60 * 60,
      })
    } else {
      // Invalid code — clear any existing referral cookie
      cookieStore.delete(REFERRAL_COOKIE_NAME)
    }
  } catch (err) {
    console.error('[REFERRAL ROUTE ERROR]', err)
  }

  // Always redirect to homepage
  redirect('/')
}