import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/admin/blog — all posts (admin)
export async function GET() {
  try {
    const posts = await db.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(posts)
  } catch {
    return NextResponse.json({ error: 'ব্লগ লোড করতে সমস্যা' }, { status: 500 })
  }
}

// POST /api/admin/blog — create post
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, slug, excerpt, content, coverImage, published } = body

    if (!title || !slug || !content) {
      return NextResponse.json({ error: 'শিরোনাম, স্লাগ এবং কন্টেন্ট আবশ্যক' }, { status: 400 })
    }

    const post = await db.blogPost.create({
      data: { title, slug, excerpt, content, coverImage: coverImage || null, published: published ?? false },
    })

    return NextResponse.json(post, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'এই স্লাগ আগে থেকেই ব্যবহৃত হচ্ছে' }, { status: 409 })
    }
    return NextResponse.json({ error: 'পোস্ট তৈরিতে সমস্যা' }, { status: 500 })
  }
}

// PUT /api/admin/blog — update post
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, slug, excerpt, content, coverImage, published } = body

    if (!id) {
      return NextResponse.json({ error: 'ID আবশ্যক' }, { status: 400 })
    }

    const post = await db.blogPost.update({
      where: { id },
      data: { title, slug, excerpt, content, coverImage, published },
    })

    return NextResponse.json(post)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'এই স্লাগ আগে থেকেই ব্যবহৃত হচ্ছে' }, { status: 409 })
    }
    return NextResponse.json({ error: 'পোস্ট আপডেটে সমস্যা' }, { status: 500 })
  }
}

// DELETE /api/admin/blog — delete post
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID আবশ্যক' }, { status: 400 })
    }

    await db.blogPost.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'পোস্ট ডিলিটে সমস্যা' }, { status: 500 })
  }
}