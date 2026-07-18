import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { generateSecret, generateQRDataURL, verifyTOTP } from '@/lib/totp'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const admin = await db.admin.findFirst({
      where: { userId: guard.admin.userId },
      include: { user: true },
    })

    if (!admin || !admin.user) {
      return NextResponse.json({ error: 'অ্যাডমিন পাওয়া যায়নি' }, { status: 404 })
    }

    if (admin.totpEnabled) {
      return NextResponse.json({ error: '2FA ইতিমধ্যে চালু আছে' }, { status: 400 })
    }

    const secret = generateSecret()

    await db.admin.update({
      where: { id: admin.id },
      data: { totpSecret: secret },
    })

    const issuer = 'AmarDeal'
    const label = `AmarDeal (%E0%A6%86%E0%A6%AE%E0%A6%BE%E0%A6%B0%E0%A6%A1%E0%A6%BF%E0%A6%B2):${admin.user.email}`
    const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`

    const qrCodeDataUrl = generateQRDataURL(otpauthUrl)

    return NextResponse.json({ secret, qrCodeDataUrl })
  } catch (err) {
    console.error('2FA setup error:', err)
    return NextResponse.json({ error: '2FA সেটআপে সমস্যা হয়েছে' }, { status: 500 })
  }
}