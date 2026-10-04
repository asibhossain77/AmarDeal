import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'
import { uploadSvgToR2, deleteFromR2 } from '@/lib/r2'
import { validateSvgLogoUpload } from '@/lib/svg-logo'

/**
 * Brand logo upload (Admin Panel → Website Settings → Logo Settings).
 *
 * Two independent variants:
 *   light → PlatformSetting `site_logo_light` (light theme surfaces)
 *   dark  → PlatformSetting `site_logo_dark`  (dark theme surfaces)
 *
 * The FOOTER never needs its own upload: it always renders the dark
 * variant (its background is permanently dark) — handled by MidmanLogo.
 *
 * Storage follows the site's existing asset architecture: the sanitized
 * SVG goes to R2 (`logos/<ts>-<rand>.svg`, unique key, immutable cache)
 * and only the /cdn/ proxy URL is persisted in the PlatformSetting KV
 * store. Replaces the legacy single-logo flow (which stored any file
 * type unchecked into `site_logo` — that key stays untouched for the
 * favicon / JSON-LD consumers).
 *
 * DELETE ?variant=light|dark resets a variant to the bundled default
 * (deletes the setting row + best-effort R2 cleanup).
 */

const VARIANT_KEYS = {
  light: 'site_logo_light',
  dark: 'site_logo_dark',
} as const

type Variant = keyof typeof VARIANT_KEYS

function parseVariant(value: unknown): Variant | null {
  return value === 'light' || value === 'dark' ? value : null
}

function isStoredLogoUrl(url: string): boolean {
  // Only URLs this endpoint created are deletable — bundled defaults
  // (/brand/…) and legacy values never resolve to an R2 key.
  return url.startsWith('/cdn/logos/')
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const formData = await req.formData()
    const file = formData.get('logo') as File | null
    const variant = parseVariant(formData.get('variant'))

    if (!variant) {
      return NextResponse.json(
        { error: "variant হতে হবে 'light' অথবা 'dark'" },
        { status: 400 },
      )
    }
    if (!file) {
      return NextResponse.json({ error: 'Logo file required' }, { status: 400 })
    }

    // Type/size gate + content sanitization (scripts, event handlers,
    // foreignObject, dangerous URI schemes are stripped here).
    let svgText: string
    try {
      svgText = await validateSvgLogoUpload(file)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'অবৈধ SVG ফাইল'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Upload FIRST, then swap the pointer, then clean up the old object —
    // a failed upload must never leave the site without its previous logo.
    const result = await uploadSvgToR2(svgText, 'logos')

    const key = VARIANT_KEYS[variant]
    const old = await db.platformSetting.findUnique({ where: { key } })
    await db.platformSetting.upsert({
      where: { key },
      update: { value: result.url },
      create: { key, value: result.url },
    })
    if (old?.value && isStoredLogoUrl(old.value)) {
      await deleteFromR2(old.value)
    }

    return NextResponse.json({
      success: true,
      variant,
      logoPath: result.url,
      message: 'Logo updated successfully',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const variant = parseVariant(new URL(req.url).searchParams.get('variant'))
    if (!variant) {
      return NextResponse.json(
        { error: "variant হতে হবে 'light' অথবা 'dark'" },
        { status: 400 },
      )
    }

    const key = VARIANT_KEYS[variant]
    const old = await db.platformSetting.findUnique({ where: { key } })
    if (!old) {
      // Already on the bundled default — idempotent reset.
      return NextResponse.json({ success: true, variant, message: 'Logo reset to default' })
    }

    await db.platformSetting.delete({ where: { key } })
    if (isStoredLogoUrl(old.value)) {
      await deleteFromR2(old.value)
    }

    return NextResponse.json({ success: true, variant, message: 'Logo reset to default' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logo reset failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
