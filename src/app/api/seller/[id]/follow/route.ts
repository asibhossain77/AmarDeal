import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerId } = await params
    const session = req.cookies.get('midman_session')
    if (!session?.value) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const userId = session.value
    if (userId === sellerId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    // Verify seller exists
    const seller = await db.user.findUnique({
      where: { id: sellerId },
      select: { isSeller: true, sellerDisabled: true },
    })
    if (!seller?.isSeller || seller.sellerDisabled) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    const existing = await db.sellerFollower.findUnique({
      where: { sellerId_followerId: { sellerId, followerId: userId } },
    })

    if (existing) {
      await db.sellerFollower.delete({ where: { id: existing.id } })
      const count = await db.sellerFollower.count({ where: { sellerId } })
      return NextResponse.json({ following: false, followerCount: count })
    } else {
      await db.sellerFollower.create({ data: { sellerId, followerId: userId } })
      const count = await db.sellerFollower.count({ where: { sellerId } })
      return NextResponse.json({ following: true, followerCount: count })
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
