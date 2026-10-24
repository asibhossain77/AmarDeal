import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

/** Store categories mirror the product category list used across the marketplace */
const STORE_CATEGORIES = [
  'design', 'development', 'content', 'marketing',
  'education', 'software', 'social_media', 'id', 'other',
] as const

type StoreCategory = (typeof STORE_CATEGORIES)[number]

function isSafeImageUrl(url: string): boolean {
  return /^\/cdn\//.test(url) || /^https?:\/\//.test(url)
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true,
        imageLink: true, isSeller: true,
        sellerRole: true, businessVerified: true,
        businessName: true, businessBio: true,
        businessCategory: true, storeLogo: true, publicContact: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const application = await db.sellerApplication.findFirst({
      where: { userId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      select: { businessName: true, email: true, phone: true },
    })

    const productCount = await db.digitalProduct.count({ where: { sellerId: userId } })

    // Pending verified store-name change request (needs admin approval — Phase 8)
    const pendingRequest = await db.storeChangeRequest.findFirst({
      where: { sellerId: userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, changes: true, createdAt: true },
    })

    let pendingNameChange: { id: string; businessName: string; createdAt: Date } | null = null
    if (pendingRequest) {
      try {
        const parsed = JSON.parse(pendingRequest.changes)
        if (typeof parsed?.businessName === 'string') {
          pendingNameChange = {
            id: pendingRequest.id,
            businessName: parsed.businessName,
            createdAt: pendingRequest.createdAt,
          }
        }
      } catch { /* malformed request row — ignore */ }
    }

    return NextResponse.json({
      user,
      business: application ? { name: application.businessName, email: application.email, phone: application.phone } : null,
      productCount,
      pendingNameChange,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const body = await req.json().catch(() => null)
    const {
      businessName, businessBio, name,
      businessCategory, storeLogo, publicContact,
    } = body || {}

    // Verify user is a seller
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isSeller: true, sellerRole: true, businessVerified: true, businessName: true },
    })
    if (!user || !user.isSeller) {
      return NextResponse.json({ error: 'সেলার অনুমোদিত নয়' }, { status: 403 })
    }

    // Business profile + storefront fields are a Verified Business Seller
    // feature — personal sellers cannot set or change them.
    const isBusinessSeller = user.sellerRole === 'business' && user.businessVerified
    const wantsBusinessFields =
      (typeof businessName === 'string' && businessName.trim()) ||
      (typeof businessBio === 'string' && businessBio.trim()) ||
      businessCategory !== undefined ||
      storeLogo !== undefined ||
      publicContact !== undefined
    if (wantsBusinessFields && !isBusinessSeller) {
      return NextResponse.json(
        { error: 'বিজনেস প্রোফাইল সম্পাদনা করতে ভেরিফায়েড বিজনেস সেলার হতে হবে' },
        { status: 403 }
      )
    }

    // Build update data (self-serve fields apply immediately)
    const updateData: Record<string, string | null> = {}
    if (typeof businessBio === 'string') {
      const bio = businessBio.trim()
      if (bio.length > 2000) {
        return NextResponse.json({ error: 'বিবরণ খুব দীর্ঘ (সর্বোচ্চ ২০০০ অক্ষর)' }, { status: 400 })
      }
      updateData.businessBio = bio || null
    }
    if (businessCategory !== undefined) {
      if (businessCategory === null || businessCategory === '') {
        updateData.businessCategory = null
      } else if (typeof businessCategory === 'string' && STORE_CATEGORIES.includes(businessCategory as StoreCategory)) {
        updateData.businessCategory = businessCategory
      } else {
        return NextResponse.json({ error: 'অবৈধ ক্যাটাগরি' }, { status: 400 })
      }
    }
    if (storeLogo !== undefined) {
      if (storeLogo === null || storeLogo === '') {
        updateData.storeLogo = null
      } else if (typeof storeLogo === 'string' && isSafeImageUrl(storeLogo) && storeLogo.length <= 500) {
        updateData.storeLogo = storeLogo
      } else {
        return NextResponse.json({ error: 'অবৈধ লোগো URL' }, { status: 400 })
      }
    }
    if (publicContact !== undefined) {
      const contact = typeof publicContact === 'string' ? publicContact.trim() : ''
      if (contact.length > 200) {
        return NextResponse.json({ error: 'যোগাযোগ তথ্য খুব দীর্ঘ (সর্বোচ্চ ২০০ অক্ষর)' }, { status: 400 })
      }
      updateData.publicContact = contact || null
    }
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }

    // ── Verified business identity (store name) changes REQUIRE admin approval ──
    let nameChangePending = false
    if (typeof businessName === 'string') {
      const proposed = businessName.trim()
      const current = user.businessName || ''
      if (proposed !== current) {
        if (proposed.length > 100) {
          return NextResponse.json({ error: 'স্টোরের নাম খুব দীর্ঘ (সর্বোচ্চ ১০০ অক্ষর)' }, { status: 400 })
        }
        // One pending request per seller — replace an existing pending request
        const existingPending = await db.storeChangeRequest.findFirst({
          where: { sellerId: userId, status: 'pending' },
          select: { id: true },
        })
        if (existingPending) {
          await db.storeChangeRequest.update({
            where: { id: existingPending.id },
            data: { changes: JSON.stringify({ businessName: proposed }), createdAt: new Date() },
          })
        } else {
          await db.storeChangeRequest.create({
            data: {
              sellerId: userId,
              changes: JSON.stringify({ businessName: proposed }),
              status: 'pending',
            },
          })
        }
        nameChangePending = true
      }
    }

    const hasDirectChanges = Object.keys(updateData).length > 0
    if (!hasDirectChanges && !nameChangePending) {
      return NextResponse.json({ error: 'আপডেট করার মতো কোনো তথ্য নেই' }, { status: 400 })
    }

    const updated = hasDirectChanges
      ? await db.user.update({
          where: { id: userId },
          data: updateData,
          select: {
            id: true, name: true, businessName: true, businessBio: true,
            businessCategory: true, storeLogo: true, publicContact: true,
          },
        })
      : null

    return NextResponse.json({
      success: true,
      user: updated ?? { id: userId, name: (updateData.name as string) || undefined },
      nameChangePending,
      message: nameChangePending
        ? 'স্টোরের নাম পরিবর্তনের অনুরোধ জমা হয়েছে — অ্যাডমিন অনুমোদনের পরে প্রকাশিত হবে'
        : undefined,
    })
  } catch (err) {
    console.error('[SELLER PROFILE PUT] Error:', err)
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
