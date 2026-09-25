import { NextRequest, NextResponse } from 'next/server'
import { requireDealAccess } from '@/lib/deal-guard'
import { validateChatFile, chatFileKey, putDigitalFile } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/**
 * POST /api/deals/[id]/chat/upload — upload a chat attachment (document or image).
 *
 * Only deal participants (buyer/seller/creator) may upload. The file is stored
 * in R2 under `chat/<dealId>/…` (never publicly reachable — served later through
 * the participant-guarded download route) and auto-deleted 3 days after the
 * message carrying it is sent.
 *
 * Max 4MB — Vercel's serverless request-body limit is 4.5MB.
 * Returns { key, fileName, fileSize, fileType } to pass into the chat POST.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authorization: caller must be a participant of this deal
    const guard = await requireDealAccess(req, id)
    if (!guard.ok) return guard.response

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      // Empty or non-multipart body
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
        { status: 400 }
      )
    }

    const key = chatFileKey(id, ext)
    const buffer = Buffer.from(await file.arrayBuffer())
    await putDigitalFile(buffer, key, file.type)

    // Sanitized display name (strip control chars, cap length)
    const fileName = file.name.replace(/[\r\n"\\\u0000-\u001f]/g, '_').slice(0, 200) || 'file'

    return NextResponse.json({
      success: true,
      key,
      fileName,
      fileSize: file.size,
      fileType: file.type || null,
    })
  } catch (err) {
    console.error('[chat-upload] Failed:', err instanceof Error ? err.message : err)
    const msg = err instanceof Error && /R2 credentials|not configured/i.test(err.message)
      ? 'ফাইল স্টোরেজ এখনো কনফিগার করা হয়নি'
      : 'ফাইল আপলোড করতে সমস্যা হয়েছে'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
