import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { recordPayout } from '@/lib/seller-ledger'
import { logAdminAction } from '@/lib/order-protection'
import { notifyUser } from '@/lib/push'

/* ═══════════════════════════════════════════════════════════════
   Phase 7 hardening — POST /api/admin/seller-withdrawals/[id]/complete

   approved → completed ONLY with VERIFIED payment evidence:
   - paymentReference (bKash/bank/Nagad TxnID) is REQUIRED — a payout
     can never be marked completed without it.
   - The payout lands in the seller's itemized ledger (idempotent —
     replaying this call can never double-pay).
   - The admin decision + payment reference land in the audit log.
   - The seller is notified with the payment reference.
   No funds are ever moved automatically — this only RECORDS a payout
   the admin has already sent through the manual channel.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req)
    if (!guard.ok) return guard.response
    const admin = guard.admin
    const { id } = await params

    const body = await req.json().catch(() => ({})) as {
      paymentReference?: string
      paymentNote?: string
    }
    const paymentReference = (body.paymentReference || '').trim().slice(0, 160)
    const paymentNote = (body.paymentNote || '').trim().slice(0, 500)

    if (!paymentReference) {
      return NextResponse.json(
        {
          error: 'পেমেন্ট রেফারেন্স (ট্রানজেকশন আইডি) ছাড়া পেআউট সম্পন্ন করা যাবে না — আগে টাকা পাঠিয়ে রেফারেন্স যাচাই করুন',
          code: 'PAYMENT_REFERENCE_REQUIRED',
        },
        { status: 400 }
      )
    }

    const withdrawal = await db.sellerWithdrawal.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    })
    if (!withdrawal) {
      return NextResponse.json({ error: 'উত্তোলন পাওয়া যায়নি' }, { status: 404 })
    }
    if (withdrawal.status === 'completed') {
      // Duplicate-payout guard: already completed (and ledger entry exists).
      return NextResponse.json(
        { error: 'এই উত্তোলন ইতিমধ্যে সম্পন্ন হয়েছে', code: 'ALREADY_COMPLETED' },
        { status: 409 }
      )
    }
    if (withdrawal.status !== 'approved') {
      return NextResponse.json(
        { error: `শুধু approved উত্তোলন সম্পন্ন করা যায় (বর্তমানে ${withdrawal.status})` },
        { status: 400 }
      )
    }

    const now = new Date()
    const updated = await db.sellerWithdrawal.update({
      where: { id },
      data: {
        status: 'completed',
        paymentReference,
        ...(paymentNote ? { paymentNote } : {}),
        completedById: admin.userId,
        completedAt: now,
      },
    })

    // ── Itemized ledger debit (idempotent on withdrawal id) ──
    await recordPayout({
      withdrawalId: withdrawal.id,
      sellerId: withdrawal.userId,
      amount: withdrawal.amount,
      paymentReference,
      accountType: withdrawal.accountType,
      accountNumber: withdrawal.accountNumber,
    })

    // ── Audit trail ──
    await logAdminAction({
      adminId: admin.userId,
      adminName: admin.user.name,
      action: 'seller_payout_completed',
      targetType: 'seller_withdrawal',
      targetId: withdrawal.id,
      details: {
        amount: withdrawal.amount,
        paymentReference,
        paymentNote: paymentNote || undefined,
        sellerId: withdrawal.userId,
      },
    }).catch(() => {})

    // ── Seller notification with the actual payment reference ──
    await notifyUser({
      userId: withdrawal.userId,
      type: 'seller_payout_completed',
      title: 'উত্তোলন সম্পন্ন হয়েছে',
      message: `৳${withdrawal.amount.toLocaleString('en')} আপনার ${withdrawal.accountType} অ্যাকাউন্টে পাঠানো হয়েছে। পেমেন্ট রেফারেন্স: ${paymentReference}`,
      relatedType: 'withdrawal',
      relatedId: withdrawal.id,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'উত্তোলন সম্পন্ন হয়েছে — টাকা পাঠানো হয়েছে',
      withdrawal: updated,
    })
  } catch (err) {
    console.error('[SELLER WD COMPLETE ERROR]', err)
    return NextResponse.json({ error: 'সম্পন্ন করতে সমস্যা' }, { status: 500 })
  }
}
