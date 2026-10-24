import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

const REPORT_REASONS = ['abusive', 'fraudulent', 'irrelevant', 'spam', 'other'] as const

/**
 * POST /api/seller-review/[reviewId]/report — report an abusive/fraudulent/irrelevant review.
 * Logged-in users only; one open report per reporter per review.
 * Sellers cannot delete reviews via this — reports go to admin moderation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { reviewId } = await params

    const review = await db.sellerReview.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true },
    })
    if (!review) {
      return NextResponse.json({ error: 'রিভিউ পাওয়া যায়নি' }, { status: 404 })
    }
    if (review.userId === userId) {
      return NextResponse.json({ error: 'আপনি নিজের রিভিউ রিপোর্ট করতে পারবেন না' }, { status: 400 })
    }

    const body = await req.json().catch(() => null)
    const reason = body?.reason
    const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 500) : null

    if (!reason || !REPORT_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'রিপোর্টের কারণ নির্বাচন করুন' }, { status: 400 })
    }

    // One open report per reporter per review — prevents report spam
    const existingOpen = await db.reviewReport.findFirst({
      where: { reviewId, reporterId: userId, status: 'open' },
      select: { id: true },
    })
    if (existingOpen) {
      return NextResponse.json(
        { error: 'আপনি ইতিমধ্যে এই রিভিউটি রিপোর্ট করেছেন। অ্যাডমিন শীঘ্রই দেখে নেবেন।' },
        { status: 409 },
      )
    }

    const report = await db.reviewReport.create({
      data: {
        reviewId,
        reporterId: userId,
        reason,
        details: details || null,
        status: 'open',
      },
      select: { id: true, status: true, createdAt: true },
    })

    return NextResponse.json({
      success: true,
      message: 'রিপোর্ট জমা হয়েছে। অ্যাডমিন টিম পর্যালোচনা করবে।',
      report,
    })
  } catch {
    return NextResponse.json({ error: 'রিপোর্ট জমা দিতে সমস্যা হয়েছে' }, { status: 500 })
  }
}
