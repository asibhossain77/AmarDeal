import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/blog/[slug] — single published post
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const post = await db.blogPost.findUnique({
      where: { slug, published: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'পোস্ট পাওয়া যায়নি' }, { status: 404 })
    }
    return NextResponse.json(post)
  } catch {
    return NextResponse.json({ error: 'পোস্ট লোড করতে সমস্যা হয়েছে' }, { status: 500 })
  }
}