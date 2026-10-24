import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { logAdminAction } from '@/lib/order-protection'

/**
 * Phase 8 — Review moderation.
 *
 * GET   /api/admin/review-moderation  → reports + reviews + audit trail + stats
 * PATCH /api/admin/review-moderation  → moderation actions:
 *   { reviewId, action: 'hide' | 'restore' | 'remove_reply', note? }
 *   { reportId, action: 'resolve_report', resolution: 'hide_review' | 'keep_review' | 'dismiss', note? }
 *
 * Sellers can never delete reviews — only admins can hide/restore, and every
 * action is written to AdminAuditLog via logAdminAction (targetType 'review').
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') // 'published' | 'hidden' | null = all

    const reports = await db.reviewReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        review: {
          include: {
            user: { select: { id: true, name: true, imageLink: true } },
            seller: { select: { id: true, name: true, businessName: true } },
          },
        },
        reporter: { select: { id: true, name: true } },
      },
    })

    const reviews = await db.sellerReview.findMany({
      where: statusFilter === 'published' || statusFilter === 'hidden'
        ? { status: statusFilter }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, imageLink: true } },
        seller: { select: { id: true, name: true, businessName: true } },
        order: { select: { id: true, orderNumber: true, serviceName: true } },
      },
    })

    const logs = await db.adminAuditLog.findMany({
      where: { targetType: 'review' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const [openReports, hiddenReviews, totalReviews] = await Promise.all([
      db.reviewReport.count({ where: { status: 'open' } }),
      db.sellerReview.count({ where: { status: 'hidden' } }),
      db.sellerReview.count(),
    ])

    return NextResponse.json({
      reports: reports.map(r => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        resolution: r.resolution,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        reporter: r.reporter,
        review: r.review ? {
          id: r.review.id,
          rating: r.review.rating,
          comment: r.review.comment,
          status: r.review.status,
          sellerReply: r.review.sellerReply,
          createdAt: r.review.createdAt,
          user: r.review.user,
          seller: r.review.seller,
        } : null,
      })),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        sellerReply: r.sellerReply,
        sellerReplyAt: r.sellerReplyAt,
        createdAt: r.createdAt,
        user: r.user,
        seller: r.seller,
        order: r.order ? { id: r.order.id, orderNumber: r.order.orderNumber, title: r.order.serviceName } : null,
      })),
      logs: logs.map(l => ({
        id: l.id,
        reviewId: l.targetId,
        action: l.action,
        adminName: l.adminName,
        note: l.details,
        createdAt: l.createdAt,
      })),
      stats: { openReports, hiddenReviews, totalReviews },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load moderation data' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response
    const admin = guard.admin

    const body = await req.json().catch(() => null)
    const { reviewId, reportId, action, resolution, note } = body || {}
    const adminName = admin.user?.name || 'Admin'

    // ── Review-level actions ──
    if (reviewId && typeof action === 'string') {
      const review = await db.sellerReview.findUnique({
        where: { id: reviewId },
        select: { id: true, status: true, sellerReply: true },
      })
      if (!review) {
        return NextResponse.json({ error: 'রিভিউ পাওয়া যায়নি' }, { status: 404 })
      }

      if (action === 'hide') {
        if (review.status === 'hidden') {
          return NextResponse.json({ error: 'রিভিউ ইতিমধ্যে লুকানো আছে' }, { status: 409 })
        }
        await db.sellerReview.update({ where: { id: reviewId }, data: { status: 'hidden' } })
        await logAdminAction({
          adminId: admin.userId,
          adminName,
          action: 'review_hidden',
          targetType: 'review',
          targetId: reviewId,
          details: note ? { note } : null,
        })
        return NextResponse.json({ success: true, review: { id: reviewId, status: 'hidden' } })
      }

      if (action === 'restore') {
        if (review.status !== 'hidden') {
          return NextResponse.json({ error: 'রিভিউ বর্তমানে লুকানো নেই' }, { status: 409 })
        }
        await db.sellerReview.update({ where: { id: reviewId }, data: { status: 'published' } })
        await logAdminAction({
          adminId: admin.userId,
          adminName,
          action: 'review_restored',
          targetType: 'review',
          targetId: reviewId,
          details: note ? { note } : null,
        })
        return NextResponse.json({ success: true, review: { id: reviewId, status: 'published' } })
      }

      if (action === 'remove_reply') {
        if (!review.sellerReply) {
          return NextResponse.json({ error: 'এই রিভিউতে কোনো সেলার উত্তর নেই' }, { status: 409 })
        }
        await db.sellerReview.update({
          where: { id: reviewId },
          data: { sellerReply: null, sellerReplyAt: null },
        })
        await logAdminAction({
          adminId: admin.userId,
          adminName,
          action: 'review_reply_removed',
          targetType: 'review',
          targetId: reviewId,
          details: note ? { note } : null,
        })
        return NextResponse.json({ success: true })
      }

      return NextResponse.json({ error: 'অবৈধ অ্যাকশন' }, { status: 400 })
    }

    // ── Report resolution ──
    if (reportId && action === 'resolve_report') {
      const report = await db.reviewReport.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, reviewId: true },
      })
      if (!report) {
        return NextResponse.json({ error: 'রিপোর্ট পাওয়া যায়নি' }, { status: 404 })
      }
      if (report.status !== 'open') {
        return NextResponse.json({ error: 'রিপোর্টটি ইতিমধ্যে নিষ্পত্তি হয়েছে' }, { status: 409 })
      }

      const validResolutions = ['hide_review', 'keep_review', 'dismiss']
      if (!validResolutions.includes(resolution)) {
        return NextResponse.json({ error: 'অবৈধ রেজোলিউশন' }, { status: 400 })
      }

      const reportStatus = resolution === 'dismiss' ? 'dismissed' : 'resolved'
      const resolutionLabel =
        resolution === 'hide_review' ? 'review_hidden' :
        resolution === 'keep_review' ? 'review_kept' : 'dismissed'

      await db.reviewReport.update({
        where: { id: reportId },
        data: {
          status: reportStatus,
          resolution: resolutionLabel,
          adminNote: typeof note === 'string' ? note.slice(0, 500) : null,
          reviewedAt: new Date(),
        },
      })

      if (resolution === 'hide_review' && report.reviewId) {
        await db.sellerReview.update({
          where: { id: report.reviewId },
          data: { status: 'hidden' },
        })
        await logAdminAction({
          adminId: admin.userId,
          adminName,
          action: 'review_hidden',
          targetType: 'review',
          targetId: report.reviewId,
          details: { source: 'report', reportId, note: note || 'রিপোর্ট যাচাইপূর্বক রিভিউ লুকানো হয়েছে' },
        })
      } else {
        await logAdminAction({
          adminId: admin.userId,
          adminName,
          action: `report_${reportStatus}`,
          targetType: 'review',
          targetId: report.reviewId || reportId,
          details: { reportId, resolution: resolutionLabel, note: note || null },
        })
      }

      return NextResponse.json({ success: true, reportId, status: reportStatus })
    }

    return NextResponse.json({ error: 'অবৈধ অনুরোধ' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'মডারেশন অ্যাকশন ব্যর্থ হয়েছে' }, { status: 500 })
  }
}
