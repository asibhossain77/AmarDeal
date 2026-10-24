import { db } from '@/lib/db'

/* ═══════════════════════════════════════════════════════════════
   Phase 6 — Buyer Protection domain rules (server-side ONLY).

   Eligibility is decided HERE, never on the client:
   - Cancellation: unpaid orders cancel directly (existing flow);
     payment-submitted / paid-but-unfulfilled orders go through a
     seller/admin-reviewed cancellation request. Approval on a PAID
     order can never cancel it — it only spawns a verified-pending
     RefundRequest. Money always moves through the admin refund flow.
   - Refunds: verified-paid orders only, amount capped at the paid
     total, one request per order, 'refunded' requires an actual
     manual-refund reference recorded by an admin.
   - Disputes: buyer AND seller, categorized, with a timestamped
     two-sided evidence thread; only admins decide outcomes.
   - Every sensitive admin decision lands in AdminAuditLog.
   ═══════════════════════════════════════════════════════════════ */

/* ── Request vocabularies ─────────────────────────────────────── */

export const CANCELLATION_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const
export const REFUND_REQUEST_STATUSES = [
  'requested', 'under_review', 'approved', 'rejected', 'processing', 'refunded',
] as const
export const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const
export const DISPUTE_CATEGORIES = [
  'item_not_received', 'not_as_described', 'damaged_physical', 'incorrect_digital', 'other',
] as const
export const DISPUTE_OUTCOMES = ['refund', 'cancel', 'complete', 'rejected', 'none'] as const

export type CancellationRequestStatus = (typeof CANCELLATION_REQUEST_STATUSES)[number]
export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUSES)[number]
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number]
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number]

export function isCancellationStatus(v: unknown): v is CancellationRequestStatus {
  return typeof v === 'string' && (CANCELLATION_REQUEST_STATUSES as readonly string[]).includes(v)
}
export function isRefundStatus(v: unknown): v is RefundRequestStatus {
  return typeof v === 'string' && (REFUND_REQUEST_STATUSES as readonly string[]).includes(v)
}
export function isDisputeStatus(v: unknown): v is DisputeStatus {
  return typeof v === 'string' && (DISPUTE_STATUSES as readonly string[]).includes(v)
}
export function isDisputeCategory(v: unknown): v is DisputeCategory {
  return typeof v === 'string' && (DISPUTE_CATEGORIES as readonly string[]).includes(v)
}
export function isDisputeOutcome(v: unknown): v is DisputeOutcome {
  return typeof v === 'string' && (DISPUTE_OUTCOMES as readonly string[]).includes(v)
}

/** Admin-driven refund status transitions (server-enforced). */
const REFUND_TRANSITIONS: Record<string, string[]> = {
  requested: ['under_review', 'approved', 'rejected', 'processing'],
  under_review: ['approved', 'rejected', 'processing'],
  approved: ['processing', 'refunded', 'rejected'],
  processing: ['refunded'],
  rejected: [],
  refunded: [],
}

export function canRefundTransition(from: string, to: string): boolean {
  return !!REFUND_TRANSITIONS[from]?.includes(to)
}

/* ── Evidence attachments ─────────────────────────────────────── */

export const MAX_EVIDENCE_FILES = 5

export interface EvidenceFile {
  key: string
  fileName: string
  fileSize: number
  fileType: string | null
}

/**
 * Whitelist-sanitize a client-supplied evidence array. Only objects with
 * an R2 `evidence/<orderId>/…` key survive; everything else is dropped.
 */
export function sanitizeEvidence(input: unknown, orderId: string): EvidenceFile[] {
  if (!Array.isArray(input)) return []
  const prefix = `evidence/${orderId}/`
  const out: EvidenceFile[] = []
  for (const raw of input.slice(0, MAX_EVIDENCE_FILES)) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const key = typeof e.key === 'string' ? e.key : ''
    if (!key.startsWith(prefix) || key.includes('..')) continue
    out.push({
      key,
      fileName: (typeof e.fileName === 'string' ? e.fileName : 'file').slice(0, 200),
      fileSize: Number.isFinite(Number(e.fileSize)) ? Math.max(0, Math.floor(Number(e.fileSize))) : 0,
      fileType: typeof e.fileType === 'string' ? e.fileType.slice(0, 100) : null,
    })
  }
  return out
}

