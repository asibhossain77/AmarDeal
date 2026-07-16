import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

const settingKeys = [
  'platform_name',
  'site_logo',
  'fee_percentage',
  'min_deal_amount',
  'max_deal_amount',
  'support_number',
  'payment_theme_color',
  'footer_description',
  'footer_copyright_text',
  'footer_made_in',
  'admin_display_name',
  'admin_image_url',
]

export async function GET() {
  try {
    const rows = await db.platformSetting.findMany({
      where: { key: { in: settingKeys } },
    })

    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return NextResponse.json({
      platform_name: map.platform_name || 'আমার ডিল',
      site_logo: map.site_logo || '/logo.png',
      fee_percentage: map.fee_percentage || '3',
      min_deal_amount: map.min_deal_amount || '100',
      max_deal_amount: map.max_deal_amount || '10000000',
      support_number: map.support_number || '',
      payment_theme_color: map.payment_theme_color || '#84CC16',
      footer_description: map.footer_description || '',
      footer_copyright_text: map.footer_copyright_text || '',
      footer_made_in: map.footer_made_in || '',
      admin_display_name: map.admin_display_name || '',
      admin_image_url: map.admin_image_url || '',
    })
  } catch {
    return NextResponse.json(
      { error: 'সেটিংস লোড করতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const body = await req.json()

    // Upsert each provided key
    for (const key of settingKeys) {
      if (body[key] !== undefined) {
        await db.platformSetting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে',
    })
  } catch {
    return NextResponse.json(
      { error: 'সেটিংস সংরক্ষণে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}