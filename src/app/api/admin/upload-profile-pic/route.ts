import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return guard.response;
    const formData = await req.formData()
    const file = formData.get('profile') as File | null

    if (!file) {
      return NextResponse.json({ error: 'প্রোফাইল ছবি প্রদান করুন' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'শুধুমাত্র ইমেজ ফাইল আপলোড করুন' }, { status: 400 })
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'ছবি সর্বোচ্চ ২MB হতে পারে' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const ext = file.name.split('.').pop() || 'png'
    const filename = `admin-profile.${ext}`
    const filepath = path.join(uploadsDir, filename)

    await writeFile(filepath, buffer)

    const imgPath = `/uploads/${filename}`
    await db.platformSetting.upsert({
      where: { key: 'admin_image_url' },
      update: { value: imgPath },
      create: { key: 'admin_image_url', value: imgPath },
    })

    return NextResponse.json({
      success: true,
      imageUrl: imgPath,
    })
  } catch {
    return NextResponse.json(
      { error: 'প্রোফাইল ছবি আপলোডে সমস্যা হয়েছে' },
      { status: 500 }
    )
  }
}