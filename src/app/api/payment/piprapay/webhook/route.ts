import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[PIPRAPAY] Webhook received:', JSON.stringify(body))

    const ppId = body.pp_id
    if (!ppId) {
      console.error('[PIPRAPAY] Webhook missing pp_id')
      return NextResponse.json({ error: 'Missing pp_id' }, { status: 400 })
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
      console.error('[PIPRAPAY] Webhook: API key not configured')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Verify payment with PipraPay
    const verifyRes = await fetch(`${baseUrl}/api/verify-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MHS-PIPRAPAY-API-KEY': apiKey,
      },
      body: JSON.stringify({ pp_id: ppId }),
    })

    const verifyData = await verifyRes.json()
    console.log('[PIPRAPAY] Verify response:', JSON.stringify(verifyData))

    if (!verifyRes.ok || !verifyData.success) {
      console.error('[PIPRAPAY] Verification failed:', verifyData)
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    // Find deal by metadata.deal_id or transactionId
    const dealId = body.metadata?.deal_id
    let deal
    if (dealId) {
      deal = await db.deal.findUnique({ where: { id: dealId } })
    } else {
      // Fallback: find by transactionId matching pp_id
      deal = await db.deal.findFirst({ where: { transactionId: ppId } })
    }

    if (!deal) {
      console.error('[PIPRAPAY] Webhook: deal not found for pp_id:', ppId)
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Update deal status
    await db.deal.update({
      where: { id: deal.id },
      data: {
        status: 'payment_verified',
        transactionId: ppId,
      },
    })

    console.log('[PIPRAPAY] Deal', deal.id, 'marked as payment_verified via webhook')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PIPRAPAY] Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
