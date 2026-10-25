import { db } from '@/lib/db'
import { logAdminAction } from '@/lib/order-protection'
import { notifyUser } from '@/lib/push'
import type { AdminRecord } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   Phase 9 — shared marketplace moderation actions.

   Single source of truth for seller suspension and product
   moderation state changes. Both the dedicated admin APIs and the
   report-resolution flow call these helpers, so notifications,
   audit logs and state transitions can never diverge between the
   two entry points.

   Every action:
   - validates the current state (idempotency / transition guard)
   - writes an AdminAuditLog row (write-once, append-only)
   - notifies the affected seller (best-effort, never blocks)
   ═══════════════════════════════════════════════════════════════ */

export type ModerationResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number }

function adminName(admin: AdminRecord): string {
  return admin.user?.name || 'Admin'
}

function clip(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/* ────────────────────────────────────────────────────────────────
   SELLER ACTIONS
   ──────────────────────────────────────────────────────────────── */

async function loadSeller(sellerId: string) {
  return db.user.findUnique({
    where: { id: sellerId },
    select: {
      id: true, name: true, email: true, isSeller: true,
      sellerDisabled: true, sellerRestricted: true,
      sellerSuspendReason: true,
      admin: { select: { id: true } },
    },
  })
}

/** Temporarily suspend a seller (reversible). reason is required. */
export async function suspendSeller(
  sellerId: string,
  reason: string,
  admin: AdminRecord,
  opts: { restricted?: boolean } = {},
): Promise<ModerationResult> {
  const why = clip(reason)
  if (!why) return { ok: false, error: 'সাসপেনশনের কারণ লিখতে হবে', status: 400 }

  const seller = await loadSeller(sellerId)
  if (!seller || !seller.isSeller) {
    return { ok: false, error: 'সেলার পাওয়া যায়নি', status: 404 }
  }
  if (seller.admin) {
    return { ok: false, error: 'অ্যাডমিন অ্যাকাউন্ট সাসপেন্ড করা যাবে না', status: 400 }
  }
  if (seller.sellerDisabled && opts.restricted && seller.sellerRestricted) {
    return { ok: false, error: 'সেলার ইতিমধ্যে স্থায়ীভাবে বরখাস্ত', status: 409 }
  }

  await db.user.update({
    where: { id: sellerId },
    data: {
      sellerDisabled: true,
      sellerSuspendedAt: seller.sellerDisabled ? undefined : new Date(),
      sellerSuspendReason: why,
      ...(opts.restricted ? { sellerRestricted: true } : {}),
    },
  })

  const restricted = opts.restricted || seller.sellerRestricted
  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: opts.restricted ? 'seller_restricted' : 'seller_suspended',
    targetType: 'seller',
    targetId: sellerId,
    details: { sellerName: seller.name, sellerEmail: seller.email, reason: why, permanent: restricted },
  })

  notifyUser({
    userId: sellerId,
    type: restricted ? 'seller_restricted' : 'seller_suspended',
    title: restricted ? 'সেলার অ্যাকাউন্ট স্থায়ীভাবে বরখাস্ত' : 'সেলার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে',
    message: restricted
      ? `প্ল্যাটফর্ম নীতিমালার ভিত্তিতে আপনার সেলার অ্যাকাউন্ট স্থায়ীভাবে বরখাস্ত করা হয়েছে। কারণ: ${why}`
      : `আপনার সেলার অ্যাকাউন্ট সাময়িকভাবে সাসপেন্ড করা হয়েছে। কারণ: ${why}`,
    relatedType: 'seller_moderation',
    relatedId: sellerId,
    pushUrl: '/dashboard',
  }).catch(() => {})

  return {
    ok: true,
    message: restricted ? 'সেলার স্থায়ীভাবে বরখাস্ত করা হয়েছে' : 'সেলার সাসপেন্ড করা হয়েছে',
  }
}

