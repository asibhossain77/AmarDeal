import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const body = await req.json()
    const { pp_id } = body

    if (!pp_id) {
      return NextResponse.json(
        { error: 'pp_id প্রদান করুন' },
        { status: 400 }
      )
    }

    const { db } = await import('@/lib/db')

    // Load PipraPay settings
    const settings = await db.platformSetting.findMany({
      where: {
        key: { in: ['piprapay_api_key', 'piprapay_base_url'] },
      },
    })
    const settingsMap: Record<string, string> = {}
    for (const s of settings) settingsMap[s.key] = s.value

    const apiKey = settingsMap['piprapay_api_key']
    const baseUrl = settingsMap['piprapay_base_url'] || 'https://sandbox.piprapay.com'

    if (!apiKey) {
      return NextResponse.json(
        { error: 'PipraPay API কী কনফিগার করা হয়নি' },
        { status: 500 }
      )
    }

    // Call PipraPay Verify API
    const verifyRes = await fetch(`${baseUrl}/api/verify-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MHS-PIPRAPAY-API-KEY': apiKey,
      },
      body: JSON.stringify({ pp_id }),
    })

    const verifyData = await verifyRes.json()
    console.log('[PIPRAPAY] Manual verify response:', JSON.stringify(verifyData))

    if (!verifyRes.ok || !verifyData.success) {
      return NextResponse.json(
        { error: 'পেমেন্ট ভেরিফিকেশন ব্যর্থ হয়েছে' },
        { status: 400 }
      )
    }

    // Find deal by transactionId matching pp_id
    const deal = await db.deal.findFirst({
      where: { transactionId: pp_id },
    })

    if (!deal) {
      return NextResponse.json(
        { error: 'এই পেমেন্টের জন্য কোনো ডিল পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Update deal status
    const updated = await db.deal.update({
      where: { id: deal.id },
      data: {
        status: 'payment_verified',
        transactionId: pp_id,
      },
    })

    return NextResponse.json({
      success: true,
      status: updated.status,
    })
  } catch (err) {
    console.error('[PIPRAPAY] Verify error:', err)
    return NextResponse.json(
      { error: 'পেমেন্ট ভেরিফাই করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}
