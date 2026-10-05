import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

/** Lightweight SVG content validation — SVG must actually contain an <svg> root and no scripts (XSS guard) */
function validateSvgContent(text: string): string | null {
  if (!/<svg[\s>]/i.test(text)) {
    return 'Invalid SVG file — no <svg> root element found'
  }
  if (/<script[\s>]/i.test(text) || /javascript:/i.test(text) || /on(?:load|error|click|mouseover)\s*=/i.test(text)) {
    return 'SVG contains script content, which is not allowed'
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Logo file required' }, { status: 400 })
    }

    const isSvg =
      file.type === 'image/svg+xml' ||
      (!file.type && file.name.toLowerCase().endsWith('.svg'))

    // SVG is a first-class logo format — sniff the CONTENT, not just the extension
    if (isSvg) {
      const text = await file.text()
      const svgError = validateSvgContent(text)
      if (svgError) {
        return NextResponse.json({ error: svgError }, { status: 400 })
      }
    } else if (file.name.toLowerCase().endsWith('.svg')) {
      return NextResponse.json(
        { error: 'Invalid SVG file' },
        { status: 400 }
      )
    }

    // Upload FIRST — only after a successful upload do we delete the old logo,
    // so a failed upload never leaves the site without its current logo.
    const result = await uploadToR2(file, 'logos', { allowSvg: true })

    const old = await db.platformSetting.findUnique({ where: { key: 'site_logo' } })
    if (old?.value && old.value !== result.url) {
      await deleteFromR2(old.value)
    }

    await db.platformSetting.upsert({
      where: { key: 'site_logo' },
      update: { value: result.url },
      create: { key: 'site_logo', value: result.url },
    })

    return NextResponse.json({
      success: true,
      logoPath: result.url,
      message: 'Logo updated successfully',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
