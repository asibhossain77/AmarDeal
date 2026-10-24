import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/deal-guard'
import { getAdminFromRequest } from '@/lib/admin-guard'
import { validateChatFile, putDigitalFile } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/* ═══════════════════════════════════════════════════════════════
   POST /api/orders/[id]/evidence-upload

   Participants only (buyer / order seller / admin). Files land in
   R2 under `evidence/<orderId>/…` — never publicly reachable, served
   later through the participant-guarded /api/evidence-file route.
   Max 4MB (Vercel serverless body limit is 4.5MB).
   Returns { key, fileName, fileSize, fileType }.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth(req)
  if (!guard.ok) return guard.response

  try {
    const { id } = await params
    const order = await db.marketplaceOrder.findUnique({
      where: { id },
      select: { id: true, userId: true, sellerId: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'অর্ডার পাওয়া যায়নি' }, { status: 404 })
    }

    const isAdmin = !!(await getAdminFromRequest(req))
    const isBuyer = order.userId === guard.userId
    const isSeller = !!order.sellerId && order.sellerId === guard.userId
    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'ফাইল পাওয়া যায়নি' }, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ফাইল পাওয়া যায়নি' }, { status: 400 })
    }

    let ext: string
    try {
      ({ ext } = validateChatFile(file.name, file.size))
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'ফাইল ভ্যালিড নয়' },
        { status: 400 },
      )
    }

    const key = `evidence/${order.id}/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await putDigitalFile(buffer, key, file.type)

    const fileName = file.name.replace(/[\r\n"\\\u0000-\u001f]/g, '_').slice(0, 200) || 'file'

    return NextResponse.json({
      success: true,
      key,
      fileName,
      fileSize: file.size,
      fileType: file.type || null,
    })
  } catch (err) {
    console.error('[evidence-upload] Failed:', err instanceof Error ? err.message : err)
    const msg = err instanceof Error && /R2 credentials|not configured/i.test(err.message)
      ? 'ফাইল স্টোরেজ এখনো কনফিগার করা হয়নি'
      : 'ফাইল আপলোড করতে সমস্যা হয়েছে'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
