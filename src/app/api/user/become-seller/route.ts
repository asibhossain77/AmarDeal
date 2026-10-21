import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import {
  ensureSellerRoleColumns,
  ensureVerificationColumn,
  generateVerificationCode,
  withSellerRoleColumns,
  withVerificationColumn,
} from '@/lib/seller-verify'
import { notifyAdmins } from '@/lib/push'

const VALID_APPLICATION_TYPES = ['personal', 'business']
const VALID_ID_TYPES = ['nid', 'trade_licence']

// POST /api/user/become-seller
// applicationType:
//  - 'personal'  → Personal Digital Seller: only WhatsApp number verification
//                  (admin sends the code on WhatsApp, user verifies → seller)
//  - 'business'  → Verified Business Seller: NID / trade licence verification,
//                  application stays pending until an admin reviews and approves it.
//                  Existing personal sellers may also apply to upgrade.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const applicationType = VALID_APPLICATION_TYPES.includes(body?.applicationType)
      ? body.applicationType
      : 'personal'
    const { whatsappNumber } = body

    const wa = typeof whatsappNumber === 'string' ? whatsappNumber.trim() : ''
    if (!wa) {
      return NextResponse.json(
        { error: 'WhatsApp নম্বর দিন' },
        { status: 400 }
      )
    }
    if (!/^[+]?[0-9\s-]{6,20}$/.test(wa)) {
      return NextResponse.json(
        { error: 'সঠিক WhatsApp নম্বর দিন' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: 'ইউজার পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Business fields are validated before any other check so existing
    // personal sellers (isSeller = true) can also submit an upgrade application.
    let businessName = ''
    let idType: string | null = null
    let idNumber: string | null = null
    let documentImage: string | null = null

    if (applicationType === 'business') {
      if (user.sellerRole === 'business' && user.businessVerified) {
        return NextResponse.json(
          { error: 'আপনি ইতিমধ্যে একজন ভেরিফায়েড বিজনেস সেলার' },
          { status: 400 }
        )
      }

      businessName = typeof body?.businessName === 'string' ? body.businessName.trim() : ''
      if (!businessName || businessName.length < 2) {
        return NextResponse.json(
          { error: 'বিজনেসের নাম দিন' },
          { status: 400 }
        )
      }

      idType = VALID_ID_TYPES.includes(body?.idType) ? body.idType : null
      if (!idType) {
        return NextResponse.json(
          { error: 'NID অথবা ট্রেড লাইসেন্স — যাচাইয়ের ধরন বেছে নিন' },
          { status: 400 }
        )
      }

      idNumber = typeof body?.idNumber === 'string' ? body.idNumber.trim() : ''
      if (!idNumber || idNumber.length < 4) {
        return NextResponse.json(
          { error: 'সঠিক নম্বর লিখুন (কমপক্ষে ৪ অক্ষর)' },
          { status: 400 }
        )
      }

      documentImage = typeof body?.documentImage === 'string' && body.documentImage.trim()
        ? body.documentImage.trim()
        : null
    }

    if (user.isSeller && applicationType === 'personal') {
      return NextResponse.json(
        { error: 'আপনি ইতিমধ্যেই একজন সেলার' },
        { status: 400 }
      )
    }

    const existing = await withSellerRoleColumns(() =>
      withVerificationColumn(() =>
        db.sellerApplication.findFirst({
          where: { userId, status: 'pending' },
        })
      )
    )
    if (existing) {
      return NextResponse.json(
        { error: 'আপনার আবেদন ইতিমধ্যে পেন্ডিং আছে', pending: true },
        { status: 400 }
      )
    }

    await ensureVerificationColumn()
    await ensureSellerRoleColumns()

    const verificationCode = applicationType === 'personal' ? generateVerificationCode() : null

    await db.sellerApplication.create({
      data: {
        userId,
        businessName: applicationType === 'business' ? businessName : '',
        email: user.email || '',
        phone: user.phone || '',
        whatsappNumber: wa,
        verificationCode,
        applicationType,
        idType,
        idNumber,
        documentImage,
        status: 'pending',
      },
    })

    // Notify all admins about the new seller request (fire-and-forget)
    notifyAdmins({
      type: 'seller_request',
      title: 'নতুন সেলার রিকোয়েস্ট',
      message: `${user.name || 'একজন ইউজার'} সেলার রিকোয়েস্ট জমা দিয়েছেন।`,
      relatedType: 'seller_application',
    }).catch(() => {})

    // SECURITY: for personal applications the code is NEVER returned to the user
    // and never appears in any user-facing response. Only the admin can see it in
    // the Admin Panel and sends it to the user's WhatsApp number manually.
    // Business applications carry no code — the admin verifies the NID/licence
    // documents directly and approves from the Admin Panel.
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Become seller error:', err)
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const application = await withSellerRoleColumns(() =>
      withVerificationColumn(() =>
        db.sellerApplication.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            applicationType: true,
            createdAt: true,
          },
        })
      )
    )

    return NextResponse.json({ application })
  } catch (err) {
    console.error('Get seller application error:', err)
    return NextResponse.json(
      { error: 'সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
