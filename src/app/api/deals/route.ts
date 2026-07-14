import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { title, role, amount, partyIdentifier, terms, userId } = await req.json()

    if (!title || !amount || !userId || !partyIdentifier) {
      return NextResponse.json(
        { error: 'সকল প্রয়োজনীয় তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'পরিমাণ অবশ্যই শূন্যের বেশি হতে হবে' },
        { status: 400 }
      )
    }

    // Find counterparty by email or phone
    const counterparty = await db.user.findFirst({
      where: {
        OR: [
          { email: partyIdentifier },
          { phone: partyIdentifier },
        ],
      },
    })

    if (!counterparty) {
      return NextResponse.json(
        { error: 'এই ইমেইল/ফোন নম্বরে কোনো ইউজার পাওয়া যায়নি' },
        { status: 404 }
      )
    }

    if (counterparty.id === userId) {
      return NextResponse.json(
        { error: 'আপনি নিজের সাথে ডিল তৈরি করতে পারবেন না' },
        { status: 400 }
      )
    }

    // Determine buyer and seller based on role
    const isCreatorBuyer = role === 'buyer'
    const buyerId = isCreatorBuyer ? userId : counterparty.id
    const sellerId = isCreatorBuyer ? counterparty.id : userId

    // Count existing deals to generate a sequential deal number
    const dealCount = await db.deal.count()
    const dealNumber = String(dealCount + 1001)

    const deal = await db.deal.create({
      data: {
        title,
        amount,
        terms: terms || '',
        status: 'created',
        buyerId,
        sellerId,
        creatorId: userId,
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    // Create notification for the counterparty
    const notifMessage = `${isCreatorBuyer ? 'ক্রেতা' : 'বিক্রেতা'} হিসেবে আপনাকে একটি নতুন ডিল পাঠানো হয়েছে: "${title}"`
    await db.notification.create({
      data: {
        userId: counterparty.id,
        type: 'deal_request',
        title: 'নতুন ডিল অনুরোধ',
        message: notifMessage,
        dealId: deal.id,
      },
    })

    // Send real-time notification via WebSocket
    try {
      await fetch(`http://localhost:3004/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: counterparty.id,
          notification: {
            id: deal.id + '-notif',
            type: 'deal_request',
            title: 'নতুন ডিল অনুরোধ',
            message: notifMessage,
            dealId: deal.id,
            createdAt: new Date().toISOString(),
          },
        }),
      })
    } catch {
      // WebSocket notification failed silently — DB notification still exists
    }

    return NextResponse.json({
      id: deal.id,
      dealNumber,
      title: deal.title,
      amount: deal.amount,
      status: deal.status,
      buyerName: deal.buyer?.name,
      sellerName: deal.seller?.name,
      createdAt: deal.createdAt,
    })
  } catch {
    return NextResponse.json(
      { error: 'ডিল তৈরিতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId প্রয়োজন' }, { status: 400 })
    }

    const deals = await db.deal.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
        ],
      },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deals)
  } catch {
    return NextResponse.json({ error: 'ডিল লোড করতে সমস্যা' }, { status: 500 })
  }
}