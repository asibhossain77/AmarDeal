import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

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
        businessName: true, businessBio: true,
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

    return NextResponse.json({
      user,
      business: application ? { name: application.businessName, email: application.email, phone: application.phone } : null,
      productCount,
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

    const body = await req.json()
    const { businessName, businessBio, name } = body

    // Verify user is a seller
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isSeller: true },
    })
    if (!user || !user.isSeller) {
      return NextResponse.json({ error: 'সেলার অনুমোদিত নয়' }, { status: 403 })
    }

    // Build update data
    const updateData: Record<string, string | null> = {}
    if (typeof businessName === 'string') {
      updateData.businessName = businessName.trim() || null
    }
    if (typeof businessBio === 'string') {
      updateData.businessBio = businessBio.trim() || null
    }
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'আপডেট করার মতো কোনো তথ্য নেই' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, businessName: true, businessBio: true },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    console.error('[SELLER PROFILE PUT] Error:', err)
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
