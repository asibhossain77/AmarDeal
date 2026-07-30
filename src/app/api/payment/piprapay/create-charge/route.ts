import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json()
    const { dealId } = body

    if (!dealId) {
      return NextResponse.json(
        { error: 'ডিল আইডি প্রদান করুন' },
        { status: 400 }
      )
    }

    const { db } = await import('@/lib/db')

    // Check deal exists and is in correct state
    const deal = await db.deal.findUnique({ where: { id: dealId } })
    if (!deal) {
      return NextResponse.json({ error: 'ডিল পাওয়া যায়নি' }, { status: 404 })
    }
    if (deal.status !== 'created') {
      return NextResponse.json(
        { error: 'এই ডিলে পেমেন্ট করা সম্ভব নয়' },
        { status: 400 }
      )
    }
    if (deal.buyerId !== userId) {
      return NextResponse.json(
        { error: 'আপনি এই ডিলের ক্রেতা নন' },
        { status: 403 }
      )
    }

    // Load PipraPay settings from PlatformSetting
    const settings = await db.platformSetting.findMany({
      where: {
        key: { in: ['piprapay_api_key', 'piprapay_base_url', 'piprapay_enabled'] },
      },
    })
    const settingsMap: Record<string, string> = {}
    for (const s of settings) settingsMap[s.key] = s.value

    const apiKey = settingsMap['piprapay_api_key']
    const baseUrl = settingsMap['piprapay_base_url'] || 'https://sandbox.piprapay.com'
    const enabled = settingsMap['piprapay_enabled'] === 'true'

    if (!enabled) {
      return NextResponse.json(
        { error: 'PipraPay পেমেন্ট বর্তমানে নিষ্ক্রিয় আছে' },
        { status: 403 }
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'PipraPay API কী কনফিগার করা হয়নি' },
        { status: 500 }
      )
    }

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || ''

    // Call PipraPay Create Charge API
    const chargeBody = {
      full_name: user?.name || '',
      email_mobile: user?.email || '',
      amount: String(deal.amount),
      redirect_url: `${appUrl}/api/payment/piprapay/success`,
      return_type: 'GET',
      cancel_url: `${appUrl}/api/payment/piprapay/cancel`,
      webhook_url: `${appUrl}/api/payment/piprapay/webhook`,
      currency: 'BDT',
      metadata: { deal_id: deal.id },
    }

    console.log('[PIPRAPAY] Creating charge:', { dealId: deal.id, amount: deal.amount })

    const pipraRes = await fetch(`${baseUrl}/api/create-charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MHS-PIPRAPAY-API-KEY': apiKey,
      },
      body: JSON.stringify(chargeBody),
    })

    const pipraData = await pipraRes.json()
    console.log('[PIPRAPAY] Create charge response:', pipraData)

    if (!pipraRes.ok) {
      console.error('[PIPRAPAY] Create charge failed:', pipraData)
      return NextResponse.json(
        { error: 'PipraPay চার্জ তৈরি করতে সমস্যা হয়েছে' },
        { status: 502 }
      )
    }

    // Update deal status and store transaction ID
    await db.deal.update({
      where: { id: dealId },
      data: {
        status: 'payment_pending',
        transactionId: pipraData.invoice_id,
        paymentAmount: deal.amount,
      },
    })

    return NextResponse.json({
      success: true,
      redirect_url: pipraData.redirect_url,
      invoice_id: pipraData.invoice_id,
    })
  } catch (err) {
    console.error('[PIPRAPAY] Create charge error:', err)
    return NextResponse.json(
      { error: 'PipraPay পেমেন্ট শুরু করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
