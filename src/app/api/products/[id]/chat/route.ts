import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/deal-guard'

// GET /api/products/[id]/chat — get all chat messages for a product
// Both sender (any authenticated user who has sent a message) and receiver (seller) can read
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Verify the product exists
    const product = await db.digitalProduct.findUnique({
      where: { id },
      select: { sellerId: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    // Authorization: only seller or a user who has chatted on this product can read messages
    const hasChatted = await db.productChatMessage.findFirst({
      where: { productId: id, senderId: userId },
      select: { id: true },
    })

    const isSeller = product.sellerId === userId

    if (!isSeller && !hasChatted) {
      return NextResponse.json(
        { success: false, error: 'এই চ্যাট দেখার অনুমতি নেই' },
        { status: 403 }
      )
    }

    const messages = await db.productChatMessage.findMany({
      where: { productId: id },
      include: {
        sender: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const formatted = messages.map((m) => ({
      id: m.id,
      productId: m.productId,
      senderId: m.senderId,
      senderName: m.sender.name,
      text: m.text,
      createdAt: m.createdAt,
    }))

    return NextResponse.json({ success: true, messages: formatted })
  } catch {
    return NextResponse.json(
      { success: false, error: 'চ্যাট লোড করতে সমস্যা' },
      { status: 500 }
    )
  }
}

// POST /api/products/[id]/chat — send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    // Verify the product exists
    const product = await db.digitalProduct.findUnique({
      where: { id },
      select: { sellerId: true, status: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'পণ্য পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    const { text } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json(
        { success: false, error: 'মেসেজ লিখুন' },
        { status: 400 }
      )
    }

    const message = await db.productChatMessage.create({
      data: {
        productId: id,
        senderId: userId,
        text: text.trim(),
      },
      include: {
        sender: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          productId: message.productId,
          senderId: message.senderId,
          senderName: message.sender.name,
          text: message.text,
          createdAt: message.createdAt,
        },
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'মেসেজ পাঠাতে সমস্যা' },
      { status: 500 }
    )
  }
}
