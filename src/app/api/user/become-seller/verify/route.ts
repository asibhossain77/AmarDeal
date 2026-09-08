import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import { ensureVerificationColumn, normalizeCode, withVerificationColumn } from '@/lib/seller-verify'

// POST /api/user/become-seller/verify
// User enters the verification code the admin sent them on WhatsApp.
// On the correct code the application is approved and the user is promoted to seller.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const code = normalizeCode(body?.code)

    if (!code) {
      return NextResponse.json({ error: 'ভেরিফিকেশন কোড লিখুন' }, { status: 400 })
    }

    await ensureVerificationColumn()

    const application = await withVerificationColumn(() =>
      db.sellerApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    )

    if (!application) {
      return NextResponse.json({ error: 'কোনো সেলার আবেদন পাওয়া যায়নি' }, { status: 404 })
    }

    if (application.status !== 'pending') {
      return NextResponse.json({ error: 'এই আবেদন ইতিমধ্যে প্রক্রিয়াকৃত' }, { status: 400 })
    }

    if (!application.verificationCode) {
      return NextResponse.json(
        { error: 'এই আবেদনের কোড তৈরি হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন' },
        { status: 400 }
      )
    }

    if (application.verificationCode !== code) {
      return NextResponse.json({ error: 'ভুল কোড! আবার চেষ্টা করুন' }, { status: 400 })
    }

    // Correct code — approve the application and promote the user to seller
    await db.sellerApplication.update({
      where: { id: application.id },
      data: { status: 'approved' },
    })

    await db.user.update({
      where: { id: userId },
      data: { isSeller: true, whatsappNumber: application.whatsappNumber || null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Verify seller code error:', err)
    return NextResponse.json({ error: 'সমস্যা হয়েছে' }, { status: 500 })
  }
}