export function parseEvidence(json: string | null | undefined): EvidenceFile[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as EvidenceFile[]) : []
  } catch {
    return []
  }
}

/* ── Eligibility rules ────────────────────────────────────────── */

export interface ProtectionOrderShape {
  status: string
  paymentStatus: string
  productId: string | null
  serviceId: string | null
  sellerId: string | null
  totalAmount: number
  refundedAt?: Date | null
}

export type ProtectionProductType = 'physical' | 'digital' | 'service'

/** Classify an order for protection-rule purposes. */
export function protectionProductType(
  order: Pick<ProtectionOrderShape, 'productId' | 'serviceId'>,
  productItemType?: string | null,
): ProtectionProductType {
  if (order.productId && productItemType === 'physical') return 'physical'
  if (order.productId) return 'digital'
  return 'service' // admin-owned SMM service direct order
}

export interface EligibilityResult {
  ok: boolean
  code?: string
  error?: string // Bengali user-facing reason
}

/**
 * Cancellation REQUEST eligibility (buyers). Unpaid pending_payment
 * orders cancel directly via the existing flow — no request needed.
 */
export function checkCancellationEligibility(order: ProtectionOrderShape, type: ProtectionProductType): EligibilityResult {
  if (['cancelled', 'refunded', 'failed'].includes(order.status)) {
    return { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডারটি ইতিমধ্যে বাতিল/রিফান্ড হয়ে গেছে' }
  }
  if (order.status === 'disputed') {
    return { ok: false, code: 'NOT_ELIGIBLE', error: 'বিরোধ চলাকালীন অর্ডার বাতিলের আবেদন করা যাবে না' }
  }
  if (order.status === 'pending_payment' && order.paymentStatus === 'unpaid') {
    return { ok: false, code: 'DIRECT_CANCEL', error: 'অপরিশোধিত অর্ডার সরাসরি বাতিল করা যায়' }
  }
  // Payment evidence submitted but not yet verified, or paid but work not
  // started — the request flow applies (money safety: verification first).
  if (order.status === 'pending_payment' && order.paymentStatus === 'awaiting_verification') {
    return { ok: true }
  }
  const paidUnfulfilled = ['queued', 'processing', 'in_progress']
  if (order.paymentStatus === 'paid' && paidUnfulfilled.includes(order.status)) {
    return { ok: true }
  }
  // Once shipped/out for delivery/delivered/completed, cancellation is no
  // longer possible — refund (or dispute) is the path.
  if (['shipped', 'out_for_delivery', 'delivered', 'completed', 'partial'].includes(order.status)) {
    return { ok: false, code: 'TOO_LATE', error: 'শিপিং শুরু হওয়া অর্ডার বাতিল করা যায় না — রিফান্ডের জন্য আবেদন করুন' }
  }
  return { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় বাতিলের আবেদন করা যায় না' }
}

/**
 * Refund REQUEST eligibility (buyers). Requires VERIFIED payment.
 * Physical: any time from payment verification through completion.
 * Digital: only before delivery — delivered digital content is final.
 * Service: while fulfilment is live (queued → partial).
 */
export function checkRefundEligibility(order: ProtectionOrderShape, type: ProtectionProductType): EligibilityResult {
  if (order.refundedAt || order.status === 'refunded') {
    return { ok: false, code: 'ALREADY_REFUNDED', error: 'এই অর্ডারের টাকা ইতিমধ্যে রিফান্ড হয়ে গেছে' }
  }
  if (order.status === 'pending_payment') {
    return { ok: false, code: 'NOT_PAID', error: 'পেমেন্ট যাচাই না হওয়া অর্ডারে রিফান্ড প্রযোজ্য নয় — বাতিল করুন বা পেমেন্টের অপেক্ষা করুন' }
  }
  if (order.paymentStatus !== 'paid') {
    return { ok: false, code: 'NOT_PAID', error: 'শুধুমাত্র পেমেন্ট যাচাই হওয়া অর্ডারে রিফান্ডের আবেদন করা যায়' }
  }
  if (order.status === 'disputed') {
    return { ok: false, code: 'DISPUTE_ACTIVE', error: 'বিরোধ চলাকালীন রিফান্ডের আবেদন করা যাবে না — বিরোধ মীমাংসার অপেক্ষা করুন' }
  }
  if (['cancelled', 'failed'].includes(order.status)) {
    return { ok: false, code: 'NOT_ELIGIBLE', error: 'বাতিল/ব্যর্থ অর্ডারে রিফান্ডের আবেদন করা যায় না' }
  }
  if (type === 'digital') {
    // Delivered/completed digital content cannot be refunded by request —
    // the handover content is already in the buyer's hands.
    if (['delivered', 'completed'].includes(order.status)) {
      return { ok: false, code: 'DIGITAL_DELIVERED', error: 'ডিজিটাল ডেলিভারি হওয়ার পর রিফান্ডের আবেদন করা যায় না — সমস্যা হলে বিরোধ দাখিল করুন' }
    }
    return ['queued', 'processing', 'in_progress'].includes(order.status)
      ? { ok: true }
      : { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় রিফান্ডের আবেদন করা যায় না' }
  }
  if (type === 'physical') {
    return ['queued', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status)
      ? { ok: true }
      : { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় রিফান্ডের আবেদন করা যায় না' }
  }
  // service
  return ['queued', 'processing', 'in_progress', 'partial'].includes(order.status)
    ? { ok: true }
    : { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় রিফান্ডের আবেদন করা যায় না' }
}

/**
 * Dispute eligibility (buyer AND seller). Requires verified payment —
 * unpaid orders are simply cancelled. Includes 'completed': a received
 * order can still be disputed (item not as described, damaged, …).
 */
export function checkDisputeEligibility(order: ProtectionOrderShape): EligibilityResult {
  if (order.status === 'disputed') {
    return { ok: false, code: 'DISPUTE_ACTIVE', error: 'এই অর্ডারে ইতিমধ্যে একটি বিরোধ চলছে' }
  }
  if (order.paymentStatus !== 'paid') {
    return { ok: false, code: 'NOT_PAID', error: 'পেমেন্ট যাচাই না হওয়া অর্ডারে বিরোধ দাখিল হয় না' }
  }
  if (['cancelled', 'refunded', 'failed', 'partial'].includes(order.status)) {
    return { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় বিরোধ দাখিল করা যায় না' }
  }
  if (['queued', 'processing', 'in_progress', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status)) {
    return { ok: true }
  }
  return { ok: false, code: 'NOT_ELIGIBLE', error: 'এই অর্ডার অবস্থায় বিরোধ দাখিল করা যায় না' }
}

/* ── Audit log ────────────────────────────────────────────────── */

export interface AdminAuditInput {
  adminId: string
  adminName?: string | null
  action: string
  targetType: 'refund_request' | 'cancellation_request' | 'dispute' | 'order' | 'payment'
  targetId?: string | null
  orderId?: string | null
  details?: Record<string, unknown> | null
}

/** Write-once audit entry — never breaks the calling flow. */
export async function logAdminAction(input: AdminAuditInput): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        adminName: input.adminName ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        orderId: input.orderId ?? null,
        details: input.details ? JSON.stringify(input.details).slice(0, 4000) : null,
      },
    })
  } catch (err) {
    console.error('[order-protection] audit log write failed:', err)
  }
}

/* ── Status transition safety for dispute resolution ──────────── */

/** Statuses an order may resume to after a dispute is rejected. */
export function canResumeAfterDispute(status: string | null | undefined): boolean {
  return !!status && ['queued', 'processing', 'in_progress', 'shipped', 'out_for_delivery'].includes(status)
}

/** Truncate free-text input to a safe length. */
export function clipText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