/** Lift a suspension — seller can sell again. Blocked while permanently restricted. */
export async function reactivateSeller(sellerId: string, admin: AdminRecord): Promise<ModerationResult> {
  const seller = await loadSeller(sellerId)
  if (!seller || !seller.isSeller) {
    return { ok: false, error: 'সেলার পাওয়া যায়নি', status: 404 }
  }
  if (seller.sellerRestricted) {
    return { ok: false, error: 'স্থায়ী বরখাস্ত প্রত্যাহার করা হয়েছে — আগে বরখাস্ত প্রত্যাহার করুন', status: 409 }
  }
  if (!seller.sellerDisabled) {
    return { ok: false, error: 'সেলার বর্তমানে সাসপেন্ড নেই', status: 409 }
  }

  await db.user.update({
    where: { id: sellerId },
    data: { sellerDisabled: false, sellerSuspendedAt: null, sellerSuspendReason: null },
  })

  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: 'seller_reactivated',
    targetType: 'seller',
    targetId: sellerId,
    details: { sellerName: seller.name, sellerEmail: seller.email },
  })

  notifyUser({
    userId: sellerId,
    type: 'seller_reactivated',
    title: 'সেলার অ্যাকাউন্ট পুনরায় সক্রিয়',
    message: 'আপনার সেলার অ্যাকাউন্ট পুনরায় সক্রিয় করা হয়েছে। এখন আপনি আবার পণ্য বিক্রি করতে পারবেন।',
    relatedType: 'seller_moderation',
    relatedId: sellerId,
    pushUrl: '/dashboard',
  }).catch(() => {})

  return { ok: true, message: 'সেলার পুনরায় সক্রিয় করা হয়েছে' }
}

/** Lift a PERMANENT restriction (the flag itself — suspension state is untouched). */
export async function liftSellerRestriction(sellerId: string, admin: AdminRecord): Promise<ModerationResult> {
  const seller = await loadSeller(sellerId)
  if (!seller || !seller.isSeller) {
    return { ok: false, error: 'সেলার পাওয়া যায়নি', status: 404 }
  }
  if (!seller.sellerRestricted) {
    return { ok: false, error: 'এই সেলার স্থায়ীভাবে বরখাস্ত নয়', status: 409 }
  }

  await db.user.update({
    where: { id: sellerId },
    data: { sellerRestricted: false },
  })

  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: 'seller_restriction_lifted',
    targetType: 'seller',
    targetId: sellerId,
    details: { sellerName: seller.name, sellerEmail: seller.email },
  })

  return { ok: true, message: 'স্থায়ী বরখাস্ত প্রত্যাহার করা হয়েছে' }
}

/* ────────────────────────────────────────────────────────────────
   PRODUCT ACTIONS
   ──────────────────────────────────────────────────────────────── */

export type ProductModerationAction = 'approve' | 'reject' | 'unpublish' | 'remove' | 'restore'

const PRODUCT_TRANSITIONS: Record<ProductModerationAction, { from: string[]; to: string }> = {
  approve: { from: ['pending'], to: 'active' },
  reject: { from: ['pending'], to: 'rejected' },
  unpublish: { from: ['active', 'inactive', 'sold'], to: 'unpublished' },
  remove: { from: ['pending', 'active', 'inactive', 'sold', 'rejected', 'unpublished'], to: 'removed' },
  restore: { from: ['rejected', 'unpublished', 'removed'], to: 'active' },
}

/** Admin product moderation — status change + seller-visible note + notification + audit. */
export async function moderateProduct(
  productId: string,
  action: ProductModerationAction,
  reason: string | undefined,
  admin: AdminRecord,
): Promise<ModerationResult> {
  const transition = PRODUCT_TRANSITIONS[action]
  if (!transition) return { ok: false, error: 'অবৈধ অ্যাকশন', status: 400 }

  const noteRequired = action === 'reject' || action === 'unpublish' || action === 'remove'
  const note = clip(reason)
  if (noteRequired && !note) {
    return { ok: false, error: 'এই অ্যাকশনের জন্য কারণ লিখতে হবে', status: 400 }
  }

  const product = await db.digitalProduct.findUnique({
    where: { id: productId },
    select: {
      id: true, title: true, status: true, sellerId: true, image: true,
      seller: { select: { id: true, name: true, email: true } },
    },
  })
  if (!product) return { ok: false, error: 'পণ্য পাওয়া যায়নি', status: 404 }
  if (!transition.from.includes(product.status)) {
    return { ok: false, error: `বর্তমান অবস্থা (${product.status}) থেকে এই অ্যাকশন করা যাবে না`, status: 409 }
  }

  await db.digitalProduct.update({
    where: { id: productId },
    data: {
      status: transition.to,
      moderationNote: action === 'restore' || action === 'approve' ? null : note || null,
      moderatedAt: new Date(),
      moderatedByName: adminName(admin),
    },
  })

  const AUDIT_ACTION: Record<ProductModerationAction, string> = {
    approve: 'product_approved',
    reject: 'product_rejected',
    unpublish: 'product_unpublished',
    remove: 'product_removed',
    restore: 'product_restored',
  }

  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: AUDIT_ACTION[action],
    targetType: 'product',
    targetId: productId,
    details: {
      productTitle: product.title,
      sellerId: product.sellerId,
      fromStatus: product.status,
      toStatus: transition.to,
      ...(note ? { reason: note } : {}),
    },
  })

  const notifyMap: Record<ProductModerationAction, { type: string; title: string; message: (r?: string) => string }> = {
    approve: {
      type: 'product_approved', title: 'পণ্য অনুমোদিত হয়েছে',
      message: () => `আপনার পণ্য "${product.title}" অনুমোদিত হয়েছে এবং এখন মার্কেটপ্লেসে দৃশ্যমান।`,
    },
    reject: {
      type: 'product_rejected', title: 'পণ্য বাতিল করা হয়েছে',
      message: (r) => `আপনার পণ্য "${product.title}" বাতিল করা হয়েছে।${r ? ` কারণ: ${r}` : ''} পণ্যটি সংশোধন করে পুনরায় জমা দিতে পারেন।`,
    },
    unpublish: {
      type: 'product_unpublished', title: 'পণ্য অপ্রকাশিত করা হয়েছে',
      message: (r) => `আপনার পণ্য "${product.title}" সাময়িকভাবে অপ্রকাশিত করা হয়েছে।${r ? ` কারণ: ${r}` : ''}`,
    },
    remove: {
      type: 'product_removed', title: 'পণ্য সরিয়ে ফেলা হয়েছে',
      message: (r) => `আপনার পণ্য "${product.title}" প্ল্যাটফর্ম নীতিমালার ভিত্তিতে সরিয়ে ফেলা হয়েছে।${r ? ` কারণ: ${r}` : ''}`,
    },
    restore: {
      type: 'product_restored', title: 'পণ্য পুনরায় সক্রিয়',
      message: () => `আপনার পণ্য "${product.title}" পুনরায় সক্রিয় করা হয়েছে এবং এখন মার্কেটপ্লেসে দৃশ্যমান।`,
    },
  }
  const n = notifyMap[action]
  notifyUser({
    userId: product.sellerId,
    type: n.type,
    title: n.title,
    message: n.message(note || undefined),
    relatedType: 'product_moderation',
    relatedId: productId,
    pushUrl: '/dashboard?panel=products',
  }).catch(() => {})

  return { ok: true, message: 'পণ্য আপডেট করা হয়েছে' }
}

