import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'

/* ═══════════════════════════════════════════════════════════════
   GET /api/marketplace/orders/[id]
   Unified detail for BOTH order types that share the
   MarketplaceOrder table:
   - admin-owned SMM service direct orders (serviceId set)
   - seller product orders ("Order Now", productId set)

   Access: the order's buyer, the order's seller (product orders),
   or an admin. Ownership is enforced HERE on the server — a forged
   URL for someone else's order returns 403.
   Privacy: the seller sees the buyer's name + avatar only — never
   the buyer's email/phone (fulfillment inputs ride on the order:
   customerNote / linkUrl). Internal payment/invoice fields are only
   sent to admins.
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   Phase 6: refund payload is role-scoped — the buyer sees the full
   review trail (it is their money), the seller only learns that a
   refund is pending + how much (the reason/notes stay private),
   admins see everything.
   ═══════════════════════════════════════════════════════════════ */
type RefundRow = {
  id: string; status: string; reason: string; amount: number
  adminNote: string | null; infoRequest: string | null
  refundMethod: string | null; refundReference: string | null
  refundedAt: Date | null; evidence: string | null; createdAt: Date
} | null

function buildRefundPayload(
  refund: RefundRow,
  viewerRole: 'admin' | 'seller' | 'buyer',
) {
  if (!refund) return null
  if (viewerRole === 'seller') {
    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
      refundedAt: refund.refundedAt,
      createdAt: refund.createdAt,
    }
  }
  return refund
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        // ── Phase 6: buyer protection records ──
        cancellationRequest: {
          select: {
            id: true, status: true, reason: true, requestedByRole: true,
            decidedByRole: true, decisionNote: true, decidedAt: true,
            refundRequestId: true, createdAt: true,
          },
        },
        refundRequest: {
          select: {
            id: true, status: true, reason: true, amount: true, adminNote: true,
            infoRequest: true, refundMethod: true, refundReference: true,
            refundedAt: true, evidence: true, createdAt: true,
          },
        },
        dispute: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true, senderId: true, senderRole: true, text: true,
                attachments: true, createdAt: true,
              },
            },
          },
        },
        service: {
          select: {
            id: true, name: true, category: true, description: true,
            pricePerThousand: true, minQuantity: true, maxQuantity: true,
            linkTypes: true, deliveryEstimate: true, instructions: true,
          },
        },
        product: {
          select: {
            id: true, title: true, image: true, category: true, description: true,
            fileKey: true, fileName: true, fileSize: true, productType: true,
            itemType: true,
          },
        },
        option: { select: { id: true, name: true, price: true } },
        user: { select: { id: true, name: true, imageLink: true } },
        seller: { select: { id: true, name: true, imageLink: true, whatsappNumber: true, admin: { select: { userId: true } } } },
        paymentMethod: { select: { id: true, name: true, accountNumber: true, accountType: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const isAdmin = !!(await getAdminFromRequest(req))
    const isBuyer = order.userId === guard.userId
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Role precedence: admin beats seller (platform orders are sold by the
    // admin account — the admin needs its action set there).
    const viewerRole: 'admin' | 'seller' | 'buyer' = isAdmin ? 'admin' : isSeller ? 'seller' : 'buyer'

    // Customer-safe payload — internal fulfilment fields stripped for owners
    const base = {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      serviceName: order.serviceName,
      service: order.service,
      // product-order payload (nulls for service orders)
      productId: order.productId,
      product: order.product
        ? {
            id: order.product.id,
            title: order.product.title,
            image: order.product.image,
            category: order.product.category,
            description: order.product.description,
            hasFile: !!order.product.fileKey, // fileKey itself NEVER leaves the server
            fileName: order.product.fileName,
            fileSize: order.product.fileSize,
            productType: order.product.productType,
            itemType: order.product.itemType,
          }
        : null,
      option: order.option,
      isPlatformOwned: order.serviceId ? true : !!order.seller?.admin,
      buyer: order.user,
      seller: order.seller
        ? {
            id: order.seller.id,
            name: order.seller.name,
            imageLink: order.seller.imageLink,
            whatsappNumber: order.seller.whatsappNumber,
          }
        : null,
      viewerRole,
      linkUrl: order.linkUrl,
      linkType: order.linkType,
      quantity: order.quantity,
      pricingUnit: order.pricingUnit,
      unitPriceAtOrder: order.unitPriceAtOrder,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customerNote: order.customerNote,
      paymentMethodName: order.paymentMethodName,
      senderNumber: order.senderNumber,
      transactionId: order.transactionId,
      piprapayInvoiceId: order.piprapayInvoiceId ? true : undefined, // presence only, never the raw value to non-admins
      paidAt: order.paidAt,
      fulfilmentNote: order.fulfilmentNote,
      startCount: order.startCount,
      remains: order.remains,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancelledBy: order.cancelledBy,
      cancelReason: order.cancelReason,
      refundedAt: order.refundedAt,
      // ── Phase 3: physical delivery info + dispute context ──
      // (only the three authorized parties ever reach this route)
      delivery: {
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        addressLine: order.addressLine,
        city: order.city,
        postalCode: order.postalCode,
        deliveryNote: order.deliveryNote,
      },
      // ── Phase 5: seller-supplied shipping/tracking record ──
      shipping: {
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        dispatchDate: order.dispatchDate,
        estimatedDeliveryDate: order.estimatedDeliveryDate,
        shippingNote: order.shippingNote,
      },
      deliveredAt: order.deliveredAt,
      // ── Phase 5: secure digital handover content — order-scoped, only
      //    for digital orders. Never present on physical orders and never
      //    exposed by any list/product API (explicit selects everywhere). ──
      deliveryContent: order.product?.itemType !== 'physical' ? order.deliveryContent : null,
      deliveryContentAt: order.product?.itemType !== 'physical' ? order.deliveryContentAt : null,
      disputeReason: order.disputeReason,
      disputedAt: order.disputedAt,
      // ── Phase 6: buyer protection payloads (role-scoped) ──
      cancellationRequest: order.cancellationRequest,
      refundRequest: buildRefundPayload(order.refundRequest, viewerRole),
      dispute: order.dispute,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      events: order.events.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        message: e.message,
        actorType: e.actorType,
        actorName: e.actorName,
        createdAt: e.createdAt,
      })),
      payment: {
        method: order.paymentMethod,
        senderNumber: order.senderNumber,
        transactionId: order.transactionId,
      },
    }

    if (isAdmin) {
      return NextResponse.json({
        success: true,
        order: {
          ...base,
          paymentMethodId: order.paymentMethodId,
          invoiceId: order.piprapayInvoiceId,
        },
        isAdmin: true,
      })
    }

    return NextResponse.json({ success: true, order: base, isAdmin: false })
  } catch (err) {
    console.error('[marketplace-order-detail] GET error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
