import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, dealCreatedEmail, adminNewDealEmail } from '@/lib/email'
import { sendWhatsApp, dealCreatedWa, adminNewDealWa } from '@/lib/whatsapp'
import { requireAuth } from '@/lib/deal-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req)
    if (!guard.ok) return guard.response
    const userId = guard.userId

    const { title, role, amount, partyEmail, terms } = await req.json()

    if (!title || !amount || !partyEmail) {
      return NextResponse.json(
        { error: 'সকল প্রয়োজনীয় তথ্য প্রদান করুন' },
        { status: 400 }
      )
    }

    if (!role || (role !== 'buyer' && role !== 'seller')) {
      return NextResponse.json(
        { error: 'ভূমিকা নির্বাচন করুন' },
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
          { email: partyEmail },
          { phone: partyEmail },
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

    const deal = await db.deal.create({
      data: {
        title,
        amount,
        status: 'created',
        buyerId,
        sellerId,
        creatorId: userId,
        terms: terms || null,
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
      await fetch('http://localhost:3004/notify', {
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

    // Email notification to counterparty
    sendEmail(counterparty.email!, () => dealCreatedEmail(
      counterparty.name || 'ইউজার',
      deal.title,
      deal.amount,
      deal.creator?.name || 'একজন ইউজার',
      isCreatorBuyer ? 'buyer' : 'seller',
    ), 'deal_created').catch(() => {})

    // WhatsApp notification to counterparty
    sendWhatsApp(counterparty.phone, () => ({
      body: dealCreatedWa(
        counterparty.name || 'ইউজার',
        deal.title,
        deal.amount,
        deal.creator?.name || 'একজন ইউজার',
        isCreatorBuyer ? 'buyer' : 'seller',
      ),
    }), 'deal_created').catch(() => {})

    // Email notification to admin
    try {
      const adminUser = await db.user.findFirst({
        where: { admin: { isNot: null } },
        select: { name: true, email: true, phone: true },
      })
      if (adminUser?.email) {
        sendEmail(adminUser.email, () => adminNewDealEmail(
          adminUser.name || 'অ্যাডমিন',
          deal.title,
          `৳${deal.amount.toLocaleString('en')}`,
          deal.creator?.name || 'একজন ইউজার',
          deal.buyer?.name || '-',
          deal.seller?.name || '-',
        ), 'deal_created').catch(() => {})
      }
      // WhatsApp notification to admin
      if (adminUser?.phone) {
        sendWhatsApp(adminUser.phone, () => ({
          body: adminNewDealWa(
            adminUser.name || 'অ্যাডমিন',
            deal.title,
            `৳${deal.amount.toLocaleString('en')}`,
            deal.creator?.name || 'একজন ইউজার',
            deal.buyer?.name || '-',
            deal.seller?.name || '-',
          ),
        }), 'deal_created').catch(() => {})
      }
    } catch { /* silent */ }

    return NextResponse.json({
      id: deal.id,
      title: deal.title,
      amount: deal.amount,
      status: deal.status,
      buyerName: deal.buyer?.name,
      sellerName: deal.seller?.name,
      createdAt: deal.createdAt,
    })
  } catch (err) {
    console.error('Deal create error:', err)
    return NextResponse.json(
      { error: 'ডিল তৈরিতে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}