/* ────────────────────────────────────────────────────────────────
   MODERATION REPORTS
   ──────────────────────────────────────────────────────────────── */

/** Admin files a report against a seller or product (suspicious activity). */
export async function createModerationReport(
  targetType: 'seller' | 'product',
  targetId: string,
  reason: string,
  details: string | undefined,
  admin: AdminRecord,
): Promise<ModerationResult & { reportId?: string }> {
  const why = clip(reason, 300)
  if (!why) return { ok: false, error: 'রিপোর্টের কারণ লিখতে হবে', status: 400 }

  let targetLabel = ''
  let targetMeta: Record<string, unknown> = {}
  if (targetType === 'product') {
    const p = await db.digitalProduct.findUnique({
      where: { id: targetId },
      select: { id: true, title: true, status: true, sellerId: true, seller: { select: { id: true, name: true, email: true } } },
    })
    if (!p) return { ok: false, error: 'পণ্য পাওয়া যায়নি', status: 404 }
    targetLabel = p.title
    targetMeta = {
      productId: p.id, productTitle: p.title, productStatus: p.status,
      sellerId: p.sellerId, sellerName: p.seller?.name || null, sellerEmail: p.seller?.email || null,
    }
  } else {
    const s = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, isSeller: true, sellerRole: true, businessName: true },
    })
    if (!s) return { ok: false, error: 'সেলার পাওয়া যায়নি', status: 404 }
    targetLabel = s.businessName || s.name
    targetMeta = { sellerId: s.id, sellerName: s.name, sellerEmail: s.email, sellerRole: s.sellerRole }
  }

  const report = await db.moderationReport.create({
    data: {
      targetType,
      targetId,
      targetLabel: targetLabel.slice(0, 200),
      targetMeta: JSON.stringify(targetMeta).slice(0, 2000),
      reporterId: admin.userId,
      reporterName: adminName(admin),
      reason: why,
      details: clip(details, 1000) || null,
      status: 'pending',
    },
  })

  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: 'report_created',
    targetType: 'moderation_report',
    targetId: report.id,
    details: { reportTargetType: targetType, reportTargetId: targetId, targetLabel, reason: why },
  })

  return { ok: true, message: 'রিপোর্ট তৈরি হয়েছে', reportId: report.id }
}

export type ReportDecision = 'start_review' | 'resolve' | 'reject'
export type ReportResolution =
  | 'no_action' | 'product_unpublished' | 'product_removed' | 'product_restored'
  | 'seller_suspended' | 'seller_restricted'

/**
 * Decide a report:
 * - start_review: pending → under_review
 * - resolve: records the decision AND executes the linked moderation action
 * - reject: report dismissed as invalid/false (note required)
 */
