import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/blog — published posts list (public)
export async function GET() {
  try {
    const posts = await db.blogPost.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        createdAt: true,
      },
    })
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json(posts)
  } catch {
    return NextResponse.json({ error: 'ব্লগ লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}