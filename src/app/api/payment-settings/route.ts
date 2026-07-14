import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public endpoint: returns payment theme color and fee settings
export async function GET() {
  try {
    const settings = await db.platformSetting.findMany({
      where: {
        key: {
          in: ['payment_theme_color', 'fee_percentage', 'platform_name'],
        },
      },
    })

    const map: Record<string, string> = {
      payment_theme_color: '#84CC16',
      fee_percentage: '3',
      platform_name: 'আমার ডিল',
    }

    for (const s of settings) {
      map[s.key] = s.value
    }

    return NextResponse.json({
      paymentThemeColor: map.payment_theme_color,
      feePercentage: parseFloat(map.fee_percentage) || 3,
      platformName: map.platform_name,
    })
  } catch {
    return NextResponse.json(
      { paymentThemeColor: '#84CC16', feePercentage: 3, platformName: 'আমার ডিল' },
      { status: 200 }
    )
  }
}