export async function decideModerationReport(
  reportId: string,
  decision: ReportDecision,
  resolution: ReportResolution | undefined,
  note: string | undefined,
  admin: AdminRecord,
): Promise<ModerationResult> {
  const report = await db.moderationReport.findUnique({ where: { id: reportId } })
  if (!report) return { ok: false, error: 'রিপোর্ট পাওয়া যায়নি', status: 404 }

  const why = clip(note)

  if (decision === 'start_review') {
    if (report.status !== 'pending') {
      return { ok: false, error: 'শুধু পেন্ডিং রিপোর্ট রিভিউতে নেওয়া যায়', status: 409 }
    }
    await db.moderationReport.update({
      where: { id: reportId },
      data: { status: 'under_review' },
    })
    await logAdminAction({
      adminId: admin.userId,
      adminName: adminName(admin),
      action: 'report_under_review',
      targetType: 'moderation_report',
      targetId: reportId,
      details: { reportTargetType: report.targetType, reportTargetId: report.targetId },
    })
    return { ok: true, message: 'রিপোর্ট রিভিউয়ের অধীনে নেওয়া হয়েছে' }
  }

  if (decision === 'reject') {
    if (report.status === 'resolved' || report.status === 'rejected') {
      return { ok: false, error: 'রিপোর্টটি ইতিমধ্যে নিষ্পত্তি হয়েছে', status: 409 }
    }
    if (!why) return { ok: false, error: 'রিপোর্ট খারিজের কারণ লিখতে হবে', status: 400 }
    await db.moderationReport.update({
      where: { id: reportId },
      data: {
        status: 'rejected',
        resolution: 'no_action',
        adminNote: why,
        decidedById: admin.userId,
        decidedByName: adminName(admin),
        decidedAt: new Date(),
      },
    })
    await logAdminAction({
      adminId: admin.userId,
      adminName: adminName(admin),
      action: 'report_rejected',
      targetType: 'moderation_report',
      targetId: reportId,
      details: { reportTargetType: report.targetType, reportTargetId: report.targetId, reason: why },
    })
    return { ok: true, message: 'রিপোর্ট খারিজ করা হয়েছে' }
  }

  // ── resolve ──
  if (report.status === 'resolved' || report.status === 'rejected') {
    return { ok: false, error: 'রিপোর্টটি ইতিমধ্যে নিষ্পত্তি হয়েছে', status: 409 }
  }
  const validResolutions: ReportResolution[] = [
    'no_action', 'product_unpublished', 'product_removed', 'product_restored', 'seller_suspended', 'seller_restricted',
  ]
  if (!resolution || !validResolutions.includes(resolution)) {
    return { ok: false, error: 'অবৈধ রেজোলিউশন', status: 400 }
  }
  if (resolution !== 'no_action' && !why) {
    return { ok: false, error: 'রেজোলিউশনের নোট লিখতে হবে', status: 400 }
  }

  // Execute the linked action through the SAME shared helpers — one code path.
  if (resolution.startsWith('product_')) {
    if (report.targetType !== 'product') {
      return { ok: false, error: 'এই রিপোর্টটি পণ্যের নয় — পণ্য অ্যাকশন করা যাবে না', status: 400 }
    }
    const actionMap: Record<string, ProductModerationAction> = {
      product_unpublished: 'unpublish',
      product_removed: 'remove',
      product_restored: 'restore',
    }
    const productAction = actionMap[resolution]
    if (productAction) {
      const r = await moderateProduct(report.targetId, productAction, why, admin)
      if (!r.ok) return r
    }
  } else if (resolution === 'seller_suspended' || resolution === 'seller_restricted') {
    if (report.targetType !== 'seller') {
      return { ok: false, error: 'এই রিপোর্টটি সেলারের নয় — সেলার অ্যাকশন করা যাবে না', status: 400 }
    }
    const r = await suspendSeller(report.targetId, why, admin, {
      restricted: resolution === 'seller_restricted',
    })
    if (!r.ok) return r
  }

  await db.moderationReport.update({
    where: { id: reportId },
    data: {
      status: 'resolved',
      resolution,
      adminNote: why || null,
      decidedById: admin.userId,
      decidedByName: adminName(admin),
      decidedAt: new Date(),
    },
  })

  await logAdminAction({
    adminId: admin.userId,
    adminName: adminName(admin),
    action: 'report_resolved',
    targetType: 'moderation_report',
    targetId: reportId,
    details: {
      reportTargetType: report.targetType,
      reportTargetId: report.targetId,
      resolution,
      ...(why ? { note: why } : {}),
    },
  })

  return { ok: true, message: 'রিপোর্ট নিষ্পত্তি হয়েছে' }
}
