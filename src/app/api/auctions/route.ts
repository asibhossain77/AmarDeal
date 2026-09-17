import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'
import {
  finalizeExpiredAuctions,
  maskName,
} from '@/lib/auction'
import { isAuctionMigrationError } from '@/lib/auction'

const VALID_CATEGORIES = [
  'design',
  'development',
  'content',
  'marketing',
  'education',
  'software',
  'social_media',
  'id',
  'other',
] as const

const MIN_DURATION_MS = 10 * 60 * 1000        // ≥ 10 minutes
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // ≤ 30 days
const MAX_START_PRICE = 10_000_000

/* ═══════════════════════════════════════════════════════════════
   POST /api/auctions — create a new auction (seller only)
   Body: { title, description, category, startPrice, endsAt, image? }
   ═══════════════════════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response

    const user = await db.user.findUnique({
      where: { id: guard.userId },
      select: { id: true, isSeller: true, sellerDisabled: true },
    })
    if (!user?.isSeller || user.sellerDisabled) {
      return NextResponse.json({ error: 'নিলাম তৈরি করতে সেলার অ্যাকাউন্ট প্রয়োজন' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'অবৈধ অনুরোধ' }, { status: 400 })

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const category = typeof body.category === 'string' ? body.category : 'other'
    const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null
    const startPrice = Number(body.startPrice)
    const endsAtRaw = typeof body.endsAt === 'string' ? new Date(body.endsAt) : null

    if (title.length < 3 || title.length > 150) {
      return NextResponse.json({ error: 'শিরোনাম ৩ থেকে ১৫০ অক্ষরের মধ্যে দিন' }, { status: 400 })
    }
    if (description.length < 10 || description.length > 5000) {
      return NextResponse.json({ error: 'বিবরণ ১০ থেকে ৫০০০ অক্ষরের মধ্যে দিন' }, { status: 400 })
    }
    if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return NextResponse.json({ error: 'সঠিক ক্যাটাগরি নির্বাচন করুন' }, { status: 400 })
    }
    if (!Number.isFinite(startPrice) || startPrice < 1 || startPrice > MAX_START_PRICE) {
      return NextResponse.json({ error: 'শুরুর মূল্য অবশ্যই ১ টাকা থেকে ১,০০০,০০০ টাকার মধ্যে হতে হবে' }, { status: 400 })
    }
    if (!endsAtRaw || isNaN(endsAtRaw.getTime())) {
      return NextResponse.json({ error: 'নিলাম শেষ হওয়ার সময় দিন' }, { status: 400 })
    }
    const now = Date.now()
    const endsAtMs = endsAtRaw.getTime()
    if (endsAtMs < now + MIN_DURATION_MS) {
      return NextResponse.json({ error: 'নিলামের সময় কমপক্ষে ১০ মিনিট পরে দিন' }, { status: 400 })
    }
    if (endsAtMs > now + MAX_DURATION_MS) {
      return NextResponse.json({ error: 'নিলামের সময় সর্বোচ্চ ৩০ দিন পর্যন্ত হতে পারে' }, { status: 400 })
    }

    const auction = await db.auction.create({
      data: {
        title,
        description,
        category,
        image,
        startPrice: Math.round(startPrice * 100) / 100,
        endsAt: endsAtRaw,
        sellerId: user.id,
      },
    })

    return NextResponse.json({ success: true, id: auction.id }, { status: 201 })
  } catch (err) {
    if (isAuctionMigrationError(err)) {
      return NextResponse.json({ error: 'নিলাম সিস্টেম এখনো প্রস্তুত হয়নি — কিছুক্ষণ পর আবার চেষ্টা করুন' }, { status: 503 })
    }
    console.error('[AUCTIONS POST] error:', err)
    return NextResponse.json({ error: 'নিলাম তৈরি করা যায়নি' }, { status: 500 })
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/auctions?status=active|ended — public list.
   Lazy-finalizes expired auctions first so the list is always true.
   ═══════════════════════════════════════════════════════════════ */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') === 'ended' ? 'ended' : 'active'

    await finalizeExpiredAuctions()

    const where =
      status === 'active'
        ? { status: 'active' }
        : { status: { in: ['sold', 'ended'] } }

    let auctions
    try {
      auctions = await db.auction.findMany({
        where,
        include: { seller: { select: { id: true, name: true, imageLink: true } } },
        orderBy: { createdAt: 'desc' },
        take: 60,
      })
    } catch (err) {
      if (isAuctionMigrationError(err)) {
        auctions = []
      } else throw err
    }

    return NextResponse.json({
      success: true,
      auctions: auctions.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        image: a.image,
        startPrice: a.startPrice,
        currentPrice: a.currentPrice,
        bidCount: a.bidCount,
        status: a.status,
        endsAt: a.endsAt,
        createdAt: a.createdAt,
        seller: { id: a.seller.id, name: maskName(a.seller.name), imageLink: a.seller.imageLink },
      })),
    })
  } catch (err) {
    console.error('[AUCTIONS GET] error:', err)
    return NextResponse.json({ error: 'নিলাম লোড করা যায়নি' }, { status: 500 })
  }
